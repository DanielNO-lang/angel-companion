import { StudioId } from '../types/angel';
import { storageService } from './storageService';
import { libraryService, LibraryItem } from './libraryService';

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
};

// Built-in starter templates cleanly separated so genuine user memories are preserved
// and identifiable built-in samples can be safely cleaned up without deleting genuine user data
const BUILT_IN_SAMPLE_IDS = new Set(['mem_1', 'mem_2', 'mem_3']);

export class MemoryEngine {
  public memories: MemoryRecord[];
  public knowledgeLibrary: KnowledgeItem[];

  constructor() {
    const loadedMem = storageService.load<any>(STORAGE_KEYS_MEMORY.memories, []);
    this.memories = Array.isArray(loadedMem) ? loadedMem : [];

    const loadedKnow = storageService.load<any>(STORAGE_KEYS_MEMORY.knowledge, []);
    this.knowledgeLibrary = Array.isArray(loadedKnow) ? loadedKnow : [];
  }

  private persist(): boolean {
    const savedMem = storageService.save(STORAGE_KEYS_MEMORY.memories, this.memories);
    const savedKnow = storageService.save(STORAGE_KEYS_MEMORY.knowledge, this.knowledgeLibrary);
    if (!savedMem || !savedKnow) {
      console.error('[MemoryEngine] Storage persistence failed');
      return false;
    }
    return true;
  }

  // --- MEMORY OPERATIONS ---

  saveMemory(record: Omit<MemoryRecord, 'id' | 'timestamp' | 'updatedAt'>): MemoryRecord {
    // 1. Detect duplicates within the same scope and category
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

    // 2. Detect actual semantic conflicts (only when claims directly contradict on subject matter)
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
      // Rollback
      this.memories.shift();
      throw new Error('Failed to persist new memory record to local storage.');
    }
    return newRecord;
  }

  getMemories(category?: MemoryCategory, scope?: MemoryScope, studioId?: StudioId): MemoryRecord[] {
    return this.memories.filter((m) => {
      if (category && m.category !== category) return false;
      if (scope && m.scope !== scope) return false;
      // Strict Studio memory isolation: a Studio only accesses its own memories
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
      if (!this.persist()) {
        throw new Error(`Failed to persist deletion of memory '${id}'.`);
      }
      return true;
    }
    return false;
  }

  /**
   * Safely removes only identifiable built-in sample records,
   * leaving genuine user-created memories completely intact.
   */
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
      const matchesText = m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q) || (m.tags && m.tags.some(t => t.toLowerCase().includes(q)));
      return matchesText;
    });
  }

  detectDuplicates(content: string, category: MemoryCategory, scope?: MemoryScope, studioId?: StudioId): MemoryRecord | null {
    const normalized = content.trim().toLowerCase();
    return this.memories.find((m) => {
      if (m.category !== category) return false;
      if (scope && m.scope !== scope) return false;
      if (studioId && m.studioId !== studioId) return false;
      return m.content.trim().toLowerCase() === normalized;
    }) || null;
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

    // Check only within same category and scope
    return this.memories.find((m) => {
      if (m.category !== category) return false;
      if (scope && m.scope !== scope) return false;
      if (studioId && m.studioId !== studioId) return false;

      // Exact duplicate is handled by detectDuplicates, not a conflict
      if (m.content.trim().toLowerCase() === normalizedContent) return false;

      // Check subject collision (e.g. matching title or shared key subject tokens)
      const mTitle = m.title.trim().toLowerCase();
      const sharesSubject = mTitle === normalizedTitle ||
        (mTitle.includes('language') && normalizedTitle.includes('language')) ||
        (mTitle.includes('tone') && normalizedTitle.includes('tone')) ||
        (mTitle.includes('style') && normalizedTitle.includes('style'));

      // Check contradictory phrasing (e.g. "exclusively", "never", "only", "different")
      const hasContradictionIndicator =
        normalizedContent.includes('exclusively') ||
        normalizedContent.includes('instead') ||
        normalizedContent.includes('never') ||
        normalizedContent.includes('different') ||
        normalizedContent.includes('not');

      return sharesSubject || hasContradictionIndicator;
    }) || null;
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
        // Strict Studio isolation: Studios do NOT access private memories of other Studios
        if (m.scope === 'studio') {
          return m.studioId === studioId;
        }
        // General memories only shared if global/general scope
        return m.scope === 'general';
      }
      // General Conversation only accesses general scope memories
      return m.scope === 'general';
    });

    const keywords = promptText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const scored = relevantMemories.map((m) => {
      let score = 0;
      const text = `${m.title} ${m.content} ${m.tags?.join(' ')}`.toLowerCase();
      keywords.forEach((kw) => {
        if (text.includes(kw)) score += 2;
      });
      return { mem: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMemories = scored.filter(s => s.score > 0).slice(0, 3).map(s => `- [${s.mem.category.toUpperCase()}] ${s.mem.title}: ${s.mem.content}`);

    if (topMemories.length === 0) return '';
    return `\n[Retrieved Memory Context]:\n${topMemories.join('\n')}\n`;
  }
}

export const memoryEngine = new MemoryEngine();
