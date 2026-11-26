import test from 'node:test';
import assert from 'node:assert/strict';

import { companionData } from '../src/services/companionData';
import { conversationEngine } from '../src/services/conversationEngine';
import { memoryEngine } from '../src/services/memoryEngine';
import { cloudSyncCoordinator } from '../src/services/cloudSyncCoordinator';
import { storageService, STORAGE_KEYS } from '../src/services/storageService';
import { sortMessagesChronologically, mergeConversationSnapshots } from '../src/services/conversationCache';

const TEST_SUPABASE_URL = 'https://qltiogotxbxwzwmnypwu.supabase.co';
const TEST_PUBLISHABLE_KEY = 'sb_publishable_test_cloud_persistence';

interface InMemorySupabaseDb {
  conversations: Map<string, any>;
  messages: Map<string, any>;
  memories: Map<string, any>;
  enforcePartialIndexOnClientId: boolean;
}

function createRlsContractFetch(db: InMemorySupabaseDb): typeof fetch {
  const tokenToUserId: Record<string, string> = {
    jwt_user_a: 'user_cloud_alpha',
    jwt_user_b: 'user_cloud_beta',
  };

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = String(input);
    const parsed = new URL(rawUrl);
    const headers = (init?.headers || {}) as Record<string, string>;
    const auth = headers.authorization || headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const uid = tokenToUserId[token];

    if (parsed.pathname === '/auth/v1/user') {
      if (!uid) return new Response(JSON.stringify({ message: 'Invalid JWT' }), { status: 401 });
      return new Response(JSON.stringify({ id: uid, email: `${uid}@example.com` }), { status: 200 });
    }

    if (!uid) {
      return new Response(
        JSON.stringify({ code: '42501', message: 'new row violates row-level security policy' }),
        { status: 401 }
      );
    }

    const method = (init?.method || 'GET').toUpperCase();
    const table = parsed.pathname.replace(/^\/rest\/v1\//, '');
    const onConflict = parsed.searchParams.get('on_conflict');
    const clientIdEq = parsed.searchParams.get('client_id')?.replace(/^eq\./, '');

    if (table === 'companion_conversations') {
      if (method === 'GET') {
        const rows = Array.from(db.conversations.values())
          .filter((c) => c.user_id === uid && (!clientIdEq || c.client_id === clientIdEq))
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map((c) => ({
            ...c,
            companion_messages: Array.from(db.messages.values()).filter(
              (m) => m.user_id === uid && m.conversation_id === c.id
            ),
          }));
        return new Response(JSON.stringify(rows), { status: 200 });
      }
      if (method === 'POST') {
        if (onConflict && db.enforcePartialIndexOnClientId) {
          return new Response(
            JSON.stringify({
              code: '42P10',
              message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
            }),
            { status: 400 }
          );
        }
        const incoming = JSON.parse(String(init?.body || '[]')) as any[];
        const saved: any[] = [];
        for (const row of incoming) {
          if (row.user_id !== uid) {
            return new Response(JSON.stringify({ code: '42501', message: 'RLS violation' }), { status: 403 });
          }
          const key = `${uid}::${row.client_id}`;
          const existing = db.conversations.get(key);
          const next = {
            id: existing?.id || `uuid_conv_${db.conversations.size + 1}`,
            ...existing,
            ...row,
          };
          db.conversations.set(key, next);
          saved.push(next);
        }
        return new Response(JSON.stringify(saved), { status: 200 });
      }
      if (method === 'PATCH') {
        const patch = JSON.parse(String(init?.body || '{}'));
        const key = `${uid}::${clientIdEq}`;
        const existing = db.conversations.get(key);
        if (!existing) return new Response(JSON.stringify([]), { status: 200 });
        const next = { ...existing, ...patch };
        db.conversations.set(key, next);
        return new Response(JSON.stringify([next]), { status: 200 });
      }
      if (method === 'DELETE') {
        const key = `${uid}::${clientIdEq}`;
        const existing = db.conversations.get(key);
        db.conversations.delete(key);
        if (existing) {
          for (const [mKey, msg] of db.messages.entries()) {
            if (msg.user_id === uid && msg.conversation_id === existing.id) {
              db.messages.delete(mKey);
            }
          }
        }
        return new Response(null, { status: 204 });
      }
    }

    if (table === 'companion_messages') {
      if (method === 'GET') {
        const rows = Array.from(db.messages.values()).filter(
          (m) => m.user_id === uid && (!clientIdEq || m.client_id === clientIdEq)
        );
        return new Response(JSON.stringify(rows), { status: 200 });
      }
      if (method === 'POST') {
        if (onConflict && db.enforcePartialIndexOnClientId) {
          return new Response(
            JSON.stringify({
              code: '42P10',
              message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
            }),
            { status: 400 }
          );
        }
        const incoming = JSON.parse(String(init?.body || '[]')) as any[];
        const saved: any[] = [];
        for (const row of incoming) {
          if (row.user_id !== uid) {
            return new Response(JSON.stringify({ code: '42501', message: 'RLS violation' }), { status: 403 });
          }
          const key = `${uid}::${row.client_id}`;
          const existing = db.messages.get(key);
          const next = {
            id: existing?.id || `uuid_msg_${db.messages.size + 1}`,
            ...existing,
            ...row,
          };
          db.messages.set(key, next);
          saved.push(next);
        }
        return new Response(JSON.stringify(saved), { status: 200 });
      }
      if (method === 'PATCH') {
        const patch = JSON.parse(String(init?.body || '{}'));
        const key = `${uid}::${clientIdEq}`;
        const existing = db.messages.get(key);
        if (!existing) return new Response(JSON.stringify([]), { status: 200 });
        const next = { ...existing, ...patch };
        db.messages.set(key, next);
        return new Response(JSON.stringify([next]), { status: 200 });
      }
    }

    if (table === 'companion_memories') {
      if (method === 'GET') {
        const rows = Array.from(db.memories.values())
          .filter((m) => m.user_id === uid && (!clientIdEq || m.client_id === clientIdEq))
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        return new Response(JSON.stringify(rows), { status: 200 });
      }
      if (method === 'POST') {
        if (onConflict && db.enforcePartialIndexOnClientId) {
          return new Response(
            JSON.stringify({
              code: '42P10',
              message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
            }),
            { status: 400 }
          );
        }
        const incoming = JSON.parse(String(init?.body || '[]')) as any[];
        const saved: any[] = [];
        for (const row of incoming) {
          if (row.user_id !== uid) {
            return new Response(JSON.stringify({ code: '42501', message: 'RLS violation' }), { status: 403 });
          }
          const key = `${uid}::${row.client_id}`;
          const existing = db.memories.get(key);
          const next = {
            id: existing?.id || `uuid_mem_${db.memories.size + 1}`,
            ...existing,
            ...row,
          };
          db.memories.set(key, next);
          saved.push(next);
        }
        return new Response(JSON.stringify(saved), { status: 200 });
      }
      if (method === 'PATCH') {
        const patch = JSON.parse(String(init?.body || '{}'));
        const key = `${uid}::${clientIdEq}`;
        const existing = db.memories.get(key);
        if (!existing) return new Response(JSON.stringify([]), { status: 200 });
        const next = { ...existing, ...patch };
        db.memories.set(key, next);
        return new Response(JSON.stringify([next]), { status: 200 });
      }
      if (method === 'DELETE') {
        db.memories.delete(`${uid}::${clientIdEq}`);
        return new Response(null, { status: 204 });
      }
    }

    return new Response(JSON.stringify([]), { status: 200 });
  }) as typeof fetch;
}

function cleanupUsers(userIds: string[]) {
  cloudSyncCoordinator.resetAllEnginesOnSignOut();
  companionData.resetCloudSyncHealth();
  for (const uid of userIds) {
    storageService.remove(`${STORAGE_KEYS.conversations}:user:${uid}`);
    storageService.remove(`${STORAGE_KEYS.activeConversationId}:user:${uid}`);
    storageService.remove(`angel_active_studio_convs_v1:user:${uid}`);
    storageService.remove(`angel_conv_pending_deletes_v1:user:${uid}`);
    storageService.remove(`angel_memory_records_v1:user:${uid}`);
    storageService.remove(`angel_memory_knowledge_v1:user:${uid}`);
    storageService.remove(`angel_memory_pending_sync_v1:user:${uid}`);
    storageService.remove(`angel_memory_pending_deletes_v1:user:${uid}`);
    storageService.remove(`angel_conv_recent_cache_v1:${uid}`);
  }
}

test('Cloud persistence handles 42P10 partial unique index fallback, chronological ordering, and RLS two-user isolation', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const db: InMemorySupabaseDb = {
    conversations: new Map(),
    messages: new Map(),
    memories: new Map(),
    enforcePartialIndexOnClientId: true, // Simulates live schema before forward migration is applied
  };

  try {
    process.env.VITE_SUPABASE_URL = TEST_SUPABASE_URL;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = TEST_PUBLISHABLE_KEY;
    globalThis.fetch = createRlsContractFetch(db);

    const t0 = '2026-11-24T12:00:00.000Z';
    const t1 = '2026-11-24T12:00:01.000Z';
    const t2 = '2026-11-24T12:00:02.000Z';

    // User A syncs conversation with 3 chronological messages & a memory while DB enforces 42P10 on partial unique index
    await companionData.syncThreads(
      'jwt_user_a',
      [
        {
          id: 'conv_alpha_1',
          title: 'Alpha Architecture Thread',
          createdAt: t0,
          updatedAt: t2,
          isArchived: false,
          isCustomTitle: true,
          scope: 'general',
          messages: [
            { id: 'm1', sender: 'user', content: 'First message', timestamp: '12:00 PM', createdAt: t0, sequence: 0, status: 'completed' },
            { id: 'm2', sender: 'angel', content: 'Second message', timestamp: '12:00 PM', createdAt: t1, sequence: 1, status: 'completed', modelUsed: 'gemini-3.8-flash' },
            { id: 'm3', sender: 'user', content: 'Third message', timestamp: '12:00 PM', createdAt: t2, sequence: 2, status: 'completed' },
          ],
        },
      ],
      'user_cloud_alpha'
    );

    await companionData.syncMemories(
      'jwt_user_a',
      [
        {
          id: 'mem_alpha_1',
          category: 'personal',
          scope: 'general',
          title: 'Primary Language',
          content: 'Prefers concise TypeScript examples',
          timestamp: t0,
          updatedAt: t1,
        },
      ],
      'user_cloud_alpha'
    );

    // Health recovers to healthy after automatic 42P10 fallback succeeds
    assert.equal(companionData.getCloudSyncHealth().status, 'healthy');

    // User A reloads and sees exact chronological message order + custom title + memory
    const loadedA = await companionData.loadThreads('jwt_user_a');
    assert.equal(loadedA.length, 1);
    assert.equal(loadedA[0].title, 'Alpha Architecture Thread');
    assert.equal(loadedA[0].isCustomTitle, true);
    assert.deepEqual(
      loadedA[0].messages.map((m) => m.id),
      ['m1', 'm2', 'm3']
    );

    const memoriesA = await companionData.loadMemories('jwt_user_a');
    assert.equal(memoriesA.length, 1);
    assert.equal(memoriesA[0].content, 'Prefers concise TypeScript examples');

    // User B cannot see or access any of User A's cloud records via RLS
    const loadedB = await companionData.loadThreads('jwt_user_b');
    const memoriesB = await companionData.loadMemories('jwt_user_b');
    assert.equal(loadedB.length, 0);
    assert.equal(memoriesB.length, 0);

    // Idempotent second sync updates without duplicating rows
    await companionData.syncThreads(
      'jwt_user_a',
      [
        {
          ...loadedA[0],
          title: 'Alpha Architecture Thread v2',
          updatedAt: '2026-11-24T12:01:00.000Z',
        },
      ],
      'user_cloud_alpha'
    );
    const reloadedA = await companionData.loadThreads('jwt_user_a');
    assert.equal(reloadedA.length, 1);
    assert.equal(reloadedA[0].title, 'Alpha Architecture Thread v2');
    assert.equal(reloadedA[0].messages.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey;
    cleanupUsers(['user_cloud_alpha', 'user_cloud_beta']);
  }
});

test('Offline changes & deletes queue cleanly, do not overwrite newer cloud metadata on conflict, and reconcile on reconnect', async () => {
  const originalFetch = globalThis.fetch;
  const originalNavigator = (globalThis as any).navigator;
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const db: InMemorySupabaseDb = {
    conversations: new Map(),
    messages: new Map(),
    memories: new Map(),
    enforcePartialIndexOnClientId: false,
  };

  let simulatedOnline = true;

  try {
    process.env.VITE_SUPABASE_URL = TEST_SUPABASE_URL;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = TEST_PUBLISHABLE_KEY;
    globalThis.fetch = createRlsContractFetch(db);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        get onLine() {
          return simulatedOnline;
        },
      },
    });

    // Seed cloud with a conversation from another device that has a NEWER updatedAt title + a thread to delete offline
    await companionData.syncThreads(
      'jwt_user_a',
      [
        {
          id: 'conv_conflict',
          title: 'Remote Device Renamed Title',
          createdAt: '2026-11-24T09:00:00.000Z',
          updatedAt: '2026-11-24T15:00:00.000Z',
          isArchived: false,
          isCustomTitle: true,
          scope: 'general',
          messages: [
            { id: 'remote_m1', sender: 'user', content: 'Cloud message', timestamp: '09:00', createdAt: '2026-11-24T09:00:00.000Z', sequence: 0, status: 'completed' },
          ],
        },
        {
          id: 'conv_to_delete_offline',
          title: 'Delete Me Offline',
          createdAt: '2026-11-24T08:00:00.000Z',
          updatedAt: '2026-11-24T08:05:00.000Z',
          isArchived: false,
          scope: 'general',
          messages: [
            { id: 'del_m1', sender: 'user', content: 'Temp', timestamp: '08:00', createdAt: '2026-11-24T08:00:00.000Z', sequence: 0, status: 'completed' },
          ],
        },
      ],
      'user_cloud_alpha'
    );

    // Pre-populate stale local cache BEFORE going online for conflict test
    storageService.save(`${STORAGE_KEYS.conversations}:user:user_cloud_alpha`, [
      {
        id: 'conv_conflict',
        title: 'Stale Local Title',
        createdAt: '2026-11-24T09:00:00.000Z',
        updatedAt: '2026-11-24T10:00:00.000Z', // Older than cloud!
        isArchived: false,
        scope: 'general',
        messages: [
          { id: 'local_offline_msg', sender: 'user', content: 'Local unsynced msg', timestamp: '10:00', createdAt: '2026-11-24T10:00:00.000Z', sequence: 1, status: 'completed' },
        ],
      },
      {
        id: 'conv_to_delete_offline',
        title: 'Delete Me Offline',
        createdAt: '2026-11-24T08:00:00.000Z',
        updatedAt: '2026-11-24T08:05:00.000Z',
        isArchived: false,
        scope: 'general',
        messages: [],
      },
    ]);

    // Authenticate online -> restoreCloud preserves newer remote title AND merges both messages chronologically!
    await cloudSyncCoordinator.handleAuthChange({
      status: 'authenticated',
      accessToken: 'jwt_user_a',
      userId: 'user_cloud_alpha',
    });
    await new Promise((r) => setTimeout(r, 30));

    const conflictThreadAfterHydrate = conversationEngine
      .getThreads('general')
      .find((t) => t.id === 'conv_conflict');
    assert.ok(conflictThreadAfterHydrate);
    assert.equal(conflictThreadAfterHydrate!.title, 'Remote Device Renamed Title');
    assert.deepEqual(
      conflictThreadAfterHydrate!.messages.map((m) => m.id),
      ['remote_m1', 'local_offline_msg']
    );

    // Now go OFFLINE, delete 'conv_to_delete_offline', create an offline memory & delete a memory
    const onlineMem = memoryEngine.saveMemory({
      category: 'personal',
      scope: 'general',
      title: 'Online Mem',
      content: 'Created while online',
    });
    await new Promise((r) => setTimeout(r, 25));

    simulatedOnline = false;
    assert.equal(conversationEngine.deleteThread('conv_to_delete_offline'), true);
    const offlineMem = memoryEngine.saveMemory({
      category: 'personal',
      scope: 'general',
      title: 'Offline Mem',
      content: 'Queued while offline',
    });
    assert.equal(memoryEngine.deleteMemory(onlineMem.id), true);

    assert.equal(conversationEngine.getOfflineCacheStatus().pendingCloudSync, true);
    assert.equal(memoryEngine.getPendingSyncState().pendingCloudSync, true);
    assert.ok(memoryEngine.getPendingSyncState().pendingDeletes.includes(onlineMem.id));

    // Reconnect online and reconcile -> pending deletes flush & offline records push to Supabase!
    simulatedOnline = true;
    await cloudSyncCoordinator.reconcilePendingSync();

    assert.equal(conversationEngine.getOfflineCacheStatus().pendingCloudSync, false);
    assert.equal(memoryEngine.getPendingSyncState().pendingCloudSync, false);
    assert.equal(memoryEngine.getPendingSyncState().pendingDeletes.length, 0);

    const cloudThreadsAfterReconnect = await companionData.loadThreads('jwt_user_a');
    assert.equal(
      cloudThreadsAfterReconnect.some((t) => t.id === 'conv_to_delete_offline'),
      false
    );

    const cloudMemoriesAfterReconnect = await companionData.loadMemories('jwt_user_a');
    assert.equal(
      cloudMemoriesAfterReconnect.some((m) => m.id === onlineMem.id),
      false
    );
    assert.equal(
      cloudMemoriesAfterReconnect.some((m) => m.id === offlineMem.id && m.content === 'Queued while offline'),
      true
    );
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey;
    cleanupUsers(['user_cloud_alpha', 'user_cloud_beta']);
  }
});

test('sortMessagesChronologically & mergeConversationSnapshots never scramble chronological sequence or drop failed/offline messages', () => {
  const sorted = sortMessagesChronologically([
    { id: 'm3', sender: 'user', content: 'Third', timestamp: '10:02 AM', createdAt: '2026-11-24T10:02:00.000Z', sequence: 2 },
    { id: 'm1', sender: 'user', content: 'First', timestamp: '10:00 AM', createdAt: '2026-11-24T10:00:00.000Z', sequence: 0 },
    { id: 'm2', sender: 'angel', content: 'Second', timestamp: '10:01 AM', createdAt: '2026-11-24T10:01:00.000Z', sequence: 1 },
  ]);
  assert.deepEqual(
    sorted.map((m) => m.id),
    ['m1', 'm2', 'm3']
  );

  const merged = mergeConversationSnapshots(
    [
      {
        id: 't1',
        title: 'Local',
        scope: 'general',
        createdAt: '2026-11-24T10:00:00.000Z',
        updatedAt: '2026-11-24T10:05:00.000Z',
        isArchived: false,
        messages: [
          { id: 'm1', sender: 'user', content: 'First', timestamp: '10:00', createdAt: '2026-11-24T10:00:00.000Z', sequence: 0, status: 'completed' },
          { id: 'm2', sender: 'angel', content: 'Retrying', timestamp: '10:01', createdAt: '2026-11-24T10:01:00.000Z', sequence: 1, status: 'failed' },
        ],
      },
    ],
    [
      {
        id: 't1',
        title: 'Cached',
        scope: 'general',
        createdAt: '2026-11-24T10:00:00.000Z',
        updatedAt: '2026-11-24T10:06:00.000Z',
        isArchived: false,
        messages: [
          { id: 'm2', sender: 'angel', content: 'Done', timestamp: '10:01', createdAt: '2026-11-24T10:01:00.000Z', sequence: 1, status: 'completed' },
          { id: 'm3', sender: 'user', content: 'Follow up', timestamp: '10:02', createdAt: '2026-11-24T10:02:00.000Z', sequence: 2, status: 'completed' },
        ],
      },
    ]
  );

  assert.equal(merged[0].title, 'Cached');
  assert.deepEqual(
    merged[0].messages.map((m) => `${m.id}:${m.status}`),
    ['m1:completed', 'm2:completed', 'm3:completed']
  );
});
