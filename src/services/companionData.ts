import type { ChatMessage, StudioId } from '../types/angel';
import type { MemoryRecord } from './memoryEngine';
import type { LibraryItem } from './libraryService';
import type { WorkspaceProject } from './workspaceEngine';
import type { StudioState } from './studiosEngine';
import type { AgentExecutionRecord } from './agentEngine';
import { logSanitizedDiagnostic } from './errorHandlingService';

const viteEnv = (import.meta as unknown as {
  env?: Record<string, string | undefined>;
}).env;

function readSupabaseConfig(): { url: string | null; key: string | null } {
  const url =
    viteEnv?.VITE_SUPABASE_URL ||
    (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL : undefined);
  const key =
    viteEnv?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    viteEnv?.VITE_SUPABASE_ANON_KEY ||
    (typeof process !== 'undefined'
      ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY
      : undefined);
  return {
    url: url?.trim() || null,
    key: key?.trim() || null,
  };
}

export const PRIVATE_STORAGE_BUCKET = 'companion-private';

export interface CloudSyncHealthState {
  status: 'healthy' | 'degraded' | 'missing_tables';
  missingTables: string[];
  lastError: string | null;
  lastErrorAt: string | null;
}

const cloudSyncHealth: CloudSyncHealthState = {
  status: 'healthy',
  missingTables: [],
  lastError: null,
  lastErrorAt: null,
};

const cloudHealthListeners = new Set<(state: CloudSyncHealthState) => void>();

function notifyCloudHealth() {
  const snapshot: CloudSyncHealthState = {
    ...cloudSyncHealth,
    missingTables: [...cloudSyncHealth.missingTables],
  };
  cloudHealthListeners.forEach((fn) => fn(snapshot));
}

function extractTableNameFromPath(path: string): string | null {
  const clean = path.split('?')[0].replace(/^\/+/, '');
  return clean.startsWith('companion_') ? clean : null;
}

function isMissingRelationError(status: number, body: any): boolean {
  const code = String(body?.code || '').toUpperCase();
  const msg = String(body?.message || body?.details || '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    (status === 404 && (msg.includes('could not find the table') || msg.includes('schema cache') || msg.includes('does not exist'))) ||
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

function isOnConflictConstraintError(status: number, body: any): boolean {
  const code = String(body?.code || '').toUpperCase();
  const msg = String(body?.message || body?.details || '').toLowerCase();
  return (
    code === '42P10' ||
    (status === 400 && msg.includes('on conflict') && msg.includes('constraint'))
  );
}

async function rawRestRequest(path: string, token: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  const { url, key } = readSupabaseConfig();
  if (!url || !key) {
    throw new Error('Cloud persistence is not configured.');
  }

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=representation',
      ...(init.headers || {}),
    },
  });

  if (response.status === 204) {
    return { ok: true, status: 204, body: null };
  }
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

async function restRequest(path: string, token: string, init: RequestInit = {}) {
  const method = (init.method || 'GET').toUpperCase();
  const endpointPath = `/rest/v1/${path.split('?')[0]}`;
  const startedAt = Date.now();

  const { ok, status, body } = await rawRestRequest(path, token, init);
  if (!ok) {
    const durationMs = Date.now() - startedAt;
    const tableName = extractTableNameFromPath(path);
    const missingTable = isMissingRelationError(status, body);
    const message = body?.message || body?.details || `Cloud sync request failed (${status}).`;
    const isConversationTable = tableName === 'companion_conversations' || tableName === 'companion_messages';
    const errorCode = missingTable
      ? 'MISSING_TABLE'
      : isConversationTable
        ? 'CONVERSATION_PERSISTENCE_FAILED'
        : 'CLOUD_SYNC_FAILED';

    if (missingTable && tableName && !cloudSyncHealth.missingTables.includes(tableName)) {
      cloudSyncHealth.missingTables.push(tableName);
    }
    cloudSyncHealth.status = cloudSyncHealth.missingTables.length > 0 ? 'missing_tables' : 'degraded';
    cloudSyncHealth.lastError = missingTable && tableName
      ? `Cloud table public.${tableName} is not provisioned in Supabase yet.`
      : 'Cloud synchronization encountered a temporary server error.';
    cloudSyncHealth.lastErrorAt = new Date().toISOString();

    logSanitizedDiagnostic({
      category: 'server_failure',
      context: 'feature',
      statusCode: status,
      rawError: message,
      metadata: {
        endpoint: endpointPath,
        method,
        durationMs,
        errorCode,
        stage: 'supabase_rest',
        table: tableName || 'unknown',
        missingTable,
        pgCode: typeof body?.code === 'string' ? body.code : 'none',
      },
    });
    notifyCloudHealth();

    const err = new Error(message) as Error & { __companionReported?: boolean };
    err.__companionReported = true;
    throw err;
  }

  if (cloudSyncHealth.status !== 'healthy') {
    cloudSyncHealth.status = 'healthy';
    cloudSyncHealth.missingTables = [];
    cloudSyncHealth.lastError = null;
    cloudSyncHealth.lastErrorAt = null;
    notifyCloudHealth();
  }
  return body;
}

/**
 * Performs idempotent (user_id, client_id) upsert. If PostgreSQL rejects ON CONFLICT
 * due to a partial unique index (42P10), falls back cleanly to SELECT + PATCH/INSERT.
 */
async function upsertByUserClientId<T extends { user_id: string; client_id: string }>(
  table: string,
  token: string,
  userId: string,
  rows: T[]
): Promise<any[]> {
  if (!rows.length) return [];

  const attempt = await rawRestRequest(`${table}?on_conflict=user_id,client_id`, token, {
    method: 'POST',
    body: JSON.stringify(rows),
  });

  if (attempt.ok) {
    if (cloudSyncHealth.status !== 'healthy') {
      cloudSyncHealth.status = 'healthy';
      cloudSyncHealth.missingTables = [];
      cloudSyncHealth.lastError = null;
      cloudSyncHealth.lastErrorAt = null;
      notifyCloudHealth();
    }
    return Array.isArray(attempt.body) ? attempt.body : [];
  }

  if (!isOnConflictConstraintError(attempt.status, attempt.body)) {
    // Let standard restRequest error reporting run once cleanly
    return restRequest(`${table}?on_conflict=user_id,client_id`, token, {
      method: 'POST',
      body: JSON.stringify(rows),
    });
  }

  // Fallback for partial unique indexes (e.g. WHERE client_id IS NOT NULL):
  const existingRows = await restRequest(
    `${table}?user_id=eq.${encodeURIComponent(userId)}&select=id,client_id`,
    token,
    { method: 'GET', headers: { prefer: 'return=representation' } }
  );
  const existingClientIds = new Set(
    (Array.isArray(existingRows) ? existingRows : [])
      .map((r: any) => r?.client_id)
      .filter((cid: unknown): cid is string => typeof cid === 'string' && cid.length > 0)
  );

  const toUpdate = rows.filter((r) => existingClientIds.has(r.client_id));
  const toInsert = rows.filter((r) => !existingClientIds.has(r.client_id));
  const resultRows: any[] = [];

  for (const row of toUpdate) {
    const updated = await restRequest(
      `${table}?user_id=eq.${encodeURIComponent(userId)}&client_id=eq.${encodeURIComponent(row.client_id)}`,
      token,
      {
        method: 'PATCH',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify(row),
      }
    );
    if (Array.isArray(updated)) resultRows.push(...updated);
  }

  if (toInsert.length > 0) {
    const inserted = await restRequest(table, token, {
      method: 'POST',
      headers: { prefer: 'return=representation' },
      body: JSON.stringify(toInsert),
    });
    if (Array.isArray(inserted)) resultRows.push(...inserted);
  }

  return resultRows;
}

async function resolveVerifiedUserId(token: string, expectedUserId?: string | null): Promise<string> {
  if (expectedUserId) return expectedUserId;
  const { url, key } = readSupabaseConfig();
  if (!url || !key) {
    throw new Error('Cloud persistence is not configured.');
  }

  const authResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${token}` },
  });
  if (!authResponse.ok) {
    throw new Error('Your session expired. Sign in again to sync with the cloud.');
  }
  const user = (await authResponse.json()) as { id?: string };
  if (!user?.id) {
    throw new Error('Verified user identity is missing.');
  }
  return user.id;
}

function sanitizeStorageSegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

export const companionData = {
  isCloudConfigured(): boolean {
    const { url, key } = readSupabaseConfig();
    return Boolean(url && key);
  },

  getCloudSyncHealth(): CloudSyncHealthState {
    return {
      ...cloudSyncHealth,
      missingTables: [...cloudSyncHealth.missingTables],
    };
  },

  subscribeCloudSyncHealth(listener: (state: CloudSyncHealthState) => void): () => void {
    cloudHealthListeners.add(listener);
    listener(this.getCloudSyncHealth());
    return () => {
      cloudHealthListeners.delete(listener);
    };
  },

  resetCloudSyncHealth(): void {
    cloudSyncHealth.status = 'healthy';
    cloudSyncHealth.missingTables = [];
    cloudSyncHealth.lastError = null;
    cloudSyncHealth.lastErrorAt = null;
    notifyCloudHealth();
  },

  reportEngineSyncError(
    table: string,
    error: unknown,
    details?: { statusCode?: number; errorCode?: string; endpoint?: string; method?: string }
  ): void {
    if ((error as { __companionReported?: boolean } | null)?.__companionReported) {
      return;
    }
    const rawMsg = error instanceof Error ? error.message : String(error || 'Cloud sync failure');
    const lower = rawMsg.toLowerCase();
    const missing =
      lower.includes('could not find the table') ||
      lower.includes('does not exist') ||
      lower.includes('pgrst205') ||
      lower.includes('schema cache');

    if (missing && !cloudSyncHealth.missingTables.includes(table)) {
      cloudSyncHealth.missingTables.push(table);
    }
    cloudSyncHealth.status = cloudSyncHealth.missingTables.length > 0 ? 'missing_tables' : 'degraded';
    cloudSyncHealth.lastError = missing
      ? `Cloud table public.${table} is pending migration; changes are preserved locally.`
      : 'Cloud sync paused temporarily; changes are preserved locally.';
    cloudSyncHealth.lastErrorAt = new Date().toISOString();
    logSanitizedDiagnostic({
      category: 'server_failure',
      context: 'feature',
      statusCode: details?.statusCode,
      rawError: rawMsg,
      metadata: {
        table,
        missingTable: missing,
        errorCode: details?.errorCode || (missing ? 'MISSING_TABLE' : 'CLOUD_SYNC_FAILED'),
        ...(details?.endpoint ? { endpoint: details.endpoint } : {}),
        ...(details?.method ? { method: details.method } : {}),
        stage: 'supabase_sync',
      },
    });
    notifyCloudHealth();
  },

  // --- CONVERSATIONS & MESSAGES ---
  async loadThreads(token: string): Promise<Array<{
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
  }>> {
    const rows = await restRequest(
      'companion_conversations?select=*,companion_messages(*)&order=updated_at.desc&limit=100',
      token,
      { method: 'GET', headers: { prefer: 'return=representation' } }
    );

    return (Array.isArray(rows) ? rows : []).map((row: any) => {
      const cloudMessages = Array.isArray(row.companion_messages)
        ? [...row.companion_messages]
        : [];
      cloudMessages.sort((a: any, b: any) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (!Number.isNaN(diff) && diff !== 0) return diff;
        const seqA = typeof a.metadata?.sequence === 'number' ? a.metadata.sequence : 0;
        const seqB = typeof b.metadata?.sequence === 'number' ? b.metadata.sequence : 0;
        if (seqA !== seqB) return seqA - seqB;
        return String(a.client_id || a.id).localeCompare(String(b.client_id || b.id));
      });

      const messages: ChatMessage[] = cloudMessages.map((message: any, idx: number) => ({
        id: message.client_id || message.id,
        sender: message.role === 'assistant' ? 'angel' : message.role === 'system' ? 'system' : 'user',
        content: message.content,
        timestamp: message.metadata?.localTimestamp || message.created_at,
        createdAt: message.metadata?.createdAt || message.created_at,
        sequence: typeof message.metadata?.sequence === 'number' ? message.metadata.sequence : idx,
        mode: message.metadata?.mode || undefined,
        attachments: message.metadata?.attachments || undefined,
        attachmentDetails: Array.isArray(message.metadata?.attachmentDetails)
          ? message.metadata.attachmentDetails
          : undefined,
        linkPreviews: Array.isArray(message.metadata?.linkPreviews)
          ? message.metadata.linkPreviews
          : undefined,
        status: message.metadata?.status || 'completed',
        error: message.metadata?.error || undefined,
        modelUsed: message.metadata?.modelUsed || undefined,
        requestedModel: message.metadata?.requestedModel || undefined,
        fallbackActivated:
          typeof message.metadata?.fallbackActivated === 'boolean'
            ? message.metadata.fallbackActivated
            : undefined,
        requestedMode: message.metadata?.requestedMode || undefined,
        appliedMode: message.metadata?.appliedMode || undefined,
        thinkingLevel: message.metadata?.thinkingLevel || undefined,
      }));

      const metaHolder = [...cloudMessages].reverse().find((m: any) => m?.metadata) || cloudMessages[0];
      const threadMeta = metaHolder?.metadata || {};
      return {
        id: row.client_id || row.id,
        title: row.title,
        scope: threadMeta.scope === 'studio' ? 'studio' : 'general',
        studioId: threadMeta.studioId ? (threadMeta.studioId as StudioId) : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        isArchived: row.status === 'archived',
        isCustomTitle: Boolean(threadMeta.isCustomTitle),
        messages,
        ...(threadMeta.threadMetadata ? { metadata: threadMeta.threadMetadata } : {}),
      };
    });
  },

  async syncThreads(
    token: string,
    threads: Array<{
      id: string;
      title: string;
      createdAt: string;
      updatedAt: string;
      isArchived: boolean;
      isCustomTitle?: boolean;
      scope: string;
      studioId?: string;
      messages: ChatMessage[];
      metadata?: {
        tags?: string[];
        summary?: string;
        handoffFromId?: string;
      };
    }>,
    knownUserId?: string | null
  ): Promise<void> {
    if (!threads.length) return;
    const userId = await resolveVerifiedUserId(token, knownUserId);

    for (const thread of threads) {
      const rows = await upsertByUserClientId('companion_conversations', token, userId, [
        {
          user_id: userId,
          client_id: thread.id,
          title: thread.title,
          status: thread.isArchived ? 'archived' : 'active',
          created_at: thread.createdAt,
          updated_at: thread.updatedAt,
        },
      ]);

      const cloudThread = Array.isArray(rows) ? rows[0] : null;
      if (!cloudThread?.id || !thread.messages.length) continue;

      const baseTimeMs = Number.isFinite(Date.parse(thread.createdAt))
        ? Date.parse(thread.createdAt)
        : Date.now();
      let lastTsMs = baseTimeMs - 1;

      const messageRows = thread.messages.map((message, index) => {
        const parsedMsgMs = message.createdAt ? Date.parse(message.createdAt) : NaN;
        const monotonicMs = Number.isFinite(parsedMsgMs)
          ? Math.max(parsedMsgMs, lastTsMs + 1)
          : Math.max(baseTimeMs + index, lastTsMs + 1);
        lastTsMs = monotonicMs;
        const createdIso = new Date(monotonicMs).toISOString();
        const dbRole: 'user' | 'assistant' | 'system' =
          message.sender === 'angel' ? 'assistant' : message.sender === 'system' ? 'system' : 'user';

        return {
          user_id: userId,
          conversation_id: cloudThread.id,
          client_id: message.id,
          role: dbRole,
          content: message.content,
          metadata: {
            localTimestamp: message.timestamp,
            createdAt: message.createdAt || createdIso,
            sequence: index,
            mode: message.mode || null,
            attachments: message.attachments || [],
            ...(message.attachmentDetails?.length ? { attachmentDetails: message.attachmentDetails } : {}),
            ...(message.linkPreviews?.length ? { linkPreviews: message.linkPreviews } : {}),
            scope: thread.scope,
            studioId: thread.studioId || null,
            isCustomTitle: Boolean(thread.isCustomTitle),
            ...(thread.metadata ? { threadMetadata: thread.metadata } : {}),
            status: message.status || 'completed',
            error: message.error || null,
            modelUsed: message.modelUsed || null,
            requestedModel: message.requestedModel || null,
            ...(typeof message.fallbackActivated === 'boolean'
              ? { fallbackActivated: message.fallbackActivated }
              : {}),
            requestedMode: message.requestedMode || null,
            appliedMode: message.appliedMode || null,
            thinkingLevel: message.thinkingLevel || null,
          },
          created_at: createdIso,
        };
      });

      await upsertByUserClientId('companion_messages', token, userId, messageRows);
    }
  },

  async deleteThread(token: string, clientThreadId: string): Promise<void> {
    await restRequest(
      `companion_conversations?client_id=eq.${encodeURIComponent(clientThreadId)}`,
      token,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );
  },

  // --- PROFILES & USER PREFERENCES ---
  async loadProfilePreferences(token: string, knownUserId?: string | null): Promise<{
    displayName?: string;
    preferences: Record<string, any>;
  } | null> {
    const userId = await resolveVerifiedUserId(token, knownUserId);
    const rows = await restRequest(
      `companion_profiles?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
      token,
      { method: 'GET', headers: { prefer: 'return=representation' } }
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    return {
      displayName: row.display_name || undefined,
      preferences: row.preferences || {},
    };
  },

  async syncProfilePreferences(
    token: string,
    payload: { displayName?: string; preferences: Record<string, any> },
    knownUserId?: string | null
  ): Promise<void> {
    const userId = await resolveVerifiedUserId(token, knownUserId);
    await restRequest('companion_profiles?on_conflict=user_id', token, {
      method: 'POST',
      body: JSON.stringify([
        {
          user_id: userId,
          display_name: payload.displayName || null,
          preferences: payload.preferences,
          updated_at: new Date().toISOString(),
        },
      ]),
    });
  },

  // --- MEMORIES ---
  async loadMemories(token: string): Promise<MemoryRecord[]> {
    const rows = await restRequest(
      'companion_memories?order=updated_at.desc&limit=500',
      token,
      { method: 'GET', headers: { prefer: 'return=representation' } }
    );
    return (Array.isArray(rows) ? rows : []).map((row: any) => {
      const meta = row.metadata || {};
      return {
        id: row.client_id || row.id,
        category: row.memory_type || 'personal',
        scope: meta.scope || 'general',
        studioId: meta.studioId || undefined,
        projectId: meta.projectId || undefined,
        title: meta.title || row.content.slice(0, 48),
        content: row.content,
        tags: Array.isArray(meta.tags) ? meta.tags : undefined,
        source: meta.source || undefined,
        timestamp: row.created_at,
        updatedAt: row.updated_at,
        isSensitive: Boolean(meta.isSensitive),
        conflictNote: meta.conflictNote || undefined,
      };
    });
  },

  async syncMemories(token: string, memories: MemoryRecord[], knownUserId?: string | null): Promise<void> {
    if (!memories.length) return;
    const userId = await resolveVerifiedUserId(token, knownUserId);
    const rows = memories.map((m) => ({
      user_id: userId,
      client_id: m.id,
      memory_type: m.category,
      content: m.content,
      importance: m.isSensitive ? 5 : 3,
      metadata: {
        title: m.title,
        scope: m.scope,
        studioId: m.studioId || null,
        projectId: m.projectId || null,
        tags: m.tags || [],
        source: m.source || null,
        isSensitive: Boolean(m.isSensitive),
        conflictNote: m.conflictNote || null,
      },
      created_at: m.timestamp || new Date().toISOString(),
      updated_at: m.updatedAt || m.timestamp || new Date().toISOString(),
    }));

    await upsertByUserClientId('companion_memories', token, userId, rows);
  },

  async deleteMemory(token: string, clientId: string): Promise<void> {
    await restRequest(
      `companion_memories?client_id=eq.${encodeURIComponent(clientId)}`,
      token,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );
  },

  // --- PRIVATE STORAGE OBJECTS (companion-private) ---
  async uploadPrivateFile(
    token: string,
    userId: string,
    itemId: string,
    fileName: string,
    content: string | Blob | ArrayBuffer,
    mimeType = 'text/plain',
    conversationScope = 'general'
  ): Promise<string> {
    const { url, key } = readSupabaseConfig();
    if (!url || !key) throw new Error('Cloud storage is not configured.');

    const storagePath = `${sanitizeStorageSegment(userId)}/${sanitizeStorageSegment(conversationScope || 'general')}/${sanitizeStorageSegment(itemId)}/${sanitizeStorageSegment(fileName)}`;
    const body = content instanceof Blob ? content : new Blob([content], { type: mimeType });

    const res = await fetch(`${url}/storage/v1/object/${PRIVATE_STORAGE_BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${token}`,
        'content-type': mimeType,
        'x-upsert': 'true',
      },
      body,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new Error(errBody?.message || `Storage upload failed (${res.status}).`);
    }
    return storagePath;
  },

  async getPrivateSignedUrl(
    token: string,
    storagePath: string,
    expiresInSeconds = 120,
    expectedUserId?: string | null
  ): Promise<string> {
    const { url, key } = readSupabaseConfig();
    if (!url || !key) throw new Error('Cloud storage is not configured.');
    if (!storagePath || storagePath.includes('..') || storagePath.startsWith('/')) {
      throw new Error('Invalid private storage path.');
    }
    if (expectedUserId && !storagePath.startsWith(`${expectedUserId}/`)) {
      throw new Error('Unauthorized private storage path access blocked.');
    }

    const boundedExpiry = Math.max(30, Math.min(300, Math.floor(expiresInSeconds)));
    const res = await fetch(`${url}/storage/v1/object/sign/${PRIVATE_STORAGE_BUCKET}/${storagePath}`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: boundedExpiry }),
    });

    const data = (await res.json().catch(() => null)) as { signedURL?: string } | null;
    if (!res.ok || !data?.signedURL) {
      throw new Error('Could not generate signed file URL.');
    }
    return data.signedURL.startsWith('http') ? data.signedURL : `${url}/storage/v1${data.signedURL}`;
  },

  async downloadPrivateFileBytes(
    token: string,
    storagePath: string,
    expectedUserId?: string | null
  ): Promise<ArrayBuffer | null> {
    const signedUrl = await this.getPrivateSignedUrl(token, storagePath, 60, expectedUserId);
    const res = await fetch(signedUrl);
    if (!res.ok) {
      throw new Error(`Could not retrieve private file (${res.status}).`);
    }
    return res.arrayBuffer();
  },

  async deletePrivateFile(token: string, storagePath: string, expectedUserId?: string | null): Promise<boolean> {
    const { url, key } = readSupabaseConfig();
    if (!url || !key || !storagePath) return false;
    if (storagePath.includes('..') || storagePath.startsWith('/')) return false;
    if (expectedUserId && !storagePath.startsWith(`${expectedUserId}/`)) {
      throw new Error('Unauthorized private storage delete blocked.');
    }

    const res = await fetch(`${url}/storage/v1/object/${PRIVATE_STORAGE_BUCKET}`, {
      method: 'DELETE',
      headers: {
        apikey: key,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [storagePath] }),
    });
    return res.ok;
  },

  // --- LIBRARY ITEMS ---
  async loadLibraryItems(token: string): Promise<LibraryItem[]> {
    const rows = await restRequest(
      'companion_library_items?order=updated_at.desc&limit=500',
      token,
      { method: 'GET', headers: { prefer: 'return=representation' } }
    );
    return (Array.isArray(rows) ? rows : []).map((row: any) => {
      const meta = row.metadata || {};
      return {
        id: row.client_id || row.id,
        type: row.item_type || 'documents',
        name: row.title,
        description: row.description || undefined,
        content: row.content_text || '',
        mimeType: meta.mimeType || 'text/plain',
        fileUrl: row.storage_path || meta.fileUrl || undefined,
        fileSize: typeof meta.fileSize === 'number' ? meta.fileSize : undefined,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        collection: meta.collection || undefined,
        projectId: meta.projectId || undefined,
        studioId: meta.studioId || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status: meta.status || 'ready',
        metadata: {
          ...(meta.customMeta || {}),
          storagePath: row.storage_path || undefined,
        },
      };
    });
  },

  async syncLibraryItems(token: string, items: LibraryItem[], knownUserId?: string | null): Promise<void> {
    if (!items.length) return;
    const userId = await resolveVerifiedUserId(token, knownUserId);

    const rows = [];
    for (const item of items) {
      let storagePath = item.metadata?.storagePath || (item.fileUrl && !item.fileUrl.startsWith('http') ? item.fileUrl : null);

      if (!storagePath && item.content && item.content.length > 0 && item.mimeType) {
        try {
          storagePath = await this.uploadPrivateFile(
            token,
            userId,
            item.id,
            item.name,
            item.content,
            item.mimeType
          );
          item.metadata = { ...(item.metadata || {}), storagePath };
        } catch {
          // Keep metadata & content_text sync operational even if storage upload rejects an exotic MIME
        }
      }

      rows.push({
        user_id: userId,
        client_id: item.id,
        title: item.name,
        item_type: item.type,
        description: item.description || null,
        storage_path: storagePath,
        content_text: item.content,
        metadata: {
          mimeType: item.mimeType || 'text/plain',
          fileUrl: item.fileUrl || null,
          fileSize: item.fileSize || null,
          tags: item.tags || [],
          collection: item.collection || null,
          projectId: item.projectId || null,
          studioId: item.studioId || null,
          status: item.status || 'ready',
          customMeta: item.metadata || {},
        },
        created_at: item.createdAt || new Date().toISOString(),
        updated_at: item.updatedAt || item.createdAt || new Date().toISOString(),
      });
    }

    await upsertByUserClientId('companion_library_items', token, userId, rows);
  },

  async deleteLibraryItem(token: string, clientId: string, storagePath?: string): Promise<void> {
    if (storagePath) {
      await this.deletePrivateFile(token, storagePath).catch(() => undefined);
    }
    await restRequest(
      `companion_library_items?client_id=eq.${encodeURIComponent(clientId)}`,
      token,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );
  },

  // --- WORKSPACE PROJECTS ---
  async loadWorkspaceProjects(token: string): Promise<WorkspaceProject[]> {
    const rows = await restRequest(
      'companion_projects?order=updated_at.desc&limit=200',
      token,
      { method: 'GET', headers: { prefer: 'return=representation' } }
    );
    return (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.client_id || row.id,
      name: row.name,
      description: row.description || '',
      studioId: row.studio_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      files: Array.isArray(row.files) ? row.files : [],
    }));
  },

  async syncWorkspaceProjects(
    token: string,
    projects: WorkspaceProject[],
    knownUserId?: string | null
  ): Promise<void> {
    if (!projects.length) return;
    const userId = await resolveVerifiedUserId(token, knownUserId);
    const rows = projects.map((p) => ({
      user_id: userId,
      client_id: p.id,
      name: p.name,
      description: p.description || '',
      studio_id: p.studioId || null,
      files: p.files || [],
      metadata: {},
      created_at: p.createdAt || new Date().toISOString(),
      updated_at: p.updatedAt || p.createdAt || new Date().toISOString(),
    }));

    await restRequest('companion_projects?on_conflict=user_id,client_id', token, {
      method: 'POST',
      body: JSON.stringify(rows),
    });
  },

  async deleteWorkspaceProject(token: string, clientId: string): Promise<void> {
    await restRequest(
      `companion_projects?client_id=eq.${encodeURIComponent(clientId)}`,
      token,
      { method: 'DELETE', headers: { prefer: 'return=minimal' } }
    );
  },

  // --- STUDIOS STATE ---
  async loadStudiosState(token: string): Promise<Partial<Record<StudioId, StudioState>>> {
    const rows = await restRequest(
      'companion_studios_state?select=*',
      token,
      { method: 'GET', headers: { prefer: 'return=representation' } }
    );
    const map: Partial<Record<StudioId, StudioState>> = {};
    (Array.isArray(rows) ? rows : []).forEach((row: any) => {
      if (row.studio_id) {
        map[row.studio_id as StudioId] = {
          studioId: row.studio_id as StudioId,
          activeTool: row.active_tool,
          canvasBuffer: row.canvas_buffer || '',
          history: Array.isArray(row.history) ? row.history : [],
        };
      }
    });
    return map;
  },

  async syncStudiosState(
    token: string,
    states: Record<StudioId, StudioState>,
    knownUserId?: string | null
  ): Promise<void> {
    const userId = await resolveVerifiedUserId(token, knownUserId);
    const rows = Object.values(states).map((s) => ({
      user_id: userId,
      studio_id: s.studioId,
      active_tool: s.activeTool,
      canvas_buffer: s.canvasBuffer || '',
      history: s.history || [],
      metadata: {},
      updated_at: new Date().toISOString(),
    }));
    if (!rows.length) return;

    await restRequest('companion_studios_state?on_conflict=user_id,studio_id', token, {
      method: 'POST',
      body: JSON.stringify(rows),
    });
  },

  // --- AGENT EXECUTIONS ---
  async loadAgentExecutions(token: string): Promise<AgentExecutionRecord[]> {
    const rows = await restRequest(
      'companion_agent_executions?order=started_at.desc&limit=100',
      token,
      { method: 'GET', headers: { prefer: 'return=representation' } }
    );
    return (Array.isArray(rows) ? rows : []).map((row: any) => ({
      id: row.client_id || row.id,
      agentId: row.agent_id,
      taskDescription: row.task_description,
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      status: row.status,
      result: row.result ?? undefined,
      error: row.error || undefined,
    }));
  },

  async syncAgentExecutions(
    token: string,
    records: AgentExecutionRecord[],
    knownUserId?: string | null
  ): Promise<void> {
    if (!records.length) return;
    const userId = await resolveVerifiedUserId(token, knownUserId);
    const rows = records.map((r) => ({
      user_id: userId,
      client_id: r.id,
      agent_id: r.agentId,
      task_description: r.taskDescription,
      status: r.status,
      result: r.result ?? null,
      error: r.error || null,
      started_at: r.startedAt || new Date().toISOString(),
      completed_at: r.completedAt || null,
    }));

    await restRequest('companion_agent_executions?on_conflict=user_id,client_id', token, {
      method: 'POST',
      body: JSON.stringify(rows),
    });
  },
};
