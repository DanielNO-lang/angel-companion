/**
 * ANGEL LOCAL FILE PERSISTENCE SERVICE
 * Provides IndexedDB binary storage for browser environments with seamless
 * in-memory and local persistence fallback for Node.js testing/SSR.
 * Includes storage quota safety and context-scoped key management.
 */

const DB_NAME = 'angel_file_store_v1';
const STORE_NAME = 'attachments';
const DB_VERSION = 1;

// Node/Fallback in-memory storage
const memoryStore = new Map<string, { data: string | ArrayBuffer; size: number }>();
let simulatedQuotaLimitBytes = 50 * 1024 * 1024; // 50MB default quota ceiling for safe handling

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  return null;
}

export class FileStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    const idb = getIndexedDB();
    if (!idb) {
      return Promise.reject(new Error('IndexedDB not supported in current environment'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  public setSimulatedQuotaLimit(bytes: number) {
    simulatedQuotaLimitBytes = bytes;
  }

  public async saveFile(key: string, data: string | ArrayBuffer): Promise<{ success: boolean; error?: string }> {
    const size = typeof data === 'string' ? data.length : data.byteLength;

    // Check memory store quota if using memory fallback
    const idb = getIndexedDB();
    if (!idb) {
      let currentTotal = 0;
      memoryStore.forEach((item) => {
        currentTotal += item.size;
      });

      if (currentTotal + size > simulatedQuotaLimitBytes) {
        return {
          success: false,
          error: `Storage quota exceeded: cannot store ${size} bytes (current: ${currentTotal} bytes, max: ${simulatedQuotaLimitBytes} bytes).`,
        };
      }

      memoryStore.set(key, { data, size });
      return { success: true };
    }

    try {
      const db = await this.initDB();
      return await new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.put(data, key);

        req.onsuccess = () => resolve({ success: true });
        req.onerror = () => {
          const err = req.error;
          const isQuota = err && (err.name === 'QuotaExceededError' || err.message?.includes('quota'));
          resolve({
            success: false,
            error: isQuota
              ? 'Local storage quota exceeded. Please remove older attachments.'
              : err?.message || 'Failed to save file to IndexedDB',
          });
        };
      });
    } catch (err: any) {
      // Fallback to memory store if DB open fails
      memoryStore.set(key, { data, size });
      return { success: true };
    }
  }

  public async getFile(key: string): Promise<string | ArrayBuffer | null> {
    const idb = getIndexedDB();
    if (!idb) {
      const item = memoryStore.get(key);
      return item ? item.data : null;
    }

    try {
      const db = await this.initDB();
      return await new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => {
          const fallback = memoryStore.get(key);
          resolve(fallback ? fallback.data : null);
        };
      });
    } catch {
      const fallback = memoryStore.get(key);
      return fallback ? fallback.data : null;
    }
  }

  public async deleteFile(key: string): Promise<boolean> {
    memoryStore.delete(key);

    const idb = getIndexedDB();
    if (!idb) return true;

    try {
      const db = await this.initDB();
      return await new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.delete(key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      });
    } catch {
      return true;
    }
  }

  public async hasFile(key: string): Promise<boolean> {
    if (memoryStore.has(key)) return true;
    const content = await this.getFile(key);
    return content !== null;
  }

  public async clearAll(): Promise<void> {
    memoryStore.clear();

    const idb = getIndexedDB();
    if (!idb) return;

    try {
      const db = await this.initDB();
      return await new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }
}

export const fileStorageService = new FileStorageService();
