import { StudioId } from '../types/angel';
import { storageService, STORAGE_KEYS } from './storageService';

export type LibraryCategory =
  | 'documents'
  | 'knowledge'
  | 'references'
  | 'media'
  | 'code'
  | 'bookmarks'
  | 'templates'
  | 'other';

export interface LibraryItem {
  id: string;
  type: LibraryCategory;
  name: string;
  description?: string;
  content: string;
  mimeType?: string;
  fileUrl?: string;
  fileSize?: number;
  tags: string[];
  collection?: string;
  projectId?: string;
  studioId?: StudioId;
  createdAt: string;
  updatedAt: string;
  status: 'ready' | 'processing' | 'error';
  metadata?: Record<string, any>;
}

const STORAGE_KEY_LIBRARY = 'angel_library_items_v1';
const LEGACY_KNOWLEDGE_KEY = 'angel_knowledge_library_v1';

const DEFAULT_LIBRARY_ITEMS: LibraryItem[] = [
  {
    id: 'lib_doc_1',
    type: 'documents',
    name: 'Angel System Design Specification.md',
    description: 'Core architectural design document for Angel AI application modules',
    content: '# Angel AI Specification\n\nComprehensive architectural overview of four core functional pillars: Studios, Adaptive Workspace, Workspace, and Library.',
    mimeType: 'text/markdown',
    fileSize: 2048,
    tags: ['architecture', 'specification', 'core'],
    collection: 'System Docs',
    projectId: 'proj_default',
    studioId: 'development-studio',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
  },
  {
    id: 'lib_know_1',
    type: 'knowledge',
    name: 'Quantum Entanglement & Superposition Principles',
    description: 'Summary notes on quantum state correlations and Bell inequalities',
    content: 'Quantum entanglement is a physical phenomenon occurring when a group of particles interact in ways such that the quantum state of each particle cannot be described independently of the state of the others.',
    mimeType: 'text/plain',
    fileSize: 1024,
    tags: ['physics', 'quantum', 'research'],
    collection: 'Scientific Notes',
    studioId: 'research-studio',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
  },
  {
    id: 'lib_ref_1',
    type: 'references',
    name: 'arXiv Quantum Computing Papers Index',
    description: 'Curated scientific bibliography and research references',
    content: '1. Nielsen & Chuang - Quantum Computation and Quantum Information\n2. Preskill - Quantum Computing in the NISQ era and beyond',
    mimeType: 'text/plain',
    fileSize: 512,
    tags: ['arxiv', 'bibliography', 'citations'],
    collection: 'Research References',
    studioId: 'research-studio',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
  },
  {
    id: 'lib_code_1',
    type: 'code',
    name: 'TypeScript Event Bus Utility Pattern.ts',
    description: 'Reusable strongly-typed publish-subscribe event emitter',
    content: 'export class AngelEventBus {\n  private listeners = new Map<string, Function[]>();\n}',
    mimeType: 'text/typescript',
    fileSize: 768,
    tags: ['typescript', 'patterns', 'eventbus'],
    collection: 'Code Resources',
    studioId: 'development-studio',
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
  },
  {
    id: 'lib_template_1',
    type: 'templates',
    name: 'Executive Briefing Prompt Template',
    description: 'Standard prompt template for strategic summary generation',
    content: 'Provide a 3-paragraph executive summary detailing key objectives, risk assessments, and implementation timeline for: {{topic}}',
    mimeType: 'text/plain',
    fileSize: 256,
    tags: ['template', 'executive', 'prompt'],
    collection: 'Prompts & Templates',
    studioId: 'professional-intelligence-studio',
    createdAt: new Date(Date.now() - 432000000).toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'ready',
  },
];

export class LibraryService {
  private items: LibraryItem[];

  constructor() {
    // 1. Load existing items or initialize with defaults
    const loaded = storageService.load<LibraryItem[]>(STORAGE_KEY_LIBRARY, DEFAULT_LIBRARY_ITEMS);
    this.items = Array.isArray(loaded) ? loaded : [...DEFAULT_LIBRARY_ITEMS];

    // 2. Perform safe, versioned migration from legacy memory knowledge items
    this.migrateLegacyKnowledgeRecords();
  }

  private persist(): boolean {
    return storageService.save(STORAGE_KEY_LIBRARY, this.items);
  }

  /**
   * Versioned Migration: Safely imports legacy knowledge records out of Memory storage
   * into the independent Library service without deleting genuine user memories
   * or creating duplicate records on repeat runs.
   */
  public migrateLegacyKnowledgeRecords(): number {
    const legacyKnow = storageService.load<any[]>(LEGACY_KNOWLEDGE_KEY, []);
    if (!Array.isArray(legacyKnow) || legacyKnow.length === 0) {
      return 0;
    }

    let migratedCount = 0;
    legacyKnow.forEach((kItem) => {
      if (!kItem || !kItem.id || !kItem.title) return;

      const existing = this.items.find((item) => item.id === kItem.id || (item.name === kItem.title && item.content === kItem.content));
      if (!existing) {
        const newItem: LibraryItem = {
          id: kItem.id || `lib_migrated_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: this.mapCategoryToType(kItem.category),
          name: kItem.title,
          description: `Migrated from Knowledge Library (${kItem.category || 'General'})`,
          content: kItem.content || '',
          mimeType: 'text/plain',
          tags: Array.isArray(kItem.tags) ? kItem.tags : [],
          collection: kItem.category || 'Migrated Knowledge',
          studioId: kItem.studioId,
          projectId: kItem.projectId,
          createdAt: kItem.createdAt || new Date().toISOString(),
          updatedAt: kItem.updatedAt || new Date().toISOString(),
          status: 'ready',
        };
        this.items.push(newItem);
        migratedCount++;
      }
    });

    if (migratedCount > 0) {
      this.persist();
      console.log(`[LibraryService] Safely migrated ${migratedCount} legacy knowledge items to central Library.`);
    }

    return migratedCount;
  }

  private mapCategoryToType(cat?: string): LibraryCategory {
    if (!cat) return 'knowledge';
    const lower = cat.toLowerCase();
    if (lower.includes('doc') || lower.includes('paper') || lower.includes('writing')) return 'documents';
    if (lower.includes('code') || lower.includes('dev') || lower.includes('tech')) return 'code';
    if (lower.includes('ref') || lower.includes('cite') || lower.includes('arxiv')) return 'references';
    if (lower.includes('media') || lower.includes('image') || lower.includes('audio') || lower.includes('video')) return 'media';
    if (lower.includes('link') || lower.includes('bookmark')) return 'bookmarks';
    if (lower.includes('template') || lower.includes('prompt')) return 'templates';
    return 'knowledge';
  }

  // --- READ OPERATIONS ---

  getItems(category?: LibraryCategory, studioId?: StudioId, projectId?: string): LibraryItem[] {
    return this.items.filter((item) => {
      if (category && item.type !== category) return false;
      if (studioId && item.studioId && item.studioId !== studioId) return false;
      if (projectId && item.projectId && item.projectId !== projectId) return false;
      return true;
    });
  }

  getItem(id: string): LibraryItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  getAuthorisedResources(studioId?: StudioId, projectId?: string): LibraryItem[] {
    return this.items.filter((item) => {
      // Unrestricted resources available to all
      if (!item.studioId && !item.projectId) return true;
      if (studioId && item.studioId === studioId) return true;
      if (projectId && item.projectId === projectId) return true;
      return false;
    });
  }

  searchItems(query: string, category?: LibraryCategory, studioId?: StudioId, projectId?: string): LibraryItem[] {
    if (!query.trim()) return this.getItems(category, studioId, projectId);
    const q = query.toLowerCase();

    return this.getItems(category, studioId, projectId).filter((item) => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchContent = item.content.toLowerCase().includes(q);
      const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
      const matchColl = item.collection?.toLowerCase().includes(q);
      return matchName || matchDesc || matchContent || matchTags || matchColl;
    });
  }

  // --- WRITE / MUTATION OPERATIONS ---

  addItem(item: Omit<LibraryItem, 'id' | 'createdAt' | 'updatedAt' | 'status'>): LibraryItem {
    const newItem: LibraryItem = {
      ...item,
      id: `lib_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready',
    };

    this.items.unshift(newItem);
    this.persist();
    return newItem;
  }

  uploadFile(fileData: {
    name: string;
    content: string;
    type?: LibraryCategory;
    size?: number;
    mimeType?: string;
    tags?: string[];
    collection?: string;
    studioId?: StudioId;
    projectId?: string;
  }): LibraryItem {
    const category: LibraryCategory = fileData.type || this.inferTypeFromFileName(fileData.name);
    return this.addItem({
      type: category,
      name: fileData.name,
      description: `Uploaded file (${fileData.mimeType || 'raw_data'})`,
      content: fileData.content,
      mimeType: fileData.mimeType || this.inferMimeType(fileData.name),
      fileSize: fileData.size || new Blob([fileData.content]).size,
      tags: fileData.tags || ['upload'],
      collection: fileData.collection || 'Uploaded Files',
      studioId: fileData.studioId,
      projectId: fileData.projectId,
    });
  }

  updateItem(id: string, updates: Partial<LibraryItem>): LibraryItem | null {
    const item = this.getItem(id);
    if (!item) return null;

    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    this.persist();
    return item;
  }

  deleteItem(id: string): boolean {
    const initialLen = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    if (this.items.length < initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  linkToProject(itemId: string, projectId: string): boolean {
    const item = this.getItem(itemId);
    if (item) {
      item.projectId = projectId;
      item.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  linkToStudio(itemId: string, studioId: StudioId): boolean {
    const item = this.getItem(itemId);
    if (item) {
      item.studioId = studioId;
      item.updatedAt = new Date().toISOString();
      this.persist();
      return true;
    }
    return false;
  }

  saveGeneratedDocument(
    title: string,
    content: string,
    category: LibraryCategory = 'documents',
    studioId?: StudioId,
    projectId?: string
  ): LibraryItem {
    return this.addItem({
      type: category,
      name: title,
      description: 'Generated deliverable saved to Library',
      content,
      mimeType: 'text/markdown',
      tags: ['deliverable', 'generated'],
      collection: 'Deliverables',
      studioId,
      projectId,
    });
  }

  saveResearchFindings(
    topic: string,
    summary: string,
    citations: string[] = [],
    studioId?: StudioId,
    projectId?: string
  ): LibraryItem {
    const formattedContent = `# Research Findings: ${topic}\n\n${summary}\n\n## Citations & Sources\n${citations.map(c => `- ${c}`).join('\n')}`;
    return this.addItem({
      type: 'references',
      name: `Research - ${topic}`,
      description: `Synthesized research investigation on ${topic}`,
      content: formattedContent,
      mimeType: 'text/markdown',
      tags: ['research', 'citations', topic.toLowerCase()],
      collection: 'Research Notes',
      studioId: studioId || 'research-studio',
      projectId,
    });
  }

  private inferTypeFromFileName(fileName: string): LibraryCategory {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'sql', 'html', 'css', 'json'].includes(ext)) return 'code';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'mp3', 'wav', 'mp4'].includes(ext)) return 'media';
    if (['pdf', 'doc', 'docx', 'md', 'txt'].includes(ext)) return 'documents';
    return 'other';
  }

  private inferMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'md') return 'text/markdown';
    if (ext === 'ts') return 'text/typescript';
    if (ext === 'json') return 'application/json';
    if (ext === 'pdf') return 'application/pdf';
    return 'text/plain';
  }
}

export const libraryService = new LibraryService();
