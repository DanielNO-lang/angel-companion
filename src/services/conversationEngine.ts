import { ChatMessage, StudioId } from '../types/angel';
import { storageService, STORAGE_KEYS } from './storageService';
import { memoryEngine } from './memoryEngine';
import { companionData } from './companionData';
import { extractIntelligentTitle, geminiModelService } from './geminiModelService';
import { toFriendlyError } from './errorHandlingService';
import {
  loadRecentConversationsFromCache,
  mergeConversationSnapshots,
  pruneThreadsForLocalCache,
  readSnapshotFromCacheStorage,
  saveRecentConversationsToCache,
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
  private lastCachedAt: string | null = null;
  private onlineSyncBound = false;

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
    const loaded = storageService.load<ConversationThread[]>(
      this.scopedKey(STORAGE_KEYS.conversations),
      DEFAULT_CONVERSATIONS
    );
    const primaryThreads = pruneThreadsForLocalCache(Array.isArray(loaded) ? loaded : []);
    const cachedSnapshot = loadRecentConversationsFromCache(scopeKey);

    if (cachedSnapshot) {
      this.pendingCloudSync = cachedSnapshot.pendingCloudSync;
      this.lastCachedAt = cachedSnapshot.cachedAt;
    } else {
      this.pendingCloudSync = false;
      this.lastCachedAt = null;
    }

    this.threads = cachedSnapshot?.threads.length
      ? mergeConversationSnapshots(primaryThreads, cachedSnapshot.threads)
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

    const merged = mergeConversationSnapshots(this.threads, swSnapshot.threads);
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

  private persist(): void {
    const scopeKey = this.cacheScopeKey();
    const shouldDeferCloud =
      Boolean(this.accessToken && companionData.isCloudConfigured()) && this.isBrowserOffline();
    if (shouldDeferCloud) {
      this.pendingCloudSync = true;
    }

    storageService.save(this.scopedKey(STORAGE_KEYS.conversations), this.threads);
    storageService.save(this.scopedKey(STORAGE_KEYS.activeConversationId), this.activeGeneralId);
    storageService.save(this.scopedKey('angel_active_studio_convs_v1'), this.activeStudioIds);

    const snapshot = saveRecentConversationsToCache(scopeKey, this.threads, this.pendingCloudSync);
    this.lastCachedAt = snapshot.cachedAt;
    void writeSnapshotToCacheStorage(snapshot);

    this.notifyChange();
    if (this.accessToken && companionData.isCloudConfigured() && !this.isBrowserOffline()) {
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

  public isGenerating(threadId: string): boolean {
    return this.inFlightThreads.has(threadId);
  }

  private async syncCloud(): Promise<void> {
    if (!this.accessToken || !this.activeUserId || !companionData.isCloudConfigured()) return;
    if (this.isBrowserOffline()) {
      this.pendingCloudSync = true;
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
        await companionData.syncThreads(token, this.threads, ownerId);
      } while (this.cloudSyncQueued && this.accessToken);
      this.pendingCloudSync = false;
      const snapshot = saveRecentConversationsToCache(this.cacheScopeKey(), this.threads, false);
      this.lastCachedAt = snapshot.cachedAt;
      void writeSnapshotToCacheStorage(snapshot);
    } catch (error) {
      this.pendingCloudSync = true;
      console.warn('[ConversationEngine] Cloud sync deferred:', error);
    } finally {
      this.cloudSyncRunning = false;
    }
  }

  private async restoreCloud(token: string): Promise<void> {
    const ownerId = this.activeUserId;
    if (!ownerId || !companionData.isCloudConfigured() || this.isBrowserOffline()) return;
    try {
      const cloudThreads = await companionData.loadThreads(token);
      if (this.accessToken !== token || this.activeUserId !== ownerId) return;

      const localById = new Map(this.threads.map((thread) => [thread.id, thread]));
      const restored = cloudThreads.map((cloud) => {
        const local = localById.get(cloud.id);
        if (!local) return cloud;
        const messageMap = new Map<string, ChatMessage>();
        [...cloud.messages, ...local.messages].forEach((message) => messageMap.set(message.id, message));
        return {
          ...cloud,
          ...local,
          messages: Array.from(messageMap.values()),
          updatedAt: local.updatedAt > cloud.updatedAt ? local.updatedAt : cloud.updatedAt,
        };
      });

      const cloudIds = new Set(cloudThreads.map((thread) => thread.id));
      const localOnly = this.threads.filter((thread) => !cloudIds.has(thread.id));
      this.threads = [...restored, ...localOnly].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      this.persist();
    } catch (error) {
      console.warn('[ConversationEngine] Cloud restore deferred:', error);
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
      if (this.accessToken && companionData.isCloudConfigured()) {
        void companionData.deleteThread(this.accessToken, id).catch((error) => {
          console.warn('[ConversationEngine] Cloud thread delete deferred:', error);
        });
      }
      this.persist();
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

    const userMessage: ChatMessage = {
      id: createUniqueId('msg'),
      sender,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode,
      attachments,
      attachmentDetails,
      linkPreviews,
      status: 'completed',
    };

    thread.messages.push(userMessage);
    thread.updatedAt = new Date().toISOString();

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
    const lastUserMsg = [...thread.messages].reverse().find((message) => message.sender === 'user');
    const promptText = lastUserMsg?.content || 'Hello';

    let responseText = '';
    let status: 'completed' | 'failed' = 'completed';
    let errorMessage: string | undefined;
    let modelUsed: string | undefined;
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

      // Include valid prior turns only (exclude failed/unsent placeholders) and avoid duplicating promptText
      const validHistory = thread.messages
        .filter(
          (message) =>
            (message.sender === 'user' || message.sender === 'angel') &&
            message.status !== 'failed' &&
            message.status !== 'unsent'
        )
        .slice(-30);

      const priorHistory =
        validHistory.length > 0 && validHistory[validHistory.length - 1].sender === 'user'
          ? validHistory.slice(0, -1)
          : validHistory;

      const systemInstruction = [
        'You are Angel, a thoughtful, natural, capable Universal Personal AI Companion.',
        'Respond directly, accurately and conversationally. Respect the full conversation history.',
        `Current Angel environment: ${thread.scope === 'studio' ? this.formatStudioName(thread.studioId) : 'General Conversation'}.`,
        thread.scope === 'studio'
          ? 'Stay aware of the specialised studio context while remaining able to explain your reasoning.'
          : 'Do not force the user into a project, workspace, or studio unless they ask.',
        memoryContext ? `Relevant user context available for this conversation:\n${memoryContext}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const result = await geminiModelService.generateChatResponse(
        priorHistory,
        promptText,
        lastUserMsg?.mode,
        systemInstruction,
        this.accessToken
      );

      if (!result.success || !result.text?.trim()) {
        throw new Error(result.error || 'Angel could not reach the conversation service. Please try again.');
      }

      responseText = result.text.trim();
      modelUsed = result.modelUsed;
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
      const rawMsg = error instanceof Error ? error.message : String(error || '');
      if (rawMsg.includes('Sign in to start a private conversation with Angel.')) {
        errorMessage = rawMsg;
      } else {
        errorMessage = toFriendlyError(error, 'ai').userMessage;
      }
      responseText = errorMessage;
    } finally {
      this.inFlightThreads.delete(thread.id);
    }

    const assistantMessage: ChatMessage = {
      id: createUniqueId('msg_ai'),
      sender: 'angel',
      content: responseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode: lastUserMsg?.mode,
      status,
      error: errorMessage,
      modelUsed,
      requestedMode,
      appliedMode,
      thinkingLevel,
    };

    thread.messages.push(assistantMessage);
    thread.updatedAt = new Date().toISOString();
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
