import { StudioId } from '../types/angel';
import { storageService } from './storageService';
import { libraryService, LibraryItem } from './libraryService';
import { companionData } from './companionData';

export type MemoryCategory = 'personal' | 'conversation' | 'project' | 'studio' | 'task' | 'knowledge' | 'temporary';
export type MemoryScope = 'general' | 'studio' | 'project';

export interface MemoryRecord {
  id: string;
  category: MemoryCategory;
  scope: MemoryScope;
  studioId?: StudioId;
  projectId?: string;
  title: string;
  content: string;
  tags?: string[];
  source?: string;
  timestamp: string;
  updatedAt: string;
  isSensitive?: boolean;
  conflictNote?: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  studioId?: StudioId;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEYS_MEMORY = {
  memories: 'angel_memory_records_v1',
  knowledge: 'angel_knowledge_library_v1',
  pendingSync: 'angel_memory_pending_sync_v1',
  pendingDeletes: 'angel_memory_pending_deletes_v1',
};

const BUILT_IN_SAMPLE_IDS = new Set(['mem_1', 'mem_2', 'mem_3']);

function buildMemorySemanticKey(m: MemoryRecord): string {
  return `${m.category}::${m.scope}::${m.studioId || ''}::${m.content.trim().toLowerCase()}`;
}

export class MemoryEngine {
  public memories: MemoryRecord[] = [];
  public knowledgeLibrary: KnowledgeItem[] = [];
  private accessToken: string | null = null;
  private activeUserId: string | null = null;
  private cloudHydrationToken: string | null = null;
  private pendingCloudSync = false;
  private pendingDeletes: string[] = [];
  private cloudSyncRunning = false;
  private cloudSyncQueued = false;
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

  private isBrowserOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private scopedKey(base: string): string {
    return this.activeUserId ? `${base}:user:${this.activeUserId}` : base;
  }

  private loadCurrentScope(): void {
    const loadedDeletes = storageService.load<string[]>(this.scopedKey(STORAGE_KEYS_MEMORY.pendingDeletes), []);
    this.pendingDeletes = Array.isArray(loadedDeletes) ? loadedDeletes : [];
    const pendingDeleteSet = new Set(this.pendingDeletes);

    this.pendingCloudSync = Boolean(
      storageService.load<boolean>(this.scopedKey(STORAGE_KEYS_MEMORY.pendingSync), false)
    ) || this.pendingDeletes.length > 0;

    const loadedMem = storageService.load<any>(this.scopedKey(STORAGE_KEYS_MEMORY.memories), []);
    this.memories = (Array.isArray(loadedMem) ? loadedMem : []).filter(
      (m: MemoryRecord) => m && m.id && !pendingDeleteSet.has(m.id)
    );

    const loadedKnow = storageService.load<any>(this.scopedKey(STORAGE_KEYS_MEMORY.knowledge), []);
    this.knowledgeLibrary = Array.isArray(loadedKnow) ? loadedKnow : [];
  }

  public getPendingSyncState(): { pendingCloudSync: boolean; pendingDeletes: string[] } {
    return {
      pendingCloudSync: this.pendingCloudSync,
      pendingDeletes: [...this.pendingDeletes],
    };
  }

  public setAuthContext(token: string | null, userId?: string | null): void {
    const nextUserId = token ? userId || null : null;
    const identityChanged = this.activeUserId !== nextUserId;
    this.accessToken = token;

    if (identityChanged) {
      this.activeUserId = nextUserId;
      this.cloudHydrationToken = null;
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

  public async reconcileOnReconnect(): Promise<void> {
    if (this.isBrowserOffline()) return;
    if (!this.accessToken || !this.activeUserId || !companionData.isCloudConfigured()) return;
    if (this.pendingCloudSync || this.pendingDeletes.length > 0) {
      await this.syncCloud();
    }
    await this.restoreCloud(this.accessToken);
  }

  private async flushPendingDeletes(token: string): Promise<void> {
    if (!this.pendingDeletes.length || !companionData.isCloudConfigured() || this.isBrowserOffline()) return;
    const remaining: string[] = [];
    for (const deletedId of this.pendingDeletes) {
      try {
        await companionData.deleteMemory(token, deletedId);
      } catch {
        remaining.push(deletedId);
      }
    }
    if (remaining.length !== this.pendingDeletes.length) {
      this.pendingDeletes = remaining;
      storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.pendingDeletes), this.pendingDeletes);
    }
    if (this.pendingDeletes.length > 0) {
      throw new Error('Pending memory deletions could not be synced yet.');
    }
  }

  private async syncCloud(): Promise<void> {
    if (!this.accessToken || !this.activeUserId || !companionData.isCloudConfigured()) return;
    if (this.isBrowserOffline()) {
      this.pendingCloudSync = true;
      storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.pendingSync), true);
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
        if (this.memories.length > 0) {
          await companionData.syncMemories(token, this.memories, ownerId);
        }
      } while (this.cloudSyncQueued && this.accessToken);
      this.pendingCloudSync = false;
      storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.pendingSync), false);
    } catch (error) {
      this.pendingCloudSync = true;
      storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.pendingSync), true);
      companionData.reportEngineSyncError('companion_memories', error, {
        errorCode: 'MEMORY_PERSISTENCE_FAILED',
        endpoint: '/rest/v1/companion_memories',
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

      const rawCloudMemories = await companionData.loadMemories(token);
      if (this.accessToken !== token || this.activeUserId !== ownerId) return;

      const cloudMemories = rawCloudMemories.filter((m) => !pendingDeleteSet.has(m.id));
      const byId = new Map<string, MemoryRecord>();
      const cloudIds = new Set<string>();
      const semanticToId = new Map<string, string>();
      let needsCloudPush = this.pendingCloudSync || this.pendingDeletes.length > 0;

      cloudMemories.forEach((m) => {
        byId.set(m.id, m);
        cloudIds.add(m.id);
        semanticToId.set(buildMemorySemanticKey(m), m.id);
      });

      this.memories.forEach((local) => {
        if (pendingDeleteSet.has(local.id)) return;
        const existingById = byId.get(local.id);
        if (existingById) {
          if ((local.updatedAt || '') > (existingById.updatedAt || '')) {
            byId.set(local.id, local);
            needsCloudPush = true;
          }
          return;
        }
        const semanticMatchId = semanticToId.get(buildMemorySemanticKey(local));
        if (semanticMatchId) {
          const existingSemantic = byId.get(semanticMatchId)!;
          if ((local.updatedAt || '') > (existingSemantic.updatedAt || '')) {
            byId.set(semanticMatchId, { ...local, id: semanticMatchId });
            needsCloudPush = true;
          }
          return;
        }
        if (!cloudIds.has(local.id)) {
          needsCloudPush = true;
          byId.set(local.id, local);
          semanticToId.set(buildMemorySemanticKey(local), local.id);
        }
      });

      this.memories = Array.from(byId.values()).sort((a, b) =>
        (b.updatedAt || b.timestamp).localeCompare(a.updatedAt || a.timestamp)
      );
      this.persist(false);

      if (needsCloudPush) {
        await this.syncCloud();
      }
    } catch (error) {
      companionData.reportEngineSyncError('companion_memories', error, {
        errorCode: 'MEMORY_PERSISTENCE_FAILED',
        endpoint: '/rest/v1/companion_memories',
        method: 'GET',
      });
    }
  }

  private persist(syncToCloud = true): boolean {
    if (syncToCloud && this.accessToken && this.activeUserId && companionData.isCloudConfigured() && this.isBrowserOffline()) {
      this.pendingCloudSync = true;
    }
    const savedMem = storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.memories), this.memories);
    const savedKnow = storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.knowledge), this.knowledgeLibrary);
    storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.pendingSync), this.pendingCloudSync);
    storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.pendingDeletes), this.pendingDeletes);
    if (!savedMem || !savedKnow) {
      console.error('[MemoryEngine] Storage persistence failed');
      return false;
    }

    if (syncToCloud && this.accessToken && this.activeUserId && companionData.isCloudConfigured() && !this.isBrowserOffline()) {
      void this.syncCloud();
    }
    return true;
  }

  // --- MEMORY OPERATIONS ---

  saveMemory(record: Omit<MemoryRecord, 'id' | 'timestamp' | 'updatedAt'>): MemoryRecord {
    const duplicate = this.detectDuplicates(record.content, record.category, record.scope, record.studioId);
    if (duplicate) {
      duplicate.content = record.content;
      duplicate.title = record.title || duplicate.title;
      duplicate.updatedAt = new Date().toISOString();
      if (!this.persist()) {
        throw new Error('Failed to persist memory update to local storage.');
      }
      return duplicate;
    }

    const conflict = this.detectConflicts(record.content, record.title, record.category, record.scope, record.studioId);
    let conflictNote: string | undefined = undefined;
    if (conflict) {
      conflictNote = `Conflicting information detected with memory ID: ${conflict.id} ("${conflict.title}").`;
    }

    const newRecord: MemoryRecord = {
      ...record,
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      conflictNote,
    };

    this.memories.unshift(newRecord);
    if (!this.persist()) {
      this.memories.shift();
      throw new Error('Failed to persist new memory record to local storage.');
    }
    return newRecord;
  }

  getMemories(category?: MemoryCategory, scope?: MemoryScope, studioId?: StudioId): MemoryRecord[] {
    return this.memories.filter((m) => {
      if (category && m.category !== category) return false;
      if (scope && m.scope !== scope) return false;
      if (studioId && m.studioId && m.studioId !== studioId) return false;
      return true;
    });
  }

  updateMemory(id: string, updates: Partial<MemoryRecord>): MemoryRecord | null {
    const mem = this.memories.find((m) => m.id === id);
    if (!mem) return null;

    Object.assign(mem, updates, { updatedAt: new Date().toISOString() });
    if (!this.persist()) {
      throw new Error(`Failed to persist updates for memory '${id}'.`);
    }
    return mem;
  }

  deleteMemory(id: string): boolean {
    const len = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    if (this.memories.length < len) {
      if (!this.pendingDeletes.includes(id)) {
        this.pendingDeletes.push(id);
      }
      if (this.accessToken && companionData.isCloudConfigured() && !this.isBrowserOffline()) {
        const tokenSnapshot = this.accessToken;
        this.persist(false);
        void companionData
          .deleteMemory(tokenSnapshot, id)
          .then(() => {
            this.pendingDeletes = this.pendingDeletes.filter((item) => item !== id);
            storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.pendingDeletes), this.pendingDeletes);
          })
          .catch((error) => {
            this.pendingCloudSync = true;
            storageService.save(this.scopedKey(STORAGE_KEYS_MEMORY.pendingSync), true);
            console.warn('[MemoryEngine] Cloud delete deferred:', error);
          });
      } else {
        this.pendingCloudSync = Boolean(this.accessToken);
        if (!this.persist(false)) {
          throw new Error(`Failed to persist deletion of memory '${id}'.`);
        }
      }
      return true;
    }
    return false;
  }

  cleanupSampleRecords(): number {
    const beforeCount = this.memories.length;
    this.memories = this.memories.filter((m) => !BUILT_IN_SAMPLE_IDS.has(m.id));
    const removed = beforeCount - this.memories.length;
    if (removed > 0) {
      this.persist();
    }
    return removed;
  }

  searchMemories(query: string, category?: MemoryCategory, studioId?: StudioId): MemoryRecord[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return this.memories.filter((m) => {
      if (category && m.category !== category) return false;
      if (studioId && m.studioId && m.studioId !== studioId) return false;
      return (
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q) ||
        (m.tags && m.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }

  detectDuplicates(content: string, category: MemoryCategory, scope?: MemoryScope, studioId?: StudioId): MemoryRecord | null {
    const normalized = content.trim().toLowerCase();
    return (
      this.memories.find((m) => {
        if (m.category !== category) return false;
        if (scope && m.scope !== scope) return false;
        if (studioId && m.studioId !== studioId) return false;
        return m.content.trim().toLowerCase() === normalized;
      }) || null
    );
  }

  detectConflicts(
    content: string,
    title: string,
    category: MemoryCategory,
    scope?: MemoryScope,
    studioId?: StudioId
  ): MemoryRecord | null {
    const normalizedContent = content.trim().toLowerCase();
    const normalizedTitle = title.trim().toLowerCase();

    return (
      this.memories.find((m) => {
        if (m.category !== category) return false;
        if (scope && m.scope !== scope) return false;
        if (studioId && m.studioId !== studioId) return false;
        if (m.content.trim().toLowerCase() === normalizedContent) return false;

        const mTitle = m.title.trim().toLowerCase();
        const sharesSubject =
          mTitle === normalizedTitle ||
          (mTitle.includes('language') && normalizedTitle.includes('language')) ||
          (mTitle.includes('tone') && normalizedTitle.includes('tone')) ||
          (mTitle.includes('style') && normalizedTitle.includes('style'));

        const hasContradictionIndicator =
          normalizedContent.includes('exclusively') ||
          normalizedContent.includes('instead') ||
          normalizedContent.includes('never') ||
          normalizedContent.includes('different') ||
          normalizedContent.includes('not');

        return sharesSubject || hasContradictionIndicator;
      }) || null
    );
  }

  // --- KNOWLEDGE LIBRARY OPERATIONS (COMPATIBILITY ADAPTER DELEGATING TO LIBRARY SERVICE) ---

  saveKnowledge(item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): KnowledgeItem {
    const libItem = libraryService.addItem({
      type: 'knowledge',
      name: item.title,
      description: item.category || 'Knowledge Record',
      content: item.content,
      tags: item.tags || [],
      collection: item.category || 'General Knowledge',
      studioId: item.studioId,
      projectId: item.projectId,
    });

    return {
      id: libItem.id,
      title: libItem.name,
      content: libItem.content,
      category: item.category || 'General Knowledge',
      tags: libItem.tags,
      studioId: libItem.studioId,
      projectId: libItem.projectId,
      createdAt: libItem.createdAt,
      updatedAt: libItem.updatedAt,
    };
  }

  getKnowledgeList(studioId?: StudioId): KnowledgeItem[] {
    const items = libraryService.getItems(undefined, studioId);
    return items.map((i) => ({
      id: i.id,
      title: i.name,
      content: i.content,
      category: i.collection || i.type,
      tags: i.tags,
      studioId: i.studioId,
      projectId: i.projectId,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));
  }

  updateKnowledge(id: string, updates: Partial<KnowledgeItem>): KnowledgeItem | null {
    const libUpdates: Partial<LibraryItem> = {};
    if (updates.title) libUpdates.name = updates.title;
    if (updates.content) libUpdates.content = updates.content;
    if (updates.tags) libUpdates.tags = updates.tags;
    if (updates.studioId !== undefined) libUpdates.studioId = updates.studioId;
    if (updates.projectId !== undefined) libUpdates.projectId = updates.projectId;
    if (updates.category) libUpdates.collection = updates.category;

    const updated = libraryService.updateItem(id, libUpdates);
    if (!updated) return null;

    return {
      id: updated.id,
      title: updated.name,
      content: updated.content,
      category: updated.collection || updated.type,
      tags: updated.tags,
      studioId: updated.studioId,
      projectId: updated.projectId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  deleteKnowledge(id: string): boolean {
    return libraryService.deleteItem(id);
  }

  searchKnowledge(query: string, studioId?: StudioId): KnowledgeItem[] {
    const items = libraryService.searchItems(query, undefined, studioId);
    return items.map((i) => ({
      id: i.id,
      title: i.name,
      content: i.content,
      category: i.collection || i.type,
      tags: i.tags,
      studioId: i.studioId,
      projectId: i.projectId,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }));
  }

  // --- INTELLIGENT CONTEXT RETRIEVAL FOR PROMPT ENGINE ---

  retrieveContextForPrompt(promptText: string, scope: 'general' | 'studio', studioId?: StudioId): string {
    const relevantMemories = this.memories.filter((m) => {
      if (scope === 'studio') {
        if (m.scope === 'studio') {
          return m.studioId === studioId;
        }
        return m.scope === 'general';
      }
      return m.scope === 'general';
    });

    const keywords = promptText.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const scored = relevantMemories.map((m) => {
      let score = 0;
      const text = `${m.title} ${m.content} ${m.tags?.join(' ')}`.toLowerCase();
      keywords.forEach((kw) => {
        if (text.includes(kw)) score += 2;
      });
      return { mem: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMemories = scored
      .filter((s) => s.score > 0)
      .slice(0, 3)
      .map((s) => `- [${s.mem.category.toUpperCase()}] ${s.mem.title}: ${s.mem.content}`);

    if (topMemories.length === 0) return '';
    return `\n[Retrieved Memory Context]:\n${topMemories.join('\n')}\n`;
  }
}

export const memoryEngine = new MemoryEngine();
