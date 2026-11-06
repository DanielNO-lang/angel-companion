/**
 * ANGEL LOCAL PERSISTENCE ENGINE
 * Provides robust localStorage auto-sync, schema versioning, error recovery,
 * export/import backup functionality, and cloud sync boundary preparation.
 * Works seamlessly in both Browser DOM and Node.js runtime environments.
 */

export const STORAGE_KEYS = {
  conversations: 'angel_conversations_v1',
  activeConversationId: 'angel_active_conv_id_v1',
  activities: 'angel_activities_v1',
  workspaceProjects: 'angel_workspace_projects_v1',
  studiosState: 'angel_studios_state_v1',
  agentsState: 'angel_agents_state_v1',
  permissions: 'angel_permissions_v1',
  userSettings: 'angel_user_settings_v1',
};

// In-memory fallback map for Node.js testing environments
const nodeMemoryStore = new Map<string, string>();

function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export const storageService = {
  save<T>(key: string, data: T): boolean {
    try {
      const serialized = JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        payload: data,
      });
      const ls = getLocalStorage();
      if (ls) {
        ls.setItem(key, serialized);
      } else {
        nodeMemoryStore.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.warn(`[StorageEngine] Failed to save key "${key}":`, error);
      return false;
    }
  },

  load<T>(key: string, fallbackValue: T): T {
    try {
      const ls = getLocalStorage();
      const item = ls ? ls.getItem(key) : nodeMemoryStore.get(key) || null;
      if (!item) return fallbackValue;
      const parsed = JSON.parse(item);
      if (parsed && typeof parsed === 'object' && 'payload' in parsed) {
        return parsed.payload as T;
      }
      return parsed as T;
    } catch (error) {
      console.error(`[StorageEngine] Corrupt data at key "${key}". Restoring default:`, error);
      return fallbackValue;
    }
  },

  remove(key: string): void {
    try {
      const ls = getLocalStorage();
      if (ls) {
        ls.removeItem(key);
      } else {
        nodeMemoryStore.delete(key);
      }
    } catch (error) {
      console.warn(`[StorageEngine] Failed to remove key "${key}":`, error);
    }
  },

  clearAllAngelData(): void {
    Object.values(STORAGE_KEYS).forEach((key) => {
      try {
        storageService.remove(key);
      } catch {
        // ignore
      }
    });
  },

  exportBackupJSON(): string {
    const backup: Record<string, any> = {};
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      backup[key] = storageService.load(key, null);
    });
    return JSON.stringify(backup, null, 2);
  },

  importBackupJSON(jsonString: string): boolean {
    try {
      const backup = JSON.parse(jsonString);
      if (!backup || typeof backup !== 'object') return false;

      Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
        if (key in backup && backup[key] !== null) {
          storageService.save(key, backup[key]);
        }
      });
      return true;
    } catch (error) {
      console.error('[StorageEngine] Invalid backup file format:', error);
      return false;
    }
  },
};
