import { eventBus } from './AngelEventBus';
import { conversationEngine, ConversationThread, ConversationScope } from './conversationEngine';
import { activityEngine, TaskRecord, TaskLifecycleStatus } from './activityEngine';
import { workspaceEngine, WorkspaceProject, WorkspaceFile, WorkspaceFileType } from './workspaceEngine';
import { agentEngine, AgentDefinition } from './agentEngine';
import { studiosEngine, StudioState, APPROVED_EIGHT_STUDIOS } from './studiosEngine';
import { permissionsEngine, PermissionRecord, PermissionType } from './permissionsEngine';
import { storageService, STORAGE_KEYS } from './storageService';
import { ChatMessage, NotificationItem, UserPreferences, StudioId } from '../types/angel';
import { errorHandler, AngelAppError } from './ErrorHandlerService';

// 1. ConversationService
export const ConversationService = {
  getThreads(scope: ConversationScope = 'general', studioId?: StudioId, includeArchived = false): ConversationThread[] {
    return conversationEngine.getThreads(scope, studioId, includeArchived);
  },
  getActiveThread(scope: ConversationScope = 'general', studioId?: StudioId): ConversationThread {
    return conversationEngine.getActiveThread(scope, studioId);
  },
  setActiveThread(id: string): boolean {
    const success = conversationEngine.setActiveThread(id);
    if (success) {
      eventBus.publish('conversation:updated', { id, action: 'set_active' });
    }
    return success;
  },
  createThread(scope: ConversationScope = 'general', studioId?: StudioId, title?: string): ConversationThread {
    const thread = conversationEngine.createThread(scope, studioId, title);
    eventBus.publish('conversation:created', { threadId: thread.id, title: thread.title, scope, studioId });
    return thread;
  },
  handoffToStudio(fromThreadId: string, targetStudioId: StudioId, customPrompt?: string): ConversationThread {
    const thread = conversationEngine.handoffToStudio(fromThreadId, targetStudioId, customPrompt);
    eventBus.publish('conversation:created', { threadId: thread.id, title: thread.title, scope: 'studio', studioId: targetStudioId });
    return thread;
  },
  renameThread(id: string, newTitle: string): boolean {
    const success = conversationEngine.renameThread(id, newTitle);
    if (success) {
      eventBus.publish('conversation:updated', { id, title: newTitle, action: 'rename' });
    }
    return success;
  },
  archiveThread(id: string): boolean {
    const success = conversationEngine.archiveThread(id);
    if (success) {
      eventBus.publish('conversation:archived', { id });
    }
    return success;
  },
  deleteThread(id: string): boolean {
    const success = conversationEngine.deleteThread(id);
    if (success) {
      eventBus.publish('conversation:deleted', { id });
    }
    return success;
  },
};

// 2. MessageService
export const MessageService = {
  async sendMessage(threadId: string, content: string, sender: 'user' | 'angel' | 'system' = 'user'): Promise<ChatMessage> {
    if (!content.trim()) {
      throw new AngelAppError('ERR_VALIDATION', 'Message content cannot be empty.');
    }
    const msg = await conversationEngine.addMessage(threadId, content, sender);
    eventBus.publish('message:received', { threadId, messageId: msg.id, sender, content });
    return msg;
  },
  async generateAssistantResponse(threadId: string): Promise<ChatMessage> {
    const msg = await conversationEngine.generateAssistantResponse(threadId);
    eventBus.publish('message:received', { threadId, messageId: msg.id, sender: 'angel', content: msg.content });
    return msg;
  },
};

// 3. MemoryService
export const MemoryService = {
  privateMemory: new Map<string, any>(),

  setContext(key: string, value: any): void {
    this.privateMemory.set(key, value);
    eventBus.publish('memory:updated', { key, value });
  },
  getContext<T = any>(key: string): T | undefined {
    return this.privateMemory.get(key) as T;
  },
  clearContext(): void {
    this.privateMemory.clear();
  },
};

// 4. ActivityService & 5. TaskService
export const TaskService = {
  getTasks(statusFilter?: TaskLifecycleStatus | 'all'): TaskRecord[] {
    return activityEngine.getTasks(statusFilter);
  },
  createTask(title: string, category: string, initiatedBy: TaskRecord['initiatedBy'] = 'user', details?: string): TaskRecord {
    const task = activityEngine.createTask(title, category, initiatedBy, details, 'running');
    eventBus.publish('task:started', { taskId: task.id, title: task.title, category: task.category });
    return task;
  },
  updateStatus(id: string, newStatus: TaskLifecycleStatus, errorMsg?: string): boolean {
    const success = activityEngine.updateTaskStatus(id, newStatus, errorMsg);
    if (success) {
      if (newStatus === 'completed') eventBus.publish('task:completed', { taskId: id });
      else if (newStatus === 'failed_interrupted') eventBus.publish('task:failed', { taskId: id, errorMsg });
      else if (newStatus === 'waiting_approval') eventBus.publish('approval:requested', { taskId: id });
    }
    return success;
  },
  approveTask(id: string): boolean {
    const success = activityEngine.approveTask(id);
    if (success) {
      eventBus.publish('approval:granted', { taskId: id });
    }
    return success;
  },
  rejectTask(id: string): boolean {
    const success = activityEngine.updateTaskStatus(id, 'failed_interrupted', 'Approval rejected by user');
    if (success) {
      eventBus.publish('approval:rejected', { taskId: id });
    }
    return success;
  },
};

export const ActivityService = TaskService;

// 6. ProjectService
export const ProjectService = {
  getProjects(): WorkspaceProject[] {
    return workspaceEngine.getProjects();
  },
  createProject(name: string, description: string): WorkspaceProject {
    const proj = workspaceEngine.createProject(name, description);
    eventBus.publish('project:created', { projectId: proj.id, name: proj.name });
    return proj;
  },
};

// 7. FileService
export const FileService = {
  addFile(projectId: string, name: string, content: string, type: WorkspaceFileType = 'document'): WorkspaceFile | null {
    const file = workspaceEngine.addFileToProject(projectId, name, content, type);
    if (file) {
      eventBus.publish('file:created', { fileId: file.id, name: file.name, projectId });
    }
    return file;
  },
  updateFile(fileId: string, content: string): boolean {
    const success = workspaceEngine.updateFileContent(fileId, content);
    if (success) {
      eventBus.publish('file:updated', { fileId });
    }
    return success;
  },
  deleteFile(fileId: string): boolean {
    const success = workspaceEngine.deleteFile(fileId);
    if (success) {
      eventBus.publish('file:deleted', { fileId });
    }
    return success;
  },
  search(query: string): WorkspaceFile[] {
    return workspaceEngine.searchFiles(query);
  },
};

// 8. AgentService & 9. WorkflowService
export const AgentService = {
  getAgents(): AgentDefinition[] {
    return agentEngine.getAgents();
  },
  pauseAgent(id: string): boolean {
    const success = agentEngine.pauseAgent(id);
    if (success) eventBus.publish('agent:execution_paused', { agentId: id });
    return success;
  },
  resumeAgent(id: string): boolean {
    const success = agentEngine.resumeAgent(id);
    if (success) eventBus.publish('agent:execution_started', { agentId: id });
    return success;
  },
  stopAgent(id: string): boolean {
    const success = agentEngine.stopAgent(id);
    if (success) eventBus.publish('agent:execution_stopped', { agentId: id });
    return success;
  },
};

export const WorkflowService = {
  triggerWorkflow(ruleName: string, condition: string, action: string): void {
    eventBus.publish('task:started', { ruleName, condition, action });
  },
};

// 10. NotificationService
export const NotificationService = {
  notifications: [
    { id: 'n1', title: 'System Engine Active', message: 'Angel Core Services fully running.', timestamp: 'Just now', read: false, type: 'system' },
  ] as NotificationItem[],
  getNotifications(): NotificationItem[] {
    return this.notifications;
  },
  addNotification(title: string, message: string, type: 'system' | 'agent' | 'activity' = 'system'): NotificationItem {
    const item: NotificationItem = {
      id: `n_${Date.now()}`,
      title,
      message,
      timestamp: 'Just now',
      read: false,
      type,
    };
    this.notifications.unshift(item);
    eventBus.publish<NotificationItem>('notification:generated', item);
    return item;
  },
  markAllRead(): void {
    this.notifications.forEach((n) => (n.read = true));
  },
};

// 11. PermissionService
export const PermissionService = {
  getPermissions(): PermissionRecord[] {
    return permissionsEngine.getPermissions();
  },
  async requestPermission(type: PermissionType): Promise<boolean> {
    const granted = await permissionsEngine.requestPermission(type);
    eventBus.publish('permission:changed', { type, granted });
    return granted;
  },
};

// 12. SettingsService
export const SettingsService = {
  getPreferences(): UserPreferences {
    return storageService.load<UserPreferences>(STORAGE_KEYS.userSettings, {
      theme: 'dark',
      reduceMotion: false,
      voiceAutoPlay: true,
      orbSensitivity: 'medium',
      compactSidebar: false,
    });
  },
  savePreferences(prefs: UserPreferences): void {
    storageService.save(STORAGE_KEYS.userSettings, prefs);
    eventBus.publish('settings:updated', prefs);
  },
};

// 13. SearchService
export const SearchService = {
  queryAll(query: string) {
    if (!query.trim()) return { conversations: [], files: [], tasks: [], agents: [] };
    const q = query.toLowerCase();

    return {
      conversations: conversationEngine.searchHistory(q),
      files: workspaceEngine.searchFiles(q),
      tasks: activityEngine.getTasks('all').filter((t) => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)),
      agents: agentEngine.getAgents().filter((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)),
    };
  },
};

// 14. PromptIntelligenceService
export { promptIntelligenceEngine } from './promptIntelligenceEngine';
export { capabilityRegistry } from './capabilityRegistry';
export { capabilityRouter } from './capabilityRouter';
export { executionPlanEngine } from './executionPlanEngine';
export { promptStore } from './promptStore';
export { STUDIO_CONFIGS, getStudioConfig } from './studioConfigs';
export { personalityAdapter } from './personalityAdapter';

