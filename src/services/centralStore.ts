import {
  ConversationService,
  MessageService,
  TaskService,
  ProjectService,
  FileService,
  AgentService,
  NotificationService,
  PermissionService,
  SettingsService,
} from './services';
import { conversationEngine, ConversationThread } from './conversationEngine';
import { workspaceEngine, WorkspaceProject, WorkspaceFile } from './workspaceEngine';
import { studiosEngine, StudioState, APPROVED_EIGHT_STUDIOS } from './studiosEngine';
import { agentEngine, AgentDefinition } from './agentEngine';
import { permissionsEngine, PermissionRecord } from './permissionsEngine';
import { eventBus } from './AngelEventBus';
import { authService } from './authService';
import { PrimaryNavItem, CompanionOrbState, StudioId, UserPreferences, NotificationItem } from '../types/angel';
import { TaskRecord } from './activityEngine';

export interface UserSessionState {
  userId: string;
  name: string;
  email: string;
  tier: string;
  isAuthenticated: boolean;
}

export interface AngelCentralState {
  userSession: UserSessionState;
  currentDestination: PrimaryNavItem;
  activeConversation: ConversationThread;
  conversations: ConversationThread[];
  activeProject: WorkspaceProject;
  projects: WorkspaceProject[];
  activeStudioId: StudioId;
  activeStudioState: StudioState;
  activities: TaskRecord[];
  agents: AgentDefinition[];
  notifications: NotificationItem[];
  userPreferences: UserPreferences;
  permissions: PermissionRecord[];
  orbState: CompanionOrbState;
}

export class CentralStore {
  private static instance: CentralStore;

  private state: AngelCentralState;
  private listeners: Set<() => void> = new Set();

  private constructor() {
    const authSnap = authService.getSnapshot();
    const defaultSession: UserSessionState = {
      userId: authSnap.user?.id || '',
      name: authSnap.user?.fullName || 'Guest',
      email: authSnap.user?.email || '',
      tier: authSnap.status === 'authenticated' ? 'Verified Account' : 'Unauthenticated',
      isAuthenticated: authSnap.status === 'authenticated',
    };

    const activeConv = ConversationService.getActiveThread();
    const convs = ConversationService.getThreads();
    const projs = ProjectService.getProjects();
    const activeProj = projs[0] || ProjectService.createProject('Default Project', 'Primary Workspace Project');
    const studioId: StudioId = 'research-studio';
    const studioSt = studiosEngine.getStudioState(studioId);
    const tasks = TaskService.getTasks('all');
    const ags = AgentService.getAgents();
    const notifs = NotificationService.getNotifications();
    const prefs = SettingsService.getPreferences();
    const perms = PermissionService.getPermissions();

    this.state = {
      userSession: defaultSession,
      currentDestination: 'home',
      activeConversation: activeConv,
      conversations: convs,
      activeProject: activeProj,
      projects: projs,
      activeStudioId: studioId,
      activeStudioState: studioSt,
      activities: tasks,
      agents: ags,
      notifications: notifs,
      userPreferences: prefs,
      permissions: perms,
      orbState: 'idle',
    };

    // Listen to event bus and auth service for auto-synchronizing store
    authService.subscribe((snap) => {
      this.state.userSession = {
        userId: snap.user?.id || '',
        name: snap.user?.fullName || 'Guest',
        email: snap.user?.email || '',
        tier: snap.status === 'authenticated' ? 'Verified Account' : 'Unauthenticated',
        isAuthenticated: snap.status === 'authenticated',
      };
      this.notify();
    });
    eventBus.subscribe('conversation:updated', () => this.syncState());
    eventBus.subscribe('conversation:created', () => this.syncState());
    eventBus.subscribe('message:received', () => this.syncState());
    eventBus.subscribe('task:started', () => this.syncState());
    eventBus.subscribe('task:completed', () => this.syncState());
    eventBus.subscribe('agent:execution_started', () => this.syncState());
    eventBus.subscribe('permission:changed', () => this.syncState());
  }

  static getInstance(): CentralStore {
    if (!CentralStore.instance) {
      CentralStore.instance = new CentralStore();
    }
    return CentralStore.instance;
  }

  getState(): AngelCentralState {
    return { ...this.state };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  syncState() {
    this.state = {
      ...this.state,
      activeConversation: ConversationService.getActiveThread(),
      conversations: ConversationService.getThreads(),
      projects: ProjectService.getProjects(),
      activities: TaskService.getTasks('all'),
      agents: AgentService.getAgents(),
      notifications: NotificationService.getNotifications(),
      permissions: PermissionService.getPermissions(),
      userPreferences: SettingsService.getPreferences(),
    };
    this.notify();
  }

  setCurrentDestination(navId: PrimaryNavItem) {
    this.state.currentDestination = navId;
    this.notify();
  }

  setOrbState(orbState: CompanionOrbState) {
    this.state.orbState = orbState;
    this.notify();
  }

  setActiveStudio(studioId: StudioId) {
    this.state.activeStudioId = studioId;
    this.state.activeStudioState = studiosEngine.getStudioState(studioId);
    this.notify();
  }
}

export const centralStore = CentralStore.getInstance();
