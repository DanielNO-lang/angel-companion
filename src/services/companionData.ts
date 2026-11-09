import type { ChatMessage } from '../types/angel';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export interface CloudThread {
  id: string;
  title: string;
  status: 'active' | 'archived';
  client_id: string;
  created_at: string;
  updated_at: string;
}

async function request(path: string, token: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Cloud storage is not configured.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=representation',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.details || 'Cloud conversation sync failed.');
  return body;
}

export const companionData = {
  async syncThreads(token: string, threads: Array<{
    id: string; title: string; createdAt: string; updatedAt: string;
    isArchived: boolean; scope: string; studioId?: string; messages: ChatMessage[];
  }>): Promise<void> {
    if (!threads.length) return;
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_KEY || '', authorization: `Bearer ${token}` },
    });
    if (!authResponse.ok) throw new Error('Your session expired. Sign in again to sync conversations.');
    const user = await authResponse.json();
    const userId = user.id as string;

    for (const thread of threads) {
      const rows = await request('companion_conversations?on_conflict=user_id,client_id', token, {
        method: 'POST',
        body: JSON.stringify([{
          user_id: userId, client_id: thread.id, title: thread.title,
          status: thread.isArchived ? 'archived' : 'active',
          created_at: thread.createdAt, updated_at: thread.updatedAt,
        }]),
      });
      const cloudThread = Array.isArray(rows) ? rows[0] : null;
      if (!cloudThread?.id || !thread.messages.length) continue;

      const messageRows = thread.messages.map((message, index) => ({
        user_id: userId,
        conversation_id: cloudThread.id,
        client_id: message.id,
        role: message.sender === 'angel' ? 'assistant' : message.sender,
        content: message.content,
        metadata: {
          localTimestamp: message.timestamp,
          mode: message.mode || null,
          attachments: message.attachments || [],
          scope: thread.scope,
          studioId: thread.studioId || null,
        },
        created_at: new Date(new Date(thread.createdAt).getTime() + index).toISOString(),
      }));
      await request('companion_messages?on_conflict=user_id,client_id', token, {
        method: 'POST',
        body: JSON.stringify(messageRows),
      });
    }
  },
};
