import { storageService, STORAGE_KEYS } from './storageService';
import { companionData } from './companionData';
import type { ConversationThread } from './conversationEngine';
import type { MemoryRecord } from './memoryEngine';
import type { LibraryItem } from './libraryService';
import type { WorkspaceProject } from './workspaceEngine';
import type { StudioState } from './studiosEngine';
import type { AgentExecutionRecord } from './agentEngine';
import type { StudioId } from '../types/angel';

export type MigrationStatusState = 'idle' | 'migrating' | 'synced' | 'error';

export interface CloudMigrationStatus {
  state: MigrationStatusState;
  userId: string | null;
  migratedCounts: {
    conversations: number;
    memories: number;
    libraryItems: number;
    projects: number;
    studios: number;
    agentExecutions: number;
  };
  lastMigratedAt: string | null;
  error?: string;
}

const MIGRATION_FLAG_PREFIX = 'angel_cloud_migration_state_v1:user:';
const MIGRATION_BACKUP_PREFIX = 'angel_cloud_migration_backup_v1:user:';

const DEMO_CONVERSATION_IDS = new Set(['conv_general_1', 'conv_studio_res_1', 'conv_studio_dev_1']);
const BUILT_IN_SAMPLE_MEMORY_IDS = new Set(['mem_1', 'mem_2', 'mem_3']);
const STARTER_LIBRARY_IDS = new Set([
  'lib_doc_1',
  'lib_know_1',
  'lib_ref_1',
  'lib_code_1',
  'lib_template_1',
]);

function isUntouchedStarterProject(p: WorkspaceProject): boolean {
  if (p.id !== 'proj_default') return false;
  const starterFileIds = new Set(['file_1', 'file_2']);
  return (
    p.name === 'Angel Foundation System' &&
    p.files.every((f) => starterFileIds.has(f.id))
  );
}

export class CloudMigrationService {
  private status: CloudMigrationStatus = {
    state: 'idle',
    userId: null,
    migratedCounts: {
      conversations: 0,
      memories: 0,
      libraryItems: 0,
      projects: 0,
      studios: 0,
      agentExecutions: 0,
    },
    lastMigratedAt: null,
  };
  private listeners = new Set<(status: CloudMigrationStatus) => void>();
  private inFlight = new Map<string, Promise<CloudMigrationStatus>>();

  public getStatus(): CloudMigrationStatus {
    return this.status;
  }

  public subscribe(listener: (status: CloudMigrationStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private publish(next: CloudMigrationStatus): void {
    this.status = next;
    this.listeners.forEach((l) => l(next));
  }

  public detectUnownedLocalData(): {
    conversations: ConversationThread[];
    memories: MemoryRecord[];
    libraryItems: LibraryItem[];
    projects: WorkspaceProject[];
    studiosState: Partial<Record<StudioId, StudioState>>;
    agentExecutions: AgentExecutionRecord[];
    hasAnyData: boolean;
  } {
    const rawConvs = storageService.load<ConversationThread[]>(STORAGE_KEYS.conversations, []);
    const conversations = Array.isArray(rawConvs)
      ? rawConvs.filter((t) => t && t.id && !DEMO_CONVERSATION_IDS.has(t.id) && (t.messages?.length > 0 || t.isCustomTitle))
      : [];

    const rawMems = storageService.load<MemoryRecord[]>('angel_memory_records_v1', []);
    const memories = Array.isArray(rawMems)
      ? rawMems.filter((m) => m && m.id && !BUILT_IN_SAMPLE_MEMORY_IDS.has(m.id))
      : [];

    const rawLib = storageService.load<LibraryItem[]>('angel_library_items_v1', []);
    const libraryItems = Array.isArray(rawLib)
      ? rawLib.filter((i) => i && i.id && !STARTER_LIBRARY_IDS.has(i.id))
      : [];

    const rawProjects = storageService.load<WorkspaceProject[]>(STORAGE_KEYS.workspaceProjects, []);
    const projects = Array.isArray(rawProjects)
      ? rawProjects.filter((p) => p && p.id && !isUntouchedStarterProject(p))
      : [];

    const rawStudios = storageService.load<Partial<Record<StudioId, StudioState>>>(STORAGE_KEYS.studiosState, {});
    const studiosState: Partial<Record<StudioId, StudioState>> = {};
    if (rawStudios && typeof rawStudios === 'object') {
      Object.entries(rawStudios).forEach(([k, v]) => {
        if (v && (v.canvasBuffer?.trim() || (v.history && v.history.length > 0))) {
          studiosState[k as StudioId] = v;
        }
      });
    }

    const rawAgentHistory = storageService.load<AgentExecutionRecord[]>('angel_agent_execution_history_v1', []);
    const agentExecutions = Array.isArray(rawAgentHistory) ? rawAgentHistory.filter((r) => r && r.id) : [];

    const hasAnyData =
      conversations.length > 0 ||
      memories.length > 0 ||
      libraryItems.length > 0 ||
      projects.length > 0 ||
      Object.keys(studiosState).length > 0 ||
      agentExecutions.length > 0;

    return {
      conversations,
      memories,
      libraryItems,
      projects,
      studiosState,
      agentExecutions,
      hasAnyData,
    };
  }

  public async runSafeMigration(
    token: string,
    userId: string
  ): Promise<CloudMigrationStatus> {
    if (!token || !userId) {
      return this.status;
    }

    const existingPromise = this.inFlight.get(userId);
    if (existingPromise) return existingPromise;

    const promise = this.executeMigration(token, userId).finally(() => {
      this.inFlight.delete(userId);
    });
    this.inFlight.set(userId, promise);
    return promise;
  }

  private async executeMigration(token: string, userId: string): Promise<CloudMigrationStatus> {
    const flagKey = `${MIGRATION_FLAG_PREFIX}${userId}`;
    const existingFlag = storageService.load<CloudMigrationStatus | null>(flagKey, null);
    const detected = this.detectUnownedLocalData();

    if (existingFlag?.state === 'synced' && !detected.hasAnyData) {
      this.publish(existingFlag);
      return existingFlag;
    }

    this.publish({
      state: 'migrating',
      userId,
      migratedCounts: {
        conversations: detected.conversations.length,
        memories: detected.memories.length,
        libraryItems: detected.libraryItems.length,
        projects: detected.projects.length,
        studios: Object.keys(detected.studiosState).length,
        agentExecutions: detected.agentExecutions.length,
      },
      lastMigratedAt: existingFlag?.lastMigratedAt || null,
    });

    // Save recoverable local backup before migrating to user scope / cloud
    if (detected.hasAnyData) {
      storageService.save(`${MIGRATION_BACKUP_PREFIX}${userId}`, {
        backedUpAt: new Date().toISOString(),
        data: detected,
      });
    }

    try {
      if (companionData.isCloudConfigured() && detected.hasAnyData) {
        if (detected.conversations.length > 0) {
          await companionData.syncThreads(token, detected.conversations, userId);
        }
        if (detected.memories.length > 0) {
          await companionData.syncMemories(token, detected.memories, userId);
        }
        if (detected.libraryItems.length > 0) {
          await companionData.syncLibraryItems(token, detected.libraryItems, userId);
        }
        if (detected.projects.length > 0) {
          await companionData.syncWorkspaceProjects(token, detected.projects, userId);
        }
        if (Object.keys(detected.studiosState).length > 0) {
          await companionData.syncStudiosState(
            token,
            detected.studiosState as Record<StudioId, StudioState>,
            userId
          );
        }
        if (detected.agentExecutions.length > 0) {
          await companionData.syncAgentExecutions(token, detected.agentExecutions, userId);
        }
      }

      // Copy genuine unowned records into user-scoped caches idempotently (never delete until confirmed)
      if (detected.hasAnyData) {
        this.mergeIntoUserScopedLocal(userId, detected);
      }

      const completedStatus: CloudMigrationStatus = {
        state: 'synced',
        userId,
        migratedCounts: {
          conversations: detected.conversations.length,
          memories: detected.memories.length,
          libraryItems: detected.libraryItems.length,
          projects: detected.projects.length,
          studios: Object.keys(detected.studiosState).length,
          agentExecutions: detected.agentExecutions.length,
        },
        lastMigratedAt: new Date().toISOString(),
      };
      storageService.save(flagKey, completedStatus);
      this.publish(completedStatus);
      return completedStatus;
    } catch (error) {
      const errStatus: CloudMigrationStatus = {
        state: 'error',
        userId,
        migratedCounts: {
          conversations: 0,
          memories: 0,
          libraryItems: 0,
          projects: 0,
          studios: 0,
          agentExecutions: 0,
        },
        lastMigratedAt: existingFlag?.lastMigratedAt || null,
        error: error instanceof Error ? error.message : 'Local-to-cloud migration deferred.',
      };
      this.publish(errStatus);
      return errStatus;
    }
  }

  private mergeIntoUserScopedLocal(
    userId: string,
    detected: ReturnType<CloudMigrationService['detectUnownedLocalData']>
  ): void {
    const mergeById = <T extends { id: string }>(key: string, incoming: T[]) => {
      if (!incoming.length) return;
      const existing = storageService.load<T[]>(key, []);
      const map = new Map<string, T>();
      existing.forEach((item) => map.set(item.id, item));
      incoming.forEach((item) => {
        if (!map.has(item.id)) map.set(item.id, item);
      });
      storageService.save(key, Array.from(map.values()));
    };

    mergeById(`${STORAGE_KEYS.conversations}:user:${userId}`, detected.conversations);
    mergeById(`angel_memory_records_v1:user:${userId}`, detected.memories);
    mergeById(`angel_library_items_v1:user:${userId}`, detected.libraryItems);
    mergeById(`${STORAGE_KEYS.workspaceProjects}:user:${userId}`, detected.projects);
    mergeById(`angel_agent_execution_history_v1:user:${userId}`, detected.agentExecutions);
  }
}

export const cloudMigrationService = new CloudMigrationService();
