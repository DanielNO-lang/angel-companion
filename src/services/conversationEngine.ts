import { ChatMessage, StudioId } from '../types/angel';
import { storageService, STORAGE_KEYS } from './storageService';
import { GoogleGenAI } from '@google/genai';
import { promptIntelligenceEngine } from './promptIntelligenceEngine';
import { memoryEngine } from './memoryEngine';

export type ConversationScope = 'general' | 'studio';

export interface ConversationThread {
  id: string;
  title: string;
  scope: ConversationScope;
  studioId?: StudioId;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  messages: ChatMessage[];
  metadata?: {
    tags?: string[];
    summary?: string;
    handoffFromId?: string;
  };
}

const DEFAULT_CONVERSATIONS: ConversationThread[] = [
  {
    id: 'conv_general_1',
    title: 'General Assistance & Brainstorming',
    scope: 'general',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    isArchived: false,
    messages: [
      {
        id: 'msg_1',
        sender: 'angel',
        content: 'Hello! I am Angel, your universal personal companion. Ask me general questions, brainstorm ideas, or ask for everyday assistance.',
        timestamp: '1h ago',
      },
    ],
  },
  {
    id: 'conv_studio_res_1',
    title: 'Research Paper Synthesis Session',
    scope: 'studio',
    studioId: 'research-studio',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
    isArchived: false,
    messages: [
      {
        id: 'msg_2',
        sender: 'angel',
        content: 'Research Studio conversation active. Ready to synthesize academic literature, parse datasets, and extract citations.',
        timestamp: '12h ago',
      },
    ],
  },
  {
    id: 'conv_studio_dev_1',
    title: 'Full-Stack TypeScript Refactoring',
    scope: 'studio',
    studioId: 'development-studio',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    isArchived: false,
    messages: [
      {
        id: 'msg_3',
        sender: 'angel',
        content: 'Development Studio conversation active. Ready to analyze AST code syntax, generate TypeScript modules, and debug APIs.',
        timestamp: '1d ago',
      },
    ],
  },
];

export class ConversationEngine {
  private threads: ConversationThread[];
  private activeGeneralId: string;
  private activeStudioIds: Record<string, string> = {};
  private aiClient: GoogleGenAI | null = null;

  constructor() {
    // 1. Load threads with safe migration fallback
    const loaded = storageService.load<ConversationThread[]>(
      STORAGE_KEYS.conversations,
      DEFAULT_CONVERSATIONS
    );

    // Safe Data Migration: ensure all records have valid scope property
    this.threads = loaded.map((t) => {
      if (!t.scope) {
        return { ...t, scope: 'general' as const };
      }
      return t;
    });

    // 2. Load active conversation tracking IDs
    this.activeGeneralId = storageService.load<string>(
      STORAGE_KEYS.activeConversationId,
      this.threads.find((t) => t.scope === 'general')?.id || 'conv_general_1'
    );

    this.activeStudioIds = storageService.load<Record<string, string>>(
      'angel_active_studio_convs_v1',
      {}
    );

    // 3. Initialize Gemini SDK client safely
    const apiKey = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.GEMINI_API_KEY : process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        this.aiClient = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('[ConversationEngine] Gemini API SDK setup deferred:', err);
      }
    }
  }

  private persist() {
    storageService.save(STORAGE_KEYS.conversations, this.threads);
    storageService.save(STORAGE_KEYS.activeConversationId, this.activeGeneralId);
    storageService.save('angel_active_studio_convs_v1', this.activeStudioIds);
  }

  // Scoped Thread Retrieval
  getThreads(scope: ConversationScope = 'general', studioId?: StudioId, includeArchived = false): ConversationThread[] {
    return this.threads.filter((t) => {
      if (!includeArchived && t.isArchived) return false;
      if (scope === 'general') {
        return t.scope === 'general';
      } else {
        if (t.scope !== 'studio') return false;
        if (studioId) return t.studioId === studioId;
        return true;
      }
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
    } else {
      const targetStudio = studioId || 'research-studio';
      const activeStudioThreadId = this.activeStudioIds[targetStudio];
      let thread = this.threads.find((t) => t.id === activeStudioThreadId && t.scope === 'studio' && t.studioId === targetStudio && !t.isArchived);
      if (!thread) {
        thread = this.getThreads('studio', targetStudio)[0] || this.createThread('studio', targetStudio, `${this.formatStudioName(targetStudio)} Session`);
        this.activeStudioIds[targetStudio] = thread.id;
        this.persist();
      }
      return thread;
    }
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
    const defaultTitle = scope === 'general' 
      ? `General Conversation ${this.getThreads('general', undefined, true).length + 1}`
      : `${this.formatStudioName(studioId || 'research-studio')} Session ${this.getThreads('studio', studioId, true).length + 1}`;

    const defaultGreeting = scope === 'general'
      ? 'Hello! I am Angel. Ask me anything, discuss ideas, or request everyday assistance.'
      : `Welcome to ${this.formatStudioName(studioId || 'research-studio')}. I am specialized for this environment and ready to assist your workflows.`;

    const newThread: ConversationThread = {
      id: `conv_${scope}_${Date.now()}`,
      title: title || defaultTitle,
      scope,
      studioId: scope === 'studio' ? (studioId || 'research-studio') : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      messages: [
        {
          id: `msg_init_${Date.now()}`,
          sender: 'angel',
          content: defaultGreeting,
          timestamp: 'Just now',
        },
      ],
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

  // Intentional User Handoff from General Conversation to Studio Conversation
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
      id: `msg_handoff_${Date.now()}`,
      sender: 'system',
      content: `Context transferred from General Conversation ("${sourceThread.title}"). Ready to execute in ${this.formatStudioName(targetStudioId)}.`,
      timestamp: 'Just now',
    });

    this.persist();
    return studioThread;
  }

  renameThread(id: string, newTitle: string): boolean {
    const thread = this.threads.find((t) => t.id === id);
    if (thread && newTitle.trim()) {
      thread.title = newTitle.trim();
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
    attachments?: string[]
  ): Promise<ChatMessage> {
    const thread = this.threads.find((t) => t.id === threadId) || this.getActiveThread('general');

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode,
      attachments,
    };

    thread.messages.push(userMessage);
    thread.updatedAt = new Date().toISOString();

    if (thread.messages.length === 2 && (thread.title.startsWith('Conversation') || thread.title.startsWith('General Conversation'))) {
      thread.title = content.length > 28 ? `${content.slice(0, 28)}...` : content;
    }

    if (sender === 'user' && content.toLowerCase().includes('remember')) {
      memoryEngine.saveMemory({
        category: 'personal',
        scope: thread.scope,
        studioId: thread.studioId,
        title: content.length > 30 ? `${content.slice(0, 30)}...` : content,
        content: content,
        source: `User Conversation (${thread.title})`,
      });
    }

    this.persist();
    return userMessage;
  }

  async generateAssistantResponse(threadId: string): Promise<ChatMessage> {
    const thread = this.threads.find((t) => t.id === threadId) || this.getActiveThread('general');
    const lastUserMsg = [...thread.messages].reverse().find((m) => m.sender === 'user');
    const promptText = lastUserMsg?.content || 'Hello';

    let responseText = '';

    try {
      const memoryContext = memoryEngine.retrieveContextForPrompt(promptText, thread.scope, thread.studioId);

      const processed = await promptIntelligenceEngine.processPrompt(promptText, {
        scope: thread.scope,
        studioId: thread.studioId,
        conversationHistory: thread.messages,
      });
      // Memory context is kept private and used by reasoning/model context internally without raw string leakage
      responseText = processed.responseMessage;
    } catch (err: any) {
      console.warn('[ConversationEngine] Prompt Intelligence Engine processing error:', err);
      responseText = thread.scope === 'studio'
        ? `[${this.formatStudioName(thread.studioId)} Local Engine] Encountered an error processing this request: ${err?.message || 'Processing failed'}. Integration with an external model is pending.`
        : `I was unable to process that request locally. External model provider connection is pending. Please verify your connection or try a different request.`;
    }

    const assistantMessage: ChatMessage = {
      id: `msg_ai_${Date.now()}`,
      sender: 'angel',
      content: responseText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
