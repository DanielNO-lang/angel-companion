import { ChatMessage, StudioId } from '../types/angel';
import { storageService, STORAGE_KEYS } from './storageService';
import { memoryEngine } from './memoryEngine';
import { companionData } from './companionData';
import { extractIntelligentTitle, geminiModelService } from './geminiModelService';
import { toFriendlyError } from './errorHandlingService';
import { universalAttachmentService } from './universalAttachmentService';
import {
  loadRecentConversationsFromCache,
  mergeConversationSnapshots,
  pruneThreadsForLocalCache,
  readSnapshotFromCacheStorage,
  saveRecentConversationsToCache,
  sortMessagesChronologically,
  writeSnapshotToCacheStorage,
  type OfflineCacheStatus,
} from './conversationCache';

export type ConversationScope = 'general' | 'studio';

export interface ConversationThread {
  id: string;
  title: string;
  scope: ConversationScope;
  studioId?: StudioId;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  isCustomTitle?: boolean;
  messages: ChatMessage[];
  metadata?: {
    tags?: string[];
    summary?: string;
    handoffFromId?: string;
  };
}

const DEFAULT_CONVERSATIONS: ConversationThread[] = [];

let generatedIdSequence = 0;

function createUniqueId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  generatedIdSequence += 1;
  return `${prefix}_${Date.now()}_${generatedIdSequence}`;
}

export class ConversationEngine {
  private threads: ConversationThread[] = [];
  private activeGeneralId = '';
  private activeStudioIds: Record<string, string> = {};
  private accessToken: string | null = null;
  private activeUserId: string | null = null;
  private cloudSyncRunning = false;
  private cloudSyncQueued = false;
  private cloudHydrationToken: string | null = null;
  private inFlightThreads = new Set<string>();
  private changeListeners = new Set<() => void>();
  private pendingCloudSync = false;
  private pendingDeletes: string[] = [];
  private lastCachedAt: string | null = null;
  private onlineSyncBound = false;
  private tokenRefresher: (() => Promise<string | null>) | null = null;

  constructor() {
    this.loadCurrentScope();
    this.bindOnlineReconnectListener();
  }

  private bindOnlineReconnectListener(): void {
    if (this.onlineSyncBound || typeof window === 'undefined') return;
    this.onlineSyncBound = true;
    window.addEventListener('online', () => {
      void this.reconcileOnReconnect();
    });
  }

  public subscribe(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyChange(): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener();
      } catch {
        // ignore listener failure
      }
    });
  }

  private scopedKey(base: string): string {
    return this.activeUserId ? `${base}:user:${this.activeUserId}` : base;
  }

  private cacheScopeKey(): string {
    return this.activeUserId || 'anon';
  }

  private isBrowserOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private loadCurrentScope(): void {
    const scopeKey = this.cacheScopeKey();
    const loadedPendingDeletes = storageService.load<string[]>(
      this.scopedKey('angel_conv_pending_deletes_v1'),
      []
    );
    this.pendingDeletes = Array.isArray(loadedPendingDeletes) ? loadedPendingDeletes : [];
    const pendingDeleteSet = new Set(this.pendingDeletes);

    const loaded = storageService.load<ConversationThread[]>(
      this.scopedKey(STORAGE_KEYS.conversations),
      DEFAULT_CONVERSATIONS
    );
    const primaryThreads = pruneThreadsForLocalCache(Array.isArray(loaded) ? loaded : []).filter(
      (thread) => !pendingDeleteSet.has(thread.id)
    );
    const cachedSnapshot = loadRecentConversationsFromCache(scopeKey);

    if (cachedSnapshot) {
      this.pendingCloudSync = cachedSnapshot.pendingCloudSync || this.pendingDeletes.length > 0;
      this.lastCachedAt = cachedSnapshot.cachedAt;
    } else {
      this.pendingCloudSync = this.pendingDeletes.length > 0;
      this.lastCachedAt = null;
    }

    const filteredCached = (cachedSnapshot?.threads || []).filter((thread) => !pendingDeleteSet.has(thread.id));
    this.threads = filteredCached.length
      ? mergeConversationSnapshots(primaryThreads, filteredCached)
      : primaryThreads;

    this.activeGeneralId = storageService.load<string>(
      this.scopedKey(STORAGE_KEYS.activeConversationId),
      this.threads.find((thread) => thread.scope === 'general')?.id || ''
    );
    this.activeStudioIds = storageService.load<Record<string, string>>(
      this.scopedKey('angel_active_studio_convs_v1'),
      {}
    );

    if (this.threads.length > 0 && !this.lastCachedAt) {
      const snapshot = saveRecentConversationsToCache(scopeKey, this.threads, this.pendingCloudSync);
      this.lastCachedAt = snapshot.cachedAt;
      void writeSnapshotToCacheStorage(snapshot);
    }

    this.notifyChange();

    // Hydrate from Service Worker / CacheStorage mirror asynchronously if it holds newer or missing threads
    void this.hydrateFromCacheStorage(scopeKey);
  }

  private async hydrateFromCacheStorage(scopeKey: string): Promise<void> {
    const swSnapshot = await readSnapshotFromCacheStorage(scopeKey);
    if (!swSnapshot || swSnapshot.threads.length === 0) return;
    if (this.cacheScopeKey() !== scopeKey) return;

    const pendingDeleteSet = new Set(this.pendingDeletes);
    const safeSwThreads = swSnapshot.threads.filter((thread) => !pendingDeleteSet.has(thread.id));
    if (safeSwThreads.length === 0) return;

    const merged = mergeConversationSnapshots(this.threads, safeSwThreads);
    const changed =
      merged.length !== this.threads.length ||
      merged.some((thread, idx) => {
        const current = this.threads[idx];
        return (
          !current ||
          current.id !== thread.id ||
          current.updatedAt !== thread.updatedAt ||
          current.messages.length !== thread.messages.length
        );
      });

    if (changed) {
      this.threads = merged;
      this.lastCachedAt = swSnapshot.cachedAt;
      this.pendingCloudSync = this.pendingCloudSync || swSnapshot.pendingCloudSync;
      storageService.save(this.scopedKey(STORAGE_KEYS.conversations), this.threads);
      saveRecentConversationsToCache(scopeKey, this.threads, this.pendingCloudSync);
      this.notifyChange();
    }
  }

  private saveLocalState(): void {
    const scopeKey = this.cacheScopeKey();
    storageService.save(this.scopedKey(STORAGE_KEYS.conversations), this.threads);
    storageService.save(this.scopedKey(STORAGE_KEYS.activeConversationId), this.activeGeneralId);
    storageService.save(this.scopedKey('angel_active_studio_convs_v1'), this.activeStudioIds);
    storageService.save(this.scopedKey('angel_conv_pending_deletes_v1'), this.pendingDeletes);

    const snapshot = saveRecentConversationsToCache(scopeKey, this.threads, this.pendingCloudSync);
    this.lastCachedAt = snapshot.cachedAt;
    void writeSnapshotToCacheStorage(snapshot);
    this.notifyChange();
  }

  private persist(syncToCloud = true): void {
    if (
      syncToCloud &&
      Boolean(this.accessToken && companionData.isCloudConfigured()) &&
      this.isBrowserOffline()
    ) {
      this.pendingCloudSync = true;
    }

    this.saveLocalState();

    if (syncToCloud && this.accessToken && companionData.isCloudConfigured() && !this.isBrowserOffline()) {
      void this.syncCloud();
    }
  }

  public async reconcileOnReconnect(): Promise<void> {
    if (this.isBrowserOffline()) return;
    if (!this.accessToken || !this.activeUserId || !companionData.isCloudConfigured()) return;
    if (this.pendingCloudSync) {
      await this.syncCloud();
    }
    await this.restoreCloud(this.accessToken);
  }

  public getOfflineCacheStatus(): OfflineCacheStatus {
    const messageCount = this.threads.reduce((sum, thread) => sum + thread.messages.length, 0);
    return {
      cachedAt: this.lastCachedAt,
      threadCount: this.threads.filter((thread) => !thread.isArchived).length,
      messageCount,
      pendingCloudSync: this.pendingCloudSync,
    };
  }

  public getRecentThreads(limit: number = 8): ConversationThread[] {
    const activeThreads = this.threads.filter((thread) => !thread.isArchived);
    const withMessages = activeThreads.filter((thread) => thread.messages.length > 0);
    const source = withMessages.length > 0 ? activeThreads : activeThreads;
    return [...source]
      .sort((a, b) => {
        if ((a.messages.length > 0) !== (b.messages.length > 0)) {
          return a.messages.length > 0 ? -1 : 1;
        }
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      })
      .slice(0, Math.max(1, limit));
  }

  public setAccessToken(token: string | null, userId?: string | null): void {
    const nextUserId = token ? userId || null : null;
    const identityChanged = this.activeUserId !== nextUserId;
    this.accessToken = token;

    if (identityChanged) {
      this.activeUserId = nextUserId;
      this.cloudHydrationToken = null;
      this.inFlightThreads.clear();
      this.loadCurrentScope();
    }

    if (!token) {
      this.cloudHydrationToken = null;
      return;
    }

    if ((this.cloudHydrationToken !== token || identityChanged) && companionData.isCloudConfigured() && !this.isBrowserOffline()) {
      this.cloudHydrationToken = token;
      void this.restoreCloud(token);
    }
  }

  public setTokenRefresher(refresher: (() => Promise<string | null>) | null): void {
    this.tokenRefresher = refresher;
  }

  public isGenerating(threadId: string): boolean {
    return this.inFlightThreads.has(threadId);
  }

  private async flushPendingDeletes(token: string): Promise<void> {
    if (!this.pendingDeletes.length || !companionData.isCloudConfigured() || this.isBrowserOffline()) {
      return;
    }
    const remaining: string[] = [];
    for (const deletedId of this.pendingDeletes) {
      try {
        await companionData.deleteThread(token, deletedId);
      } catch {
        remaining.push(deletedId);
      }
    }
    if (remaining.length !== this.pendingDeletes.length) {
      this.pendingDeletes = remaining;
      storageService.save(this.scopedKey('angel_conv_pending_deletes_v1'), this.pendingDeletes);
    }
    if (this.pendingDeletes.length > 0) {
      throw new Error('Pending thread deletions could not be synced yet.');
    }
  }

  private async syncCloud(): Promise<void> {
    if (!this.accessToken || !this.activeUserId || !companionData.isCloudConfigured()) return;
    if (this.isBrowserOffline()) {
      this.pendingCloudSync = true;
      this.saveLocalState();
      return;
    }
    if (this.cloudSyncRunning) {
      this.cloudSyncQueued = true;
      return;
    }

    this.cloudSyncRunning = true;
    try {
      do {
        this.cloudSyncQueued = false;
        const token = this.accessToken;
        const ownerId = this.activeUserId;
        if (!token || !ownerId) break;
        await this.flushPendingDeletes(token);
        if (this.threads.length > 0) {
          await companionData.syncThreads(token, this.threads, ownerId);
        }
      } while (this.cloudSyncQueued && this.accessToken);
      this.pendingCloudSync = false;
      this.saveLocalState();
    } catch (error) {
      this.pendingCloudSync = true;
      this.saveLocalState();
      companionData.reportEngineSyncError('companion_conversations', error, {
        errorCode: 'CONVERSATION_PERSISTENCE_FAILED',
        endpoint: '/rest/v1/companion_conversations',
        method: 'POST',
      });
    } finally {
      this.cloudSyncRunning = false;
    }
  }

  private async restoreCloud(token: string): Promise<void> {
    const ownerId = this.activeUserId;
    if (!ownerId || !companionData.isCloudConfigured() || this.isBrowserOffline()) return;
    try {
      await this.flushPendingDeletes(token).catch(() => undefined);
      const pendingDeleteSet = new Set(this.pendingDeletes);

      const rawCloudThreads = await companionData.loadThreads(token);
      if (this.accessToken !== token || this.activeUserId !== ownerId) return;

      const cloudThreads = rawCloudThreads.filter((thread) => !pendingDeleteSet.has(thread.id));
      const localById = new Map(this.threads.map((thread) => [thread.id, thread]));
      let needsCloudPush = this.pendingCloudSync || this.pendingDeletes.length > 0;

      const restored = cloudThreads.map((cloud) => {
        const local = localById.get(cloud.id);
        if (!local) return cloud;

        const messageMap = new Map<string, ChatMessage>();
        cloud.messages.forEach((msg) => messageMap.set(msg.id, msg));
        local.messages.forEach((msg) => {
          const existing = messageMap.get(msg.id);
          if (!existing) {
            needsCloudPush = true;
            messageMap.set(msg.id, msg);
          } else {
            const preferLocal =
              msg.status === 'completed' && existing.status !== 'completed';
            messageMap.set(msg.id, {
              ...existing,
              ...(preferLocal ? msg : existing),
              createdAt: existing.createdAt || msg.createdAt,
              sequence:
                typeof existing.sequence === 'number' ? existing.sequence : msg.sequence,
            });
          }
        });

        const localIsNewer = (local.updatedAt || '') > (cloud.updatedAt || '');
        if (localIsNewer) {
          needsCloudPush = true;
        }

        const primaryMetaSource = localIsNewer ? local : cloud;
        const preserveStudioScope = cloud.messages.length === 0 && local.scope === 'studio';

        return {
          ...cloud,
          title: primaryMetaSource.title,
          isArchived: primaryMetaSource.isArchived,
          isCustomTitle:
            primaryMetaSource.isCustomTitle ||
            (cloud.messages.length === 0 ? local.isCustomTitle : false),
          scope: preserveStudioScope ? local.scope : cloud.scope,
          studioId: preserveStudioScope ? local.studioId : cloud.studioId,
          metadata: primaryMetaSource.metadata || local.metadata || cloud.metadata,
          messages: sortMessagesChronologically(Array.from(messageMap.values())),
          updatedAt: localIsNewer ? local.updatedAt : cloud.updatedAt,
        };
      });

      const cloudIds = new Set(cloudThreads.map((thread) => thread.id));
      const localOnly = this.threads.filter(
        (thread) => !cloudIds.has(thread.id) && !pendingDeleteSet.has(thread.id)
      );
      if (localOnly.some((t) => t.messages.length > 0 || t.isCustomTitle || t.scope === 'studio')) {
        needsCloudPush = true;
      }

      this.threads = [...restored, ...localOnly].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      this.saveLocalState();

      if (needsCloudPush) {
        await this.syncCloud();
      }
    } catch (error) {
      companionData.reportEngineSyncError('companion_conversations', error, {
        errorCode: 'CONVERSATION_PERSISTENCE_FAILED',
        endpoint: '/rest/v1/companion_conversations',
        method: 'GET',
      });
    }
  }

  getThreads(scope: ConversationScope = 'general', studioId?: StudioId, includeArchived = false): ConversationThread[] {
    return this.threads.filter((t) => {
      if (!includeArchived && t.isArchived) return false;
      if (scope === 'general') {
        return t.scope === 'general';
      }
      if (t.scope !== 'studio') return false;
      if (studioId) return t.studioId === studioId;
      return true;
    });
  }

  peekActiveThread(scope: ConversationScope = 'general', studioId?: StudioId): ConversationThread | null {
    if (scope === 'general') {
      return (
        this.threads.find((t) => t.id === this.activeGeneralId && t.scope === 'general' && !t.isArchived) ||
        this.getThreads('general')[0] ||
        null
      );
    }

    const targetStudio = studioId || 'research-studio';
    const activeStudioThreadId = this.activeStudioIds[targetStudio];
    return (
      this.threads.find(
        (t) => t.id === activeStudioThreadId && t.scope === 'studio' && t.studioId === targetStudio && !t.isArchived
      ) ||
      this.getThreads('studio', targetStudio)[0] ||
      null
    );
  }

  getActiveThread(scope: ConversationScope = 'general', studioId?: StudioId): ConversationThread {
    if (scope === 'general') {
      let thread = this.threads.find((t) => t.id === this.activeGeneralId && t.scope === 'general' && !t.isArchived);
      if (!thread) {
        thread = this.getThreads('general')[0] || this.createThread('general', undefined, 'General Conversation');
        this.activeGeneralId = thread.id;
        this.persist();
      }
      return thread;
    }

    const targetStudio = studioId || 'research-studio';
    const activeStudioThreadId = this.activeStudioIds[targetStudio];
    let thread = this.threads.find(
      (t) => t.id === activeStudioThreadId && t.scope === 'studio' && t.studioId === targetStudio && !t.isArchived
    );
    if (!thread) {
      thread =
        this.getThreads('studio', targetStudio)[0] ||
        this.createThread('studio', targetStudio, `${this.formatStudioName(targetStudio)} Session`);
      this.activeStudioIds[targetStudio] = thread.id;
      this.persist();
    }
    return thread;
  }

  setActiveThread(id: string): boolean {
    const thread = this.threads.find((t) => t.id === id);
    if (thread) {
      if (thread.scope === 'general') {
        this.activeGeneralId = id;
      } else if (thread.scope === 'studio' && thread.studioId) {
        this.activeStudioIds[thread.studioId] = id;
      }
      this.persist();
      return true;
    }
    return false;
  }

  createThread(scope: ConversationScope = 'general', studioId?: StudioId, title?: string): ConversationThread {
    const defaultTitle =
      scope === 'general'
        ? `General Conversation ${this.getThreads('general', undefined, true).length + 1}`
        : `${this.formatStudioName(studioId || 'research-studio')} Session ${this.getThreads('studio', studioId, true).length + 1}`;

    const newThread: ConversationThread = {
      id: createUniqueId(`conv_${scope}`),
      title: title || defaultTitle,
      scope,
      studioId: scope === 'studio' ? (studioId || 'research-studio') : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      messages: [],
    };

    this.threads.unshift(newThread);
    if (scope === 'general') {
      this.activeGeneralId = newThread.id;
    } else if (studioId) {
      this.activeStudioIds[studioId] = newThread.id;
    }
    this.persist();
    return newThread;
  }

  handoffToStudio(fromThreadId: string, targetStudioId: StudioId, customPrompt?: string): ConversationThread {
    const sourceThread = this.threads.find((t) => t.id === fromThreadId) || this.getActiveThread('general');
    const lastUserMsg = [...sourceThread.messages].reverse().find((m) => m.sender === 'user');
    const handoffText = customPrompt || lastUserMsg?.content || 'Application workflow request';

    const studioThread = this.createThread(
      'studio',
      targetStudioId,
      `Handoff: ${sourceThread.title}`
    );

    studioThread.metadata = {
      handoffFromId: sourceThread.id,
      summary: handoffText,
    };

    studioThread.messages.push({
      id: createUniqueId('msg_handoff'),
      sender: 'system',
      content: `Context transferred from General Conversation ("${sourceThread.title}"). Ready to execute in ${this.formatStudioName(targetStudioId)}.`,
      timestamp: 'Just now',
      createdAt: new Date().toISOString(),
      sequence: studioThread.messages.length,
      status: 'completed',
    });

    this.persist();
    return studioThread;
  }

  renameThread(id: string, newTitle: string): boolean {
    const thread = this.threads.find((t) => t.id === id);
    if (thread && newTitle.trim()) {
      thread.title = newTitle.trim();
      thread.isCustomTitle = true;
      thread.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  deleteThread(id: string): boolean {
    const initialLen = this.threads.length;
    this.threads = this.threads.filter((t) => t.id !== id);
    if (this.threads.length < initialLen) {
      if (!this.pendingDeletes.includes(id)) {
        this.pendingDeletes.push(id);
      }
      if (this.accessToken && companionData.isCloudConfigured() && !this.isBrowserOffline()) {
        const tokenSnapshot = this.accessToken;
        void companionData
          .deleteThread(tokenSnapshot, id)
          .then(() => {
            this.pendingDeletes = this.pendingDeletes.filter((item) => item !== id);
            storageService.save(this.scopedKey('angel_conv_pending_deletes_v1'), this.pendingDeletes);
          })
          .catch((error) => {
            this.pendingCloudSync = true;
            this.saveLocalState();
            console.warn('[ConversationEngine] Cloud thread delete deferred:', error);
          });
        this.saveLocalState();
      } else {
        this.pendingCloudSync = Boolean(this.accessToken);
        this.saveLocalState();
      }
      return true;
    }
    return false;
  }

  archiveThread(id: string): boolean {
    const thread = this.threads.find((t) => t.id === id);
    if (thread) {
      thread.isArchived = true;
      thread.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  restoreThread(id: string): boolean {
    const thread = this.threads.find((t) => t.id === id);
    if (thread) {
      thread.isArchived = false;
      thread.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  async addMessage(
    threadId: string,
    content: string,
    sender: 'user' | 'angel' | 'system' = 'user',
    mode?: string,
    attachments?: string[],
    attachmentDetails?: import('../types/attachment').AttachmentRecord[],
    linkPreviews?: import('../types/attachment').LinkPreview[]
  ): Promise<ChatMessage> {
    const thread = this.threads.find((t) => t.id === threadId) || this.getActiveThread('general');

    const now = new Date();
    const userMessage: ChatMessage = {
      id: createUniqueId('msg'),
      sender,
      content,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: now.toISOString(),
      sequence: thread.messages.length,
      mode,
      attachments,
      attachmentDetails,
      linkPreviews,
      status: 'completed',
    };

    thread.messages.push(userMessage);
    thread.updatedAt = now.toISOString();

    const isFirstUserTurn =
      sender === 'user' &&
      !thread.messages.some((message) => message.sender === 'user' && message.id !== userMessage.id);

    if (!thread.isCustomTitle && isFirstUserTurn) {
      thread.title = extractIntelligentTitle(content);
    }

    if (sender === 'user' && content.toLowerCase().includes('remember')) {
      memoryEngine.saveMemory({
        category: 'personal',
        scope: thread.scope,
        studioId: thread.studioId,
        title: content.length > 30 ? `${content.slice(0, 30)}...` : content,
        content,
        source: `User Conversation (${thread.title})`,
      });
    }

    this.persist();
    return userMessage;
  }

  public hasFailedTurnPendingRetry(threadId: string, content: string): boolean {
    const thread = this.threads.find((t) => t.id === threadId);
    if (!thread || thread.messages.length === 0) return false;
    const normalized = content.trim();
    if (!normalized) return false;

    const last = thread.messages[thread.messages.length - 1];
    if (last.sender === 'user' && last.content.trim() === normalized) {
      return true;
    }
    if (thread.messages.length >= 2) {
      const prev = thread.messages[thread.messages.length - 2];
      if (
        prev.sender === 'user' &&
        prev.content.trim() === normalized &&
        last.sender === 'angel' &&
        last.status === 'failed'
      ) {
        return true;
      }
    }
    return false;
  }

  async retryLastTurn(threadId: string): Promise<ChatMessage | null> {
    const thread = this.threads.find((t) => t.id === threadId) || this.getActiveThread('general');
    if (this.inFlightThreads.has(thread.id)) {
      return null;
    }

    if (thread.messages.length > 0 && thread.messages[thread.messages.length - 1].sender === 'angel') {
      thread.messages.pop();
      thread.updatedAt = new Date().toISOString();
      this.persist();
    }

    return this.generateAssistantResponse(thread.id);
  }

  async generateAssistantResponse(threadId: string): Promise<ChatMessage> {
    const thread = this.threads.find((item) => item.id === threadId) || this.getActiveThread('general');

    if (this.inFlightThreads.has(thread.id)) {
      return {
        id: createUniqueId('msg_dup'),
        sender: 'angel',
        content: 'A response is already being generated for this conversation.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'failed',
        error: 'Duplicate generation prevented while another turn is in progress.',
      };
    }

    this.inFlightThreads.add(thread.id);
    this.notifyChange();
    const lastUserMsg = [...thread.messages].reverse().find((message) => message.sender === 'user');
    const promptText = lastUserMsg?.content || 'Hello';

    let responseText = '';
    let status: 'completed' | 'failed' = 'completed';
    let errorMessage: string | undefined;
    let modelUsed: string | undefined;
    let requestedModel: string | undefined;
    let fallbackActivated: boolean | undefined;
    let requestedMode: string | undefined = lastUserMsg?.mode;
    let appliedMode: string | undefined;
    let thinkingLevel: string | undefined;

    try {
      if (!this.accessToken || !this.activeUserId) {
        throw new Error('Sign in to start a private conversation with Angel.');
      }

      const memoryContext = memoryEngine.retrieveContextForPrompt(
        promptText,
        thread.scope,
        thread.studioId
      );

      // Include valid prior turns only (exclude failed/unsent placeholders) and bound total char count cleanly
      const validHistory = thread.messages
        .filter(
          (message) =>
            (message.sender === 'user' || message.sender === 'angel') &&
            message.status !== 'failed' &&
            message.status !== 'unsent'
        )
        .slice(-30);

      const rawPriorHistory =
        validHistory.length > 0 && validHistory[validHistory.length - 1].sender === 'user'
          ? validHistory.slice(0, -1)
          : validHistory;

      const MAX_HISTORY_CHARS = 48000;
      let charBudget = Math.max(0, MAX_HISTORY_CHARS - promptText.length);
      const priorHistoryReversed: ChatMessage[] = [];
      for (let i = rawPriorHistory.length - 1; i >= 0; i--) {
        const turn = rawPriorHistory[i];
        if (turn.content.length <= charBudget) {
          priorHistoryReversed.push(turn);
          charBudget -= turn.content.length;
        } else {
          break;
        }
      }
      const priorHistory = priorHistoryReversed.reverse();

      const activeModeLabel = lastUserMsg?.mode || 'Standard Intelligent';
      const systemInstruction = [
        'You are Angel, a thoughtful, natural, highly capable Universal Personal AI Companion.',
        'Communicate clearly, concisely, and naturally without robotic boilerplate or generic filler.',
        'Maintain full continuity across every turn in this conversation and resolve references accurately without leaking unrelated threads.',
        'Never fabricate external actions, live telemetry, citations, or connected workspace integrations unless confirmed.',
        `Current Angel environment: ${thread.scope === 'studio' ? this.formatStudioName(thread.studioId) : 'General Conversation'}.`,
        activeModeLabel === 'Think'
          ? 'Think Mode is active: reason step-by-step internally and present clear, well-structured, analytical conclusions.'
          : activeModeLabel === 'Deep Research'
            ? 'Deep Research mode is active: synthesize comprehensive, balanced depth and note uncertainties explicitly.'
            : activeModeLabel === 'Code Analysis'
              ? 'Code Analysis mode is active: prioritize correctness, edge cases, strong typing, and minimal clean code.'
              : '',
        thread.scope === 'studio'
          ? 'Stay aware of the specialised studio context while remaining able to explain your reasoning.'
          : 'Do not force the user into a project, workspace, or studio unless they ask.',
        memoryContext ? `Relevant user context available for this conversation:\n${memoryContext}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const attachmentPayloads = await universalAttachmentService.buildChatPayloads(
        lastUserMsg?.attachmentDetails
      );

      let result = await geminiModelService.generateChatResponse(
        priorHistory,
        promptText,
        lastUserMsg?.mode,
        systemInstruction,
        this.accessToken,
        undefined,
        attachmentPayloads
      );

      if (!result.success && result.statusCode === 401 && this.tokenRefresher) {
        const refreshedToken = await this.tokenRefresher().catch(() => null);
        if (refreshedToken && refreshedToken.trim()) {
          this.accessToken = refreshedToken.trim();
          result = await geminiModelService.generateChatResponse(
            priorHistory,
            promptText,
            lastUserMsg?.mode,
            systemInstruction,
            this.accessToken,
            undefined,
            attachmentPayloads
          );
        }
      }

      if (!result.success || !result.text?.trim()) {
        const aiErr = new Error(
          result.error || 'Angel could not reach the conversation service. Please try again.'
        ) as Error & { statusCode?: number; diagnostic?: Record<string, unknown> };
        aiErr.statusCode = result.statusCode;
        aiErr.diagnostic = {
          ...(result.diagnostic || {}),
          ...(result.requestId ? { requestId: result.requestId } : {}),
          ...(result.status ? { providerStatusLabel: result.status } : {}),
          threadId: thread.id,
          scope: thread.scope,
          model: result.modelUsed || geminiModelService.getCachedStatus().model,
        };
        throw aiErr;
      }

      responseText = result.text.trim();
      modelUsed = result.modelUsed;
      requestedModel = result.requestedModel;
      fallbackActivated = result.fallbackActivated;
      requestedMode = result.requestedMode || lastUserMsg?.mode;
      appliedMode = result.appliedMode;
      thinkingLevel = result.thinkingLevel;

      // Refine thread title via server AI endpoint on first completed turn when not custom-titled
      const userTurns = thread.messages.filter((m) => m.sender === 'user');
      if (!thread.isCustomTitle && userTurns.length === 1 && this.accessToken && typeof window !== 'undefined') {
        const tokenSnapshot = this.accessToken;
        void geminiModelService.generateTitle(promptText, tokenSnapshot).then((aiTitle) => {
          const current = this.threads.find((t) => t.id === thread.id);
          if (current && !current.isCustomTitle && aiTitle && aiTitle !== current.title) {
            current.title = aiTitle;
            current.updatedAt = new Date().toISOString();
            this.persist();
          }
        });
      }
    } catch (error) {
      status = 'failed';
      const errWithMeta = error as Error & {
        statusCode?: number;
        diagnostic?: Record<string, unknown>;
      };
      const rawMsg = error instanceof Error ? error.message : String(error || '');
      if (rawMsg.includes('Sign in to start a private conversation with Angel.')) {
        errorMessage = rawMsg;
      } else {
        errorMessage = toFriendlyError(error, 'ai', {
          statusCode: errWithMeta.statusCode,
          metadata: errWithMeta.diagnostic,
        }).userMessage;
      }
      responseText = errorMessage;
    } finally {
      this.inFlightThreads.delete(thread.id);
      this.notifyChange();
    }

    const assistantNow = new Date();
    const assistantMessage: ChatMessage = {
      id: createUniqueId('msg_ai'),
      sender: 'angel',
      content: responseText,
      timestamp: assistantNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: assistantNow.toISOString(),
      sequence: thread.messages.length,
      mode: lastUserMsg?.mode,
      status,
      error: errorMessage,
      modelUsed,
      requestedModel,
      fallbackActivated,
      requestedMode,
      appliedMode,
      thinkingLevel,
    };

    thread.messages.push(assistantMessage);
    thread.updatedAt = assistantNow.toISOString();
    this.persist();
    return assistantMessage;
  }

  searchHistory(query: string, scopeFilter?: ConversationScope): { thread: ConversationThread; matches: ChatMessage[] }[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const results: { thread: ConversationThread; matches: ChatMessage[] }[] = [];

    this.threads.forEach((thread) => {
      if (scopeFilter && thread.scope !== scopeFilter) return;
      const matches = thread.messages.filter(
        (m) => m.content.toLowerCase().includes(q) || thread.title.toLowerCase().includes(q)
      );
      if (matches.length > 0) {
        results.push({ thread, matches });
      }
    });

    return results;
  }

  exportThreadJSON(threadId: string): string {
    const thread = this.threads.find((t) => t.id === threadId) || this.getActiveThread('general');
    return JSON.stringify(thread, null, 2);
  }

  exportThreadMarkdown(threadId: string): string {
    const thread = this.threads.find((t) => t.id === threadId) || this.getActiveThread('general');
    let md = `# ${thread.title}\n*Scope: ${thread.scope} ${thread.studioId ? `(${thread.studioId})` : ''}*\n*Created: ${thread.createdAt}*\n\n---\n\n`;

    thread.messages.forEach((m) => {
      const role = m.sender.toUpperCase();
      md += `### ${role} (${m.timestamp})\n${m.content}\n\n`;
    });

    return md;
  }

  private formatStudioName(studioId?: StudioId): string {
    if (!studioId) return 'Studio';
    return studioId
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}

export const conversationEngine = new ConversationEngine();
