import type { ChatMessage, StudioId } from '../types/angel';

export const CONVERSATION_CACHE_STORAGE_KEY = 'angel_conversation_cache_v1';
export const CONVERSATION_SW_CACHE_NAME = 'angel-conversation-history-v1';
export const CONVERSATION_CACHE_MAX_THREADS = 40;
export const CONVERSATION_CACHE_MAX_MESSAGES_PER_THREAD = 200;

export interface CachedConversationThread {
  id: string;
  title: string;
  scope: 'general' | 'studio';
  studioId?: StudioId;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  isCustomTitle?: boolean;
  messages: ChatMessage[];
  metadata?: {
    tags?: string[];
    summary?: string;
    handoffFromId?: string;
  };
}

export interface ConversationCacheSnapshot {
  version: 1;
  scopeKey: string;
  cachedAt: string;
  pendingCloudSync: boolean;
  threadCount: number;
  messageCount: number;
  threads: CachedConversationThread[];
}

export interface OfflineCacheStatus {
  cachedAt: string | null;
  threadCount: number;
  messageCount: number;
  pendingCloudSync: boolean;
}

const DEMO_SEED_IDS = new Set(['conv_general_1', 'conv_studio_res_1', 'conv_studio_dev_1']);

function countMessages(threads: CachedConversationThread[]): number {
  return threads.reduce((total, thread) => total + (Array.isArray(thread.messages) ? thread.messages.length : 0), 0);
}

/**
 * Normalizes, deduplicates, sorts newest-first, and bounds recent conversation history
 * so local offline persistence stays reliable within browser storage quotas.
 */
export function pruneThreadsForLocalCache(
  threads: CachedConversationThread[],
  maxThreads: number = CONVERSATION_CACHE_MAX_THREADS,
  maxMessagesPerThread: number = CONVERSATION_CACHE_MAX_MESSAGES_PER_THREAD
): CachedConversationThread[] {
  if (!Array.isArray(threads)) return [];

  const byId = new Map<string, CachedConversationThread>();
  for (const raw of threads) {
    if (!raw || typeof raw.id !== 'string' || DEMO_SEED_IDS.has(raw.id)) continue;
    const rawMessages = Array.isArray(raw.messages) ? raw.messages : [];
    const boundedMessages =
      rawMessages.length > maxMessagesPerThread
        ? rawMessages.slice(-maxMessagesPerThread)
        : [...rawMessages];

    const normalized: CachedConversationThread = {
      ...raw,
      scope: raw.scope === 'studio' ? 'studio' : 'general',
      messages: boundedMessages,
      createdAt: raw.createdAt || raw.updatedAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
      isArchived: Boolean(raw.isArchived),
    };

    const existing = byId.get(normalized.id);
    if (!existing || normalized.updatedAt > existing.updatedAt) {
      byId.set(normalized.id, normalized);
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, Math.max(1, maxThreads));
}

export function buildConversationCacheSnapshot(
  scopeKey: string,
  threads: CachedConversationThread[],
  pendingCloudSync: boolean = false,
  nowIso: string = new Date().toISOString(),
  maxThreads: number = CONVERSATION_CACHE_MAX_THREADS,
  maxMessagesPerThread: number = CONVERSATION_CACHE_MAX_MESSAGES_PER_THREAD
): ConversationCacheSnapshot {
  const pruned = pruneThreadsForLocalCache(threads, maxThreads, maxMessagesPerThread);
  return {
    version: 1,
    scopeKey,
    cachedAt: nowIso,
    pendingCloudSync,
    threadCount: pruned.length,
    messageCount: countMessages(pruned),
    threads: pruned,
  };
}

function parseIsoTimestampMs(value?: string): number | null {
  if (!value || typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function sortMessagesChronologically(messages: ChatMessage[]): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length <= 1) return Array.isArray(messages) ? [...messages] : [];
  return messages
    .map((msg, idx) => ({ msg, idx }))
    .sort((a, b) => {
      const aTime = parseIsoTimestampMs(a.msg.createdAt) ?? parseIsoTimestampMs(a.msg.timestamp);
      const bTime = parseIsoTimestampMs(b.msg.createdAt) ?? parseIsoTimestampMs(b.msg.timestamp);
      if (aTime !== null && bTime !== null && aTime !== bTime) {
        return aTime - bTime;
      }
      const aSeq = typeof a.msg.sequence === 'number' ? a.msg.sequence : null;
      const bSeq = typeof b.msg.sequence === 'number' ? b.msg.sequence : null;
      if (aSeq !== null && bSeq !== null && aSeq !== bSeq) {
        return aSeq - bSeq;
      }
      return a.idx - b.idx;
    })
    .map((entry) => entry.msg);
}

function mergeMessageEntry(existing: ChatMessage | undefined, incoming: ChatMessage): ChatMessage {
  if (!existing) return incoming;
  const preferIncomingStatus =
    incoming.status === 'completed' ||
    (existing.status !== 'completed' && incoming.status !== 'unsent');
  return {
    ...existing,
    ...incoming,
    createdAt: existing.createdAt || incoming.createdAt,
    sequence: typeof existing.sequence === 'number' ? existing.sequence : incoming.sequence,
    status: preferIncomingStatus ? incoming.status : existing.status,
  };
}

/**
 * Merges primary and cached thread lists without dropping offline-authored messages
 * or newer metadata updates, while keeping messages in chronological order.
 */
export function mergeConversationSnapshots(
  primaryThreads: CachedConversationThread[],
  cachedThreads: CachedConversationThread[]
): CachedConversationThread[] {
  const merged = new Map<string, CachedConversationThread>();

  for (const cached of pruneThreadsForLocalCache(cachedThreads)) {
    merged.set(cached.id, {
      ...cached,
      messages: sortMessagesChronologically(cached.messages),
    });
  }

  for (const current of pruneThreadsForLocalCache(primaryThreads)) {
    const existing = merged.get(current.id);
    if (!existing) {
      merged.set(current.id, {
        ...current,
        messages: sortMessagesChronologically(current.messages),
      });
      continue;
    }

    const messageMap = new Map<string, ChatMessage>();
    for (const msg of existing.messages) {
      messageMap.set(msg.id, mergeMessageEntry(messageMap.get(msg.id), msg));
    }
    for (const msg of current.messages) {
      messageMap.set(msg.id, mergeMessageEntry(messageMap.get(msg.id), msg));
    }

    const useCurrentMeta = (current.updatedAt || '') >= (existing.updatedAt || '');
    merged.set(current.id, {
      ...(useCurrentMeta ? existing : current),
      ...(useCurrentMeta ? current : existing),
      messages: sortMessagesChronologically(Array.from(messageMap.values())),
      updatedAt: useCurrentMeta ? current.updatedAt : existing.updatedAt,
    });
  }

  return Array.from(merged.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function getScopedCacheStorageKey(scopeKey: string): string {
  return scopeKey === 'anon'
    ? CONVERSATION_CACHE_STORAGE_KEY
    : `${CONVERSATION_CACHE_STORAGE_KEY}:${scopeKey}`;
}

export function getServiceWorkerCacheUrl(scopeKey: string): string {
  return `/__angel_offline_cache__/conversations.json?scope=${encodeURIComponent(scopeKey || 'anon')}`;
}

function resolveStorage(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export function saveRecentConversationsToCache(
  scopeKey: string,
  threads: CachedConversationThread[],
  pendingCloudSync: boolean = false,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): ConversationCacheSnapshot {
  const fullSnapshot = buildConversationCacheSnapshot(scopeKey, threads, pendingCloudSync);
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return fullSnapshot;

  const storageKey = getScopedCacheStorageKey(scopeKey);
  try {
    targetStorage.setItem(storageKey, JSON.stringify(fullSnapshot));
    return fullSnapshot;
  } catch {
    // Quota fallback: compact to most recent 15 threads and 80 messages per thread
    const compactSnapshot = buildConversationCacheSnapshot(
      scopeKey,
      threads,
      pendingCloudSync,
      fullSnapshot.cachedAt,
      15,
      80
    );
    try {
      targetStorage.setItem(storageKey, JSON.stringify(compactSnapshot));
      return compactSnapshot;
    } catch {
      return fullSnapshot;
    }
  }
}

export function loadRecentConversationsFromCache(
  scopeKey: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): ConversationCacheSnapshot | null {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return null;

  try {
    const raw = targetStorage.getItem(getScopedCacheStorageKey(scopeKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConversationCacheSnapshot>;
    if (!parsed || !Array.isArray(parsed.threads)) return null;
    const pruned = pruneThreadsForLocalCache(parsed.threads as CachedConversationThread[]);
    return {
      version: 1,
      scopeKey: typeof parsed.scopeKey === 'string' ? parsed.scopeKey : scopeKey,
      cachedAt: typeof parsed.cachedAt === 'string' ? parsed.cachedAt : new Date().toISOString(),
      pendingCloudSync: Boolean(parsed.pendingCloudSync),
      threadCount: pruned.length,
      messageCount: countMessages(pruned),
      threads: pruned,
    };
  } catch {
    return null;
  }
}

export function clearRecentConversationsCache(
  scopeKey: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
): void {
  const targetStorage = resolveStorage(storage);
  if (!targetStorage) return;
  try {
    targetStorage.removeItem(getScopedCacheStorageKey(scopeKey));
  } catch {
    // Ignore storage access errors
  }
}

export async function writeSnapshotToCacheStorage(
  snapshot: ConversationCacheSnapshot,
  cacheStorage?: CacheStorage | null
): Promise<boolean> {
  const cachesApi =
    cacheStorage ?? (typeof window !== 'undefined' && 'caches' in window ? window.caches : null);
  if (!cachesApi) return false;

  try {
    const cache = await cachesApi.open(CONVERSATION_SW_CACHE_NAME);
    const cacheUrl = getServiceWorkerCacheUrl(snapshot.scopeKey);
    const response = new Response(JSON.stringify(snapshot), {
      headers: {
        'content-type': 'application/json',
        'x-angel-cached-at': snapshot.cachedAt,
      },
    });
    await cache.put(cacheUrl, response);
    return true;
  } catch {
    return false;
  }
}

export async function readSnapshotFromCacheStorage(
  scopeKey: string,
  cacheStorage?: CacheStorage | null
): Promise<ConversationCacheSnapshot | null> {
  const cachesApi =
    cacheStorage ?? (typeof window !== 'undefined' && 'caches' in window ? window.caches : null);
  if (!cachesApi) return null;

  try {
    const cache = await cachesApi.open(CONVERSATION_SW_CACHE_NAME);
    const match = await cache.match(getServiceWorkerCacheUrl(scopeKey));
    if (!match) return null;
    const parsed = (await match.json()) as Partial<ConversationCacheSnapshot>;
    if (!parsed || !Array.isArray(parsed.threads)) return null;
    const pruned = pruneThreadsForLocalCache(parsed.threads as CachedConversationThread[]);
    return {
      version: 1,
      scopeKey,
      cachedAt: typeof parsed.cachedAt === 'string' ? parsed.cachedAt : new Date().toISOString(),
      pendingCloudSync: Boolean(parsed.pendingCloudSync),
      threadCount: pruned.length,
      messageCount: countMessages(pruned),
      threads: pruned,
    };
  } catch {
    return null;
  }
}
