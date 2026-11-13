export class ConversationEngine {
  private threads: ConversationThread[] = [];
  private activeGeneralId = '';
  private activeStudioIds: Record<string, string> = {};
  private accessToken: string | null = null;
  private activeUserId: string | null = null;
  private cloudSyncRunning = false;
  private cloudSyncQueued = false;
  private cloudHydrationToken: string | null = null;

  constructor() {
    this.loadCurrentScope();
  }

  private scopedKey(base: string): string {
    return this.activeUserId ? `${base}:user:${this.activeUserId}` : base;
  }

  private loadCurrentScope(): void {
    const loaded = storageService.load<ConversationThread[]>(
      this.scopedKey(STORAGE_KEYS.conversations),
      DEFAULT_CONVERSATIONS
    );
    const demoSeedIds = new Set(['conv_general_1', 'conv_studio_res_1', 'conv_studio_dev_1']);
    this.threads = loaded
      .filter((thread) => !demoSeedIds.has(thread.id))
      .map((thread) => thread.scope ? thread : { ...thread, scope: 'general' as const });

    this.activeGeneralId = storageService.load<string>(
      this.scopedKey(STORAGE_KEYS.activeConversationId),
      this.threads.find((thread) => thread.scope === 'general')?.id || ''
    );
    this.activeStudioIds = storageService.load<Record<string, string>>(
      this.scopedKey('angel_active_studio_convs_v1'),
      {}
    );
  }

  private persist(): void {
    storageService.save(this.scopedKey(STORAGE_KEYS.conversations), this.threads);
    storageService.save(this.scopedKey(STORAGE_KEYS.activeConversationId), this.activeGeneralId);
    storageService.save(this.scopedKey('angel_active_studio_convs_v1'), this.activeStudioIds);
    if (this.accessToken) void this.syncCloud();
  }

  public setAccessToken(token: string | null, userId?: string | null): void {
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

    if (this.cloudHydrationToken !== token || identityChanged) {
      this.cloudHydrationToken = token;
      void this.restoreCloud(token);
    }
  }

  private async syncCloud(): Promise<void> {
    if (!this.accessToken || !this.activeUserId) return;
    if (this.cloudSyncRunning) {
      this.cloudSyncQueued = true;
      return;
    }

    this.cloudSyncRunning = true;
    try {
      do {
        this.cloudSyncQueued = false;
        const token = this.accessToken;
        if (!token) break;
        await companionData.syncThreads(token, this.threads);
      } while (this.cloudSyncQueued && this.accessToken);
    } catch (error) {
      console.warn('[ConversationEngine] Cloud sync deferred:', error);
    } finally {
      this.cloudSyncRunning = false;
    }
  }

  private async restoreCloud(token: string): Promise<void> {
    const ownerId = this.activeUserId;
    if (!ownerId) return;
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



    const newThread: ConversationThread = {
      id: `conv_${scope}_${Date.now()}`,
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
      id: `msg_${Date.now()}`,
      sender,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mode,
      attachments,
      attachmentDetails,
      linkPreviews,
    };

    thread.messages.push(userMessage);
    thread.updatedAt = new Date().toISOString();

    if (!thread.isCustomTitle && sender === 'user' && !thread.messages.some((message) => message.sender === 'user' && message.id !== userMessage.id)) {
      const generated = extractIntelligentTitle(content);
      thread.title = generated;
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

  async retryLastTurn(threadId: string): Promise<ChatMessage | null> {
    const thread = this.threads.find((t) => t.id === threadId) || this.getActiveThread('general');
    if (thread.messages.length > 0 && thread.messages[thread.messages.length - 1].sender === 'angel') {
      thread.messages.pop();
      this.persist();
    }
    return this.generateAssistantResponse(thread.id);
  }

  async generateAssistantResponse(threadId: string): Promise<ChatMessage> {
    const thread = this.threads.find((item) => item.id === threadId) || this.getActiveThread('general');
    const lastUserMsg = [...thread.messages].reverse().find((message) => message.sender === 'user');
    const promptText = lastUserMsg?.content || 'Hello';
    let responseText = '';

    try {
      if (!this.accessToken || !this.activeUserId) {
        throw new Error('Sign in to start a private conversation with Angel.');
      }

      const memoryContext = memoryEngine.retrieveContextForPrompt(
        promptText,
        thread.scope,
        thread.studioId
      );
      const history = thread.messages
        .filter((message) => message.sender === 'user' || message.sender === 'angel')
        .slice(-30)
        .map((message) => ({
          role: message.sender === 'angel' ? 'assistant' : 'user',
          content: message.content,
        }));

      const systemInstruction = [
        'You are Angel, a thoughtful, natural, capable Universal Personal AI Companion.',
        'Respond directly, accurately and conversationally. Respect the full conversation history.',
        `Current Angel environment: ${thread.scope === 'studio' ? this.formatStudioName(thread.studioId) : 'General Conversation'}.`,
        thread.scope === 'studio'
          ? 'Stay aware of the specialised studio context while remaining able to explain your reasoning.'
          : 'Do not force the user into a project, workspace, or studio unless they ask.',
        memoryContext ? `Relevant user context available for this conversation:\n${memoryContext}` : '',
      ].filter(Boolean).join('\n\n');

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          messages: history,
          mode: lastUserMsg?.mode,
          systemInstruction,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string'
            ? payload.error
            : response.status === 401
              ? 'Your Angel session has expired. Please sign in again.'
              : 'Angel could not reach the conversation service. Please try again.'
        );
      }

      responseText = typeof payload.reply === 'string'
        ? payload.reply
        : typeof payload.text === 'string'
          ? payload.text
          : '';
      if (!responseText.trim()) {
        throw new Error('Angel received an empty model response. Please try again.');
      }
    } catch (error) {
      console.error('[ConversationEngine] Authenticated Gemini request failed:', error);
      responseText = error instanceof Error
        ? error.message
        : 'Angel could not complete that response. Please try again.';
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
