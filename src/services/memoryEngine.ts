import { StudioId } from '../types/angel';
import { storageService } from './storageService';

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

const DEFAULT_MEMORIES: MemoryRecord[] = [
  {
    id: 'mem_1',
    category: 'personal',
    scope: 'general',
    title: 'Preferred Tone & Style',
    content: 'User prefers concise, professional, and clear explanations with practical TypeScript code examples.',
    tags: ['preference', 'style'],
    source: 'User Prompt',
    timestamp: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem_2',
    category: 'studio',
    scope: 'studio',
    studioId: 'development-studio',
    title: 'TypeScript AST Conventions',
    content: 'Always strict type checking, use functional patterns, and avoid any casts where possible.',
    tags: ['typescript', 'development'],
    source: 'Development Studio Session',
    timestamp: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'mem_3',
    category: 'studio',
    scope: 'studio',
    studioId: 'research-studio',
    title: 'Academic Citation Format',
    content: 'Use IEEE citation formatting for all literature summaries and research synthesis.',
    tags: ['citations', 'research'],
    source: 'Research Studio Session',
    timestamp: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_KNOWLEDGE: KnowledgeItem[] = [
  {
    id: 'know_1',
    title: 'React 19 & Vite Architecture Guide',
    content: 'Comprehensive reference for client-side routing, Tailwind CSS styling, and high performance state management.',
    category: 'Engineering Reference',
    tags: ['react', 'vite', 'architecture'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class MemoryEngine {
  public memories: MemoryRecord[];
  public knowledgeLibrary: KnowledgeItem[];

  constructor() {
    const loadedMem = storageService.load<any>(STORAGE_KEYS_MEMORY.memories, DEFAULT_MEMORIES);
    this.memories = Array.isArray(loadedMem) ? loadedMem : DEFAULT_MEMORIES;

    const loadedKnow = storageService.load<any>(STORAGE_KEYS_MEMORY.knowledge, DEFAULT_KNOWLEDGE);
    this.knowledgeLibrary = Array.isArray(loadedKnow) ? loadedKnow : DEFAULT_KNOWLEDGE;
  }

  private persist() {
    try {
      storageService.save(STORAGE_KEYS_MEMORY.memories, this.memories);
      storageService.save(STORAGE_KEYS_MEMORY.knowledge, this.knowledgeLibrary);
    } catch (err) {
      console.error('[MemoryEngine] Persistence error:', err);
    }
  }

  // --- MEMORY OPERATIONS ---

  saveMemory(record: Omit<MemoryRecord, 'id' | 'timestamp' | 'updatedAt'>): MemoryRecord {
    const duplicate = this.detectDuplicates(record.content, record.category);
    if (duplicate) {
      duplicate.content = record.content;
      duplicate.title = record.title || duplicate.title;
      duplicate.updatedAt = new Date().toISOString();
      this.persist();
      return duplicate;
    }

    const conflict = this.detectConflicts(record.content, record.category);
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
    this.persist();
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
    this.persist();
    return mem;
  }

  deleteMemory(id: string): boolean {
    const len = this.memories.length;
    this.memories = this.memories.filter((m) => m.id !== id);
    if (this.memories.length < len) {
      this.persist();
      return true;
    }
    return false;
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

  detectDuplicates(content: string, category: MemoryCategory): MemoryRecord | null {
    const normalized = content.trim().toLowerCase();
    return this.memories.find((m) => m.category === category && m.content.trim().toLowerCase() === normalized) || null;
  }

  detectConflicts(content: string, category: MemoryCategory): MemoryRecord | null {
    const normalized = content.trim().toLowerCase();
    return this.memories.find((m) => m.category === category && m.content.trim().toLowerCase() !== normalized && m.category === 'personal') || null;
  }

  // --- KNOWLEDGE LIBRARY OPERATIONS ---

  saveKnowledge(item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): KnowledgeItem {
    const newItem: KnowledgeItem = {
      ...item,
      id: `know_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.knowledgeLibrary.unshift(newItem);
    this.persist();
    return newItem;
  }

  getKnowledgeList(studioId?: StudioId): KnowledgeItem[] {
    if (!studioId) return this.knowledgeLibrary;
    return this.knowledgeLibrary.filter((k) => !k.studioId || k.studioId === studioId);
  }

  updateKnowledge(id: string, updates: Partial<KnowledgeItem>): KnowledgeItem | null {
    const item = this.knowledgeLibrary.find((k) => k.id === id);
    if (!item) return null;
    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    this.persist();
    return item;
  }

  deleteKnowledge(id: string): boolean {
    const len = this.knowledgeLibrary.length;
    this.knowledgeLibrary = this.knowledgeLibrary.filter((k) => k.id !== id);
    if (this.knowledgeLibrary.length < len) {
      this.persist();
      return true;
    }
    return false;
  }

  searchKnowledge(query: string, studioId?: StudioId): KnowledgeItem[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return this.knowledgeLibrary.filter((k) => {
      if (studioId && k.studioId && k.studioId !== studioId) return false;
      return k.title.toLowerCase().includes(q) || k.content.toLowerCase().includes(q) || k.tags.some(t => t.toLowerCase().includes(q));
    });
  }

  // --- INTELLIGENT CONTEXT RETRIEVAL FOR PROMPT ENGINE ---

  retrieveContextForPrompt(promptText: string, scope: 'general' | 'studio', studioId?: StudioId): string {
    const relevantMemories = this.memories.filter((m) => {
      if (scope === 'studio') {
        if (m.scope === 'studio' && m.studioId && m.studioId !== studioId) return false;
      }
      return true;
    });

    const keywords = promptText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const scored = relevantMemories.map((m) => {
      let score = 0;
      const text = `${m.title} ${m.content} ${m.tags?.join(' ')}`.toLowerCase();
      keywords.forEach((kw) => {
        if (text.includes(kw)) score += 1;
      });
      if (m.category === 'personal') score += 2;
      return { mem: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const topMemories = scored.filter(s => s.score > 0).slice(0, 3).map(s => `- [${s.mem.category.toUpperCase()}] ${s.mem.title}: ${s.mem.content}`);

    if (topMemories.length === 0) return '';
    return `\n[Retrieved Memory Context]:\n${topMemories.join('\n')}\n`;
  }
}

export const memoryEngine = new MemoryEngine();
