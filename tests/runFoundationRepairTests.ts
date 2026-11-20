import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ThinkingLevel } from '@google/genai';

import {
  DEFAULT_GEMINI_MODEL,
  handleChatRequest,
  handleModelStatusRequest,
  handleTitleRequest,
  resetBackendCachesForTesting,
  resolveConfiguredModel,
} from '../server/geminiBackend';
import { geminiModelService } from '../src/services/geminiModelService';
import { conversationEngine } from '../src/services/conversationEngine';
import { memoryEngine } from '../src/services/memoryEngine';
import { libraryService } from '../src/services/libraryService';
import { workspaceEngine } from '../src/services/workspaceEngine';
import { studiosEngine } from '../src/services/studiosEngine';
import { agentEngine } from '../src/services/agentEngine';
import { permissionsEngine } from '../src/services/permissionsEngine';
import { universalComposerService } from '../src/services/universalComposerService';
import { universalAttachmentService } from '../src/services/universalAttachmentService';
import { companionData, PRIVATE_STORAGE_BUCKET } from '../src/services/companionData';
import { cloudMigrationService } from '../src/services/cloudMigrationService';
import { cloudSyncCoordinator } from '../src/services/cloudSyncCoordinator';
import { storageService, STORAGE_KEYS } from '../src/services/storageService';
import { sanitizeRedirectPath, parseAuthCallbackParams } from '../src/services/authValidation';
import { mediaStreamService } from '../src/services/mediaStreamService';
import { voiceEngine } from '../src/services/voiceEngine';
import { RenderLoopController } from '../src/utils/renderLoopVisibility';

const AUTH_ENV = {
  SUPABASE_URL: 'https://proj-test.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  GEMINI_API_KEY: 'server_secret_key',
};

function makeAuthFetch(userId = 'user_alpha'): typeof fetch {
  return async (url) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: userId, email: `${userId}@example.com` }), { status: 200 });
    }
    if (u.includes('/rest/v1/rpc/consume_companion_rate_limit')) {
      return new Response(
        JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]),
        { status: 200 }
      );
    }
    return new Response(JSON.stringify([]), { status: 200 });
  };
}

test('Backend /api/chat rejects non-POST, missing bearer token, and missing GEMINI_API_KEY', async () => {
  resetBackendCachesForTesting();

  const wrongMethod = await handleChatRequest({ method: 'GET', body: {} }, { env: AUTH_ENV });
  assert.equal(wrongMethod.statusCode, 405);

  const missingToken = await handleChatRequest(
    { method: 'POST', authorizationHeader: '', body: { messages: [{ role: 'user', content: 'Hi' }] } },
    { env: AUTH_ENV, fetchImpl: makeAuthFetch() }
  );
  assert.equal(missingToken.statusCode, 401);

  const invalidToken = await handleChatRequest(
    { method: 'POST', authorizationHeader: 'Bearer expired_tok', body: { messages: [{ role: 'user', content: 'Hi' }] } },
    {
      env: AUTH_ENV,
      fetchImpl: async () => new Response(JSON.stringify({ error: 'invalid jwt' }), { status: 401 }),
    }
  );
  assert.equal(invalidToken.statusCode, 401);

  const missingGeminiKey = await handleChatRequest(
    { method: 'POST', authorizationHeader: 'Bearer ok', body: { messages: [{ role: 'user', content: 'Hi' }] } },
    {
      env: { SUPABASE_URL: AUTH_ENV.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: AUTH_ENV.SUPABASE_PUBLISHABLE_KEY },
      fetchImpl: makeAuthFetch(),
    }
  );
  assert.equal(missingGeminiKey.statusCode, 503);
  assert.equal(missingGeminiKey.body.status, 'credentials_missing');
});

test('Backend /api/chat passes multi-turn history, Think HIGH level, GEMINI_MODEL override, and falls back when custom model rejects thinking', async () => {
  resetBackendCachesForTesting();
  let capturedCalls: Array<Record<string, unknown>> = [];

  const thinkOk = await handleChatRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer valid_tok',
      body: {
        mode: 'Think',
        systemInstruction: 'Custom system test context',
        messages: [
          { role: 'user', content: 'First prompt' },
          { role: 'assistant', content: 'First answer' },
          { role: 'user', content: 'Follow up question' },
        ],
      },
    },
    {
      env: AUTH_ENV,
      fetchImpl: makeAuthFetch(),
      createGeminiClient: () => ({
        models: {
          generateContent: async (params) => {
            capturedCalls.push(params);
            return { text: 'Deep reasoning response' };
          },
        },
      }),
    }
  );

  assert.equal(thinkOk.statusCode, 200);
  assert.equal(thinkOk.body.modelUsed, DEFAULT_GEMINI_MODEL);
  assert.equal(thinkOk.body.appliedMode, 'Think');
  assert.equal(thinkOk.body.thinkingLevel, 'HIGH');
  assert.equal(capturedCalls.length, 1);
  assert.equal((capturedCalls[0].config as any)?.thinkingConfig?.thinkingLevel, ThinkingLevel.HIGH);
  assert.equal((capturedCalls[0].contents as any[])[1].role, 'model');

  // Test GEMINI_MODEL override + graceful fallback if overridden model rejects thinkingConfig
  capturedCalls = [];
  let attempt = 0;
  const fallbackRes = await handleChatRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer valid_tok',
      body: {
        mode: 'Think',
        messages: [{ role: 'user', content: 'Analyze edge cases' }],
      },
    },
    {
      env: { ...AUTH_ENV, GEMINI_MODEL: 'gemini-custom-override' },
      fetchImpl: makeAuthFetch(),
      createGeminiClient: () => ({
        models: {
          generateContent: async (params) => {
            attempt++;
            capturedCalls.push(params);
            if (attempt === 1) {
              throw new Error('400 INVALID_ARGUMENT: thinkingConfig is not supported on this model');
            }
            return { text: 'Fallback standard reply' };
          },
        },
      }),
    }
  );

  assert.equal(fallbackRes.statusCode, 200);
  assert.equal(fallbackRes.body.modelUsed, 'gemini-custom-override');
  assert.equal(fallbackRes.body.appliedMode, 'Standard Intelligent');
  assert.equal(fallbackRes.body.thinkingLevel, 'DEFAULT');
  assert.equal(capturedCalls.length, 2);
  assert.equal((capturedCalls[1].config as any)?.thinkingConfig, undefined);
});

test('Backend /api/chat validates payload bounds, enforces rate limits, and handles empty/error/timeout failures', async () => {
  resetBackendCachesForTesting();

  const tooManyMsgs = await handleChatRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer tok',
      body: { messages: Array.from({ length: 41 }, () => ({ role: 'user', content: 'hi' })) },
    },
    { env: AUTH_ENV, fetchImpl: makeAuthFetch('user_bounds') }
  );
  assert.equal(tooManyMsgs.statusCode, 400);

  const tooLongMsg = await handleChatRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer tok',
      body: { messages: [{ role: 'user', content: 'x'.repeat(12001) }] },
    },
    { env: AUTH_ENV, fetchImpl: makeAuthFetch('user_bounds') }
  );
  assert.equal(tooLongMsg.statusCode, 400);

  const tooLongTotal = await handleChatRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer tok',
      body: {
        messages: Array.from({ length: 7 }, () => ({ role: 'user', content: 'y'.repeat(10000) })),
      },
    },
    { env: AUTH_ENV, fetchImpl: makeAuthFetch('user_bounds') }
  );
  assert.equal(tooLongTotal.statusCode, 400);

  const emptyReply = await handleChatRequest(
    { method: 'POST', authorizationHeader: 'Bearer tok', body: { messages: [{ role: 'user', content: 'hi' }] } },
    {
      env: AUTH_ENV,
      fetchImpl: makeAuthFetch('user_errors'),
      createGeminiClient: () => ({ models: { generateContent: async () => ({ text: '   ' }) } }),
    }
  );
  assert.equal(emptyReply.statusCode, 502);

  const providerErr = await handleChatRequest(
    { method: 'POST', authorizationHeader: 'Bearer tok', body: { messages: [{ role: 'user', content: 'hi' }] } },
    {
      env: AUTH_ENV,
      fetchImpl: makeAuthFetch('user_errors'),
      createGeminiClient: () => ({ models: { generateContent: async () => { throw new Error('upstream 500'); } } }),
    }
  );
  assert.equal(providerErr.statusCode, 502);

  const timeoutErr = await handleChatRequest(
    { method: 'POST', authorizationHeader: 'Bearer tok', body: { messages: [{ role: 'user', content: 'hi' }] } },
    {
      env: AUTH_ENV,
      fetchImpl: makeAuthFetch('user_errors'),
      createGeminiClient: () => ({
        models: { generateContent: async () => { throw new Error('Gemini generation timed out after 25000ms'); } },
      }),
    }
  );
  assert.equal(timeoutErr.statusCode, 504);

  // Rate limit via in-memory fallback (when RPC is unreachable)
  resetBackendCachesForTesting();
  const rpcUnavailableFetch: typeof fetch = async (url) => {
    if (String(url).includes('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'rate_user', email: 'r@example.com' }), { status: 200 });
    }
    throw new Error('RPC network down');
  };
  let rateLimitedRes = null as any;
  for (let i = 0; i < 31; i++) {
    rateLimitedRes = await handleChatRequest(
      { method: 'POST', authorizationHeader: 'Bearer tok', body: { messages: [{ role: 'user', content: 'ping' }] } },
      {
        env: AUTH_ENV,
        fetchImpl: rpcUnavailableFetch,
        createGeminiClient: () => ({ models: { generateContent: async () => ({ text: 'pong' }) } }),
      }
    );
  }
  assert.equal(rateLimitedRes.statusCode, 429);
  assert.ok(Number(rateLimitedRes.headers?.['retry-after']) >= 1);
});

test('Backend /api/model/status covers 5-state health machine & 60s caching vs forceRefresh, and /api/title enforces auth', async () => {
  resetBackendCachesForTesting();
  let currentNow = 1_000_000;

  const missing = await handleModelStatusRequest({ method: 'GET' }, { env: {} });
  assert.equal(missing.statusCode, 200);
  assert.equal(missing.body.state, 'credentials_missing');

  const configured = await handleModelStatusRequest(
    { method: 'GET', liveProbe: false, forceRefresh: true },
    { env: AUTH_ENV, now: () => currentNow }
  );
  assert.equal(configured.body.state, 'credentials_configured');

  // Cached hit should reuse previous status inside 60s TTL even without provider probe
  currentNow += 10_000;
  const cachedHit = await handleModelStatusRequest(
    { method: 'GET', liveProbe: true, forceRefresh: false },
    {
      env: AUTH_ENV,
      now: () => currentNow,
      createGeminiClient: () => {
        throw new Error('Should not probe during 60s TTL cache hit');
      },
    }
  );
  assert.equal(cachedHit.body.state, 'credentials_configured');

  const reachable = await handleModelStatusRequest(
    { method: 'GET', forceRefresh: true },
    {
      env: AUTH_ENV,
      now: () => currentNow,
      createGeminiClient: () => ({
        models: {
          get: async () => ({ name: DEFAULT_GEMINI_MODEL }),
          generateContent: async () => ({ text: 'OK' }),
        },
      }),
    }
  );
  assert.equal(reachable.body.state, 'provider_reachable');

  const generated = await handleModelStatusRequest(
    { method: 'GET', forceRefresh: true, liveProbe: true },
    {
      env: AUTH_ENV,
      now: () => currentNow,
      createGeminiClient: () => ({
        models: {
          get: async () => ({ name: DEFAULT_GEMINI_MODEL }),
          generateContent: async () => ({ text: 'OK' }),
        },
      }),
    }
  );
  assert.equal(generated.body.state, 'generation_successful');

  const unavailable = await handleModelStatusRequest(
    { method: 'GET', forceRefresh: true, liveProbe: true },
    {
      env: AUTH_ENV,
      now: () => currentNow,
      createGeminiClient: () => ({
        models: {
          get: async () => {
            throw new Error('503 service unavailable');
          },
          generateContent: async () => ({ text: '' }),
        },
      }),
    }
  );
  assert.equal(unavailable.body.state, 'provider_unavailable');
  assert.equal(/503|service unavailable/i.test(String(unavailable.body.message)), false);
  assert.equal(resolveConfiguredModel({ GEMINI_MODEL: 'Gemini 4 Hydrogen' }), 'gemini-4-hydrogen');
  assert.equal(resolveConfiguredModel({ GEMINI_MODEL: 'models/gemini-4-hydrogen' }), 'gemini-4-hydrogen');

  // /api/title requires auth and generates title cleanly
  const titleUnauth = await handleTitleRequest(
    { method: 'POST', authorizationHeader: '', body: { message: 'Explain black holes' } },
    { env: AUTH_ENV, fetchImpl: makeAuthFetch() }
  );
  assert.equal(titleUnauth.statusCode, 401);

  const titleOk = await handleTitleRequest(
    { method: 'POST', authorizationHeader: 'Bearer valid', body: { message: 'Explain black holes' } },
    {
      env: AUTH_ENV,
      fetchImpl: makeAuthFetch('title_user'),
      createGeminiClient: () => ({
        models: { generateContent: async () => ({ text: '"Black Hole Physics"' }) },
      }),
    }
  );
  assert.equal(titleOk.statusCode, 200);
  assert.equal(titleOk.body.title, 'Black Hole Physics');
});

test('Frontend geminiModelService + conversationEngine enforce auth, duplicate guard, retry preservation, cloud delete, and AI title refinement', async () => {
  const originalWindow = (globalThis as any).window;
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    (globalThis as any).window = {};
    process.env.VITE_SUPABASE_URL = AUTH_ENV.SUPABASE_URL;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = AUTH_ENV.SUPABASE_PUBLISHABLE_KEY;

    // 1. Browser path requires accessToken
    const noTokenRes = await geminiModelService.generateChatResponse([], 'Hello');
    assert.equal(noTokenRes.success, false);
    assert.equal(noTokenRes.status, 'unauthenticated');
    assert.equal(noTokenRes.statusCode, 401);

    // 2. Duplicate in-flight guard + Retry replacement + Async AI title update + Cloud Delete
    let releaseSlowChat!: () => void;
    let chatCallCount = 0;
    let deletedClientId: string | null = null;

    globalThis.fetch = (async (url, init) => {
      const u = String(url);
      if (u.startsWith('/api/chat')) {
        chatCallCount++;
        if (chatCallCount === 1) {
          await new Promise<void>((resolve) => {
            releaseSlowChat = resolve;
          });
          return new Response(JSON.stringify({ success: false, error: 'Temporary failure' }), { status: 502 });
        }
        return new Response(
          JSON.stringify({
            success: true,
            reply: 'Recovered answer from Gemini',
            modelUsed: DEFAULT_GEMINI_MODEL,
            requestedMode: 'Think',
            appliedMode: 'Think',
            thinkingLevel: 'HIGH',
          }),
          { status: 200 }
        );
      }
      if (u.startsWith('/api/title')) {
        return new Response(JSON.stringify({ success: true, title: 'Refined Cloud Title' }), { status: 200 });
      }
      if (u.includes('/rest/v1/companion_conversations') && init?.method === 'DELETE') {
        deletedClientId = decodeURIComponent(u.split('client_id=eq.')[1] || '');
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;

    conversationEngine.setAccessToken('tok_conv_test', 'user_conv_test');
    const thread = conversationEngine.createThread('general', undefined);
    await conversationEngine.addMessage(thread.id, 'Draft a distributed retry pattern', 'user', 'Think');
    const titleBeforeAi = thread.title;

    const firstTurnPromise = conversationEngine.generateAssistantResponse(thread.id);
    assert.equal(conversationEngine.isGenerating(thread.id), true);

    const dupTurn = await conversationEngine.generateAssistantResponse(thread.id);
    assert.ok(dupTurn.id.startsWith('msg_dup'));
    assert.equal(dupTurn.status, 'failed');

    releaseSlowChat();
    const failedTurn = await firstTurnPromise;
    assert.equal(failedTurn.status, 'failed');
    assert.equal(conversationEngine.isGenerating(thread.id), false);

    // Retry replaces failed assistant message while keeping original user turn intact
    const retried = await conversationEngine.retryLastTurn(thread.id);
    assert.equal(retried?.status, 'completed');
    assert.equal(retried?.content, 'Recovered answer from Gemini');
    assert.equal(thread.messages.filter((m) => m.sender === 'user').length, 1);
    assert.equal(thread.messages.filter((m) => m.sender === 'angel').length, 1);

    // Wait microtask for /api/title refinement
    await new Promise((r) => setTimeout(r, 20));
    assert.notEqual(thread.title, titleBeforeAi);
    assert.equal(thread.title, 'Refined Cloud Title');

    // deleteThread calls cloud DELETE
    const delOk = conversationEngine.deleteThread(thread.id);
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(delOk, true);
    assert.equal(deletedClientId, thread.id);
  } finally {
    cloudSyncCoordinator.resetAllEnginesOnSignOut();
    (globalThis as any).window = originalWindow;
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});

test('Multi-user isolation separates all 9 engines per userId and resetAllEnginesOnSignOut clears bound state & streams', async () => {
  try {
    // Sign in User A
    await cloudSyncCoordinator.handleAuthChange({
      status: 'authenticated',
      accessToken: 'tok_user_a',
      userId: 'user_a_iso',
    });

    const convA = conversationEngine.createThread('general', undefined, 'User A Private Thread');
    await conversationEngine.addMessage(convA.id, 'User A secret prompt', 'user');
    const memA = memoryEngine.saveMemory({
      category: 'personal',
      scope: 'general',
      title: 'User A Memory',
      content: 'User A confidential note',
    });
    const libA = libraryService.addItem({
      type: 'documents',
      name: 'UserA_Spec.md',
      content: 'User A doc content',
      tags: ['private'],
    });
    const projA = workspaceEngine.createProject('User A Project', 'Private project A');
    studiosEngine.updateCanvasBuffer('research-studio', 'User A Research Buffer');
    agentEngine.setAgentStatus('agent_data', 'completed');
    const agentA = agentEngine.getAgent('agent_data')!;
    agentA.executionCount = 4;
    permissionsEngine.revokePermission('camera');
    universalComposerService.setDraft({ type: 'general' }, 'User A unsent draft');
    universalComposerService.setMode({ type: 'general' }, 'Think');
    await universalAttachmentService.stageAttachment(
      { type: 'general' },
      { name: 'user_a_attach.txt', size: 12, content: 'secret a' }
    );

    // Switch to User B
    await cloudSyncCoordinator.handleAuthChange({
      status: 'authenticated',
      accessToken: 'tok_user_b',
      userId: 'user_b_iso',
    });

    assert.equal(conversationEngine.getThreads('general').some((t) => t.id === convA.id), false);
    assert.equal(memoryEngine.getMemories().some((m) => m.id === memA.id), false);
    assert.equal(libraryService.getItems().some((i) => i.id === libA.id), false);
    assert.equal(workspaceEngine.getProjects().some((p) => p.id === projA.id), false);
    assert.equal(studiosEngine.getStudioState('research-studio').canvasBuffer, '');
    assert.equal(agentEngine.getAgent('agent_data')?.executionCount, 0);
    assert.notEqual(
      permissionsEngine.getPermissions().find((p) => p.type === 'camera')?.state,
      'denied'
    );
    assert.equal(universalComposerService.getDraft({ type: 'general' }), '');
    assert.equal(universalComposerService.getMode({ type: 'general' }), 'Standard Intelligent');
    assert.equal(universalAttachmentService.getStagedAttachments({ type: 'general' }).length, 0);

    // Sign out clears user scope and stops voice/media cleanly
    cloudSyncCoordinator.resetAllEnginesOnSignOut();
    assert.equal(voiceEngine.getIsListening(), false);
    assert.equal(voiceEngine.getIsSynthesizing(), false);
    assert.equal(mediaStreamService.getCameraStream(), null);
    assert.equal(mediaStreamService.getScreenStream(), null);
  } finally {
    cloudSyncCoordinator.resetAllEnginesOnSignOut();
    ['user_a_iso', 'user_b_iso'].forEach((uid) => {
      storageService.remove(`${STORAGE_KEYS.conversations}:user:${uid}`);
      storageService.remove(`angel_memory_records_v1:user:${uid}`);
      storageService.remove(`angel_library_items_v1:user:${uid}`);
      storageService.remove(`${STORAGE_KEYS.workspaceProjects}:user:${uid}`);
      storageService.remove(`${STORAGE_KEYS.studiosState}:user:${uid}`);
      storageService.remove(`${STORAGE_KEYS.agentsState}:user:${uid}`);
      storageService.remove(`${STORAGE_KEYS.permissions}:user:${uid}`);
      storageService.remove(`angel_composer_drafts_v1:user:${uid}`);
      storageService.remove(`angel_composer_modes_v1:user:${uid}`);
      storageService.remove(`angel_attachments_meta_v1:user:${uid}`);
    });
  }
});

test('companionData issues authenticated REST + private storage requests to companion-private and signs URLs cleanly', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const calls: Array<{ url: string; method: string; headers: Record<string, string> }> = [];

  try {
    process.env.VITE_SUPABASE_URL = AUTH_ENV.SUPABASE_URL;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = AUTH_ENV.SUPABASE_PUBLISHABLE_KEY;

    globalThis.fetch = (async (url, init) => {
      const u = String(url);
      const headers = (init?.headers || {}) as Record<string, string>;
      calls.push({ url: u, method: init?.method || 'GET', headers });

      if (u.includes('/rest/v1/companion_conversations')) {
        return new Response(JSON.stringify([{ id: 'uuid_conv_1', client_id: 'conv_1' }]), { status: 200 });
      }
      if (u.includes('/storage/v1/object/sign/')) {
        return new Response(JSON.stringify({ signedURL: '/object/sign/companion-private/u1/doc.md?token=signed123' }), { status: 200 });
      }
      if (u.includes('/rest/v1/companion_profiles') && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify([{ display_name: 'Ada', preferences: { theme: 'light' } }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;

    await companionData.syncThreads(
      'jwt_user_1',
      [
        {
          id: 'conv_1',
          title: 'Cloud Thread',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isArchived: false,
          scope: 'general',
          messages: [{ id: 'm1', sender: 'user', content: 'Hello', timestamp: '12:00' }],
        },
      ],
      'u1'
    );

    await companionData.syncMemories(
      'jwt_user_1',
      [
        {
          id: 'mem_cloud_1',
          category: 'personal',
          scope: 'general',
          title: 'Timezone',
          content: 'PST',
          timestamp: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      'u1'
    );

    const itemToSync = {
      id: 'lib_cloud_1',
      type: 'documents' as const,
      name: 'Notes.md',
      content: '# Cloud Notes',
      mimeType: 'text/markdown',
      tags: ['notes'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready' as const,
    };
    await companionData.syncLibraryItems('jwt_user_1', [itemToSync], 'u1');
    const signedUrl = await companionData.getPrivateSignedUrl('jwt_user_1', 'u1/lib_cloud_1_Notes.md');
    await companionData.syncProfilePreferences('jwt_user_1', { displayName: 'Ada', preferences: { theme: 'dark' } }, 'u1');
    const profile = await companionData.loadProfilePreferences('jwt_user_1', 'u1');

    assert.ok(calls.some((c) => c.url.includes(`/storage/v1/object/${PRIVATE_STORAGE_BUCKET}/u1/`)));
    assert.ok(calls.some((c) => c.url.includes(`/storage/v1/object/sign/${PRIVATE_STORAGE_BUCKET}/`)));
    assert.ok(signedUrl.includes('token=signed123'));
    assert.equal(profile?.preferences.theme, 'light');
    assert.ok(calls.every((c) => c.headers.authorization === 'Bearer jwt_user_1' && c.headers.apikey === AUTH_ENV.SUPABASE_PUBLISHABLE_KEY));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});

test('cloudMigrationService ignores demo records, creates recoverable backup, migrates idempotently, and preserves backup on failure', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.VITE_SUPABASE_URL;
  const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const testUser = 'user_mig_test';

  try {
    process.env.VITE_SUPABASE_URL = AUTH_ENV.SUPABASE_URL;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = AUTH_ENV.SUPABASE_PUBLISHABLE_KEY;

    storageService.save(STORAGE_KEYS.conversations, [
      { id: 'conv_general_1', title: 'Demo', scope: 'general', createdAt: '', updatedAt: '', isArchived: false, messages: [{ id: '1', sender: 'user', content: 'demo', timestamp: '' }] },
      { id: 'conv_real_1', title: 'Real Chat', scope: 'general', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isArchived: false, messages: [{ id: '2', sender: 'user', content: 'real', timestamp: '' }] },
    ]);
    storageService.save('angel_memory_records_v1', [
      { id: 'mem_1', category: 'personal', scope: 'general', title: 'Sample', content: 'sample', timestamp: '', updatedAt: '' },
      { id: 'mem_real_1', category: 'personal', scope: 'general', title: 'Real Mem', content: 'real mem', timestamp: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ]);

    const detected = cloudMigrationService.detectUnownedLocalData();
    assert.equal(detected.conversations.length, 1);
    assert.equal(detected.conversations[0].id, 'conv_real_1');
    assert.equal(detected.memories.length, 1);
    assert.equal(detected.memories[0].id, 'mem_real_1');

    // Failure case preserves backup
    globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'RLS failure' }), { status: 500 })) as typeof fetch;
    const failedStatus = await cloudMigrationService.runSafeMigration('tok_mig', testUser);
    assert.equal(failedStatus.state, 'error');
    const backupAfterFail = storageService.load<any>(`angel_cloud_migration_backup_v1:user:${testUser}`, null);
    assert.equal(backupAfterFail?.data?.conversations?.[0]?.id, 'conv_real_1');

    // Success case marks synced and copies into user scope
    globalThis.fetch = (async (url) => {
      if (String(url).includes('/rest/v1/companion_conversations')) {
        return new Response(JSON.stringify([{ id: 'uuid_c1', client_id: 'conv_real_1' }]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;
    const syncedStatus = await cloudMigrationService.runSafeMigration('tok_mig', testUser);
    assert.equal(syncedStatus.state, 'synced');
    const userScopedConvs = storageService.load<any[]>(`${STORAGE_KEYS.conversations}:user:${testUser}`, []);
    assert.ok(userScopedConvs.some((c) => c.id === 'conv_real_1'));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey;
    storageService.remove(STORAGE_KEYS.conversations);
    storageService.remove('angel_memory_records_v1');
    storageService.remove(`angel_cloud_migration_state_v1:user:${testUser}`);
    storageService.remove(`angel_cloud_migration_backup_v1:user:${testUser}`);
    storageService.remove(`${STORAGE_KEYS.conversations}:user:${testUser}`);
    storageService.remove(`angel_memory_records_v1:user:${testUser}`);
  }
});

test('Security boundaries: zero service-role or GEMINI_API_KEY in frontend code, open-redirect blocker, and PKCE parser', () => {
  const srcRoot = path.resolve(process.cwd(), 'src');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(full);
    }
  };
  walk(srcRoot);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(content.includes('VITE_GEMINI_API_KEY'), false, `VITE_GEMINI_API_KEY found in ${file}`);
    assert.equal(content.includes('VITE_SUPABASE_SERVICE_ROLE_KEY'), false, `VITE_SUPABASE_SERVICE_ROLE_KEY found in ${file}`);
  }

  assert.equal(sanitizeRedirectPath('https://evil.example.com'), '/app');
  assert.equal(sanitizeRedirectPath('//evil.example.com'), '/app');
  assert.equal(sanitizeRedirectPath('javascript:alert(1)'), '/app');
  assert.equal(sanitizeRedirectPath('/app'), '/app');

  const cb = parseAuthCallbackParams('?code=pkce_123&next=%2Fapp', '');
  assert.equal(cb.code, 'pkce_123');
  assert.equal(cb.nextPath, '/app');
  assert.equal(cb.hasCallbackParams, true);
});

test('Agent permissions, cancellation, mediaStreamService, voiceEngine, and RenderLoopController work honestly and cleanly', async () => {
  try {
    permissionsEngine.revokePermission('local_storage');
    const blocked = await agentEngine.executeTask('agent_code', 'Generate type definitions');
    assert.equal(blocked.success, false);
    assert.equal(agentEngine.getAgent('agent_code')?.status, 'blocked');

    permissionsEngine.setPermissionState('local_storage', 'granted');
    agentEngine.setAgentStatus('agent_code', 'running');
    const cancelled = agentEngine.cancelAgent('agent_code');
    assert.equal(cancelled, true);
    assert.equal(agentEngine.getAgent('agent_code')?.status, 'idle');

    // Unavailable browser media/speech fails honestly without throwing
    const camRes = await mediaStreamService.startCamera();
    assert.equal(camRes.success, false);
    assert.ok(camRes.error);
    const scrRes = await mediaStreamService.startScreenShare();
    assert.equal(scrRes.success, false);
    assert.ok(scrRes.error);

    let speechErr = '';
    const listenStarted = voiceEngine.startListening({
      onTranscript: () => {},
      onError: (e) => { speechErr = e; },
      onEnd: () => {},
    });
    assert.equal(listenStarted, false);
    assert.ok(speechErr.length > 0);
    voiceEngine.stopAll();
    mediaStreamService.stopAll();

    // RenderLoopController visibility, reduced-motion, and disposal behavior
    let nextId = 1;
    const activeFrames = new Map<number, FrameRequestCallback>();
    let hidden = false;
    let frameCount = 0;

    const controller = new RenderLoopController({
      reducedMotion: false,
      onFrame: () => { frameCount++; },
      isDocumentHidden: () => hidden,
      scheduler: {
        requestFrame: (cb) => {
          const id = nextId++;
          activeFrames.set(id, cb);
          return id;
        },
        cancelFrame: (id) => {
          activeFrames.delete(id);
        },
      },
    });

    controller.start();
    assert.equal(controller.isRunning(), true);
    assert.equal(activeFrames.size, 1);

    controller.setViewportVisible(false);
    assert.equal(controller.isRunning(), false);
    assert.equal(activeFrames.size, 0);

    controller.setViewportVisible(true);
    assert.equal(controller.isRunning(), true);
    assert.equal(activeFrames.size, 1);

    hidden = true;
    controller.handleVisibilityChange();
    assert.equal(controller.isRunning(), false);
    assert.equal(activeFrames.size, 0);

    hidden = false;
    controller.handleVisibilityChange();
    assert.equal(controller.isRunning(), true);
    assert.equal(activeFrames.size, 1);

    controller.dispose();
    assert.equal(controller.isRunning(), false);
    assert.equal(activeFrames.size, 0);

    // Reduced motion draws one static frame and never schedules continuous rAF
    let staticFrames = 0;
    let scheduledInReduced = 0;
    const reducedController = new RenderLoopController({
      reducedMotion: true,
      onFrame: () => { staticFrames++; },
      scheduler: {
        requestFrame: () => { scheduledInReduced++; return 1; },
        cancelFrame: () => {},
      },
    });
    reducedController.start();
    assert.equal(staticFrames, 1);
    assert.equal(scheduledInReduced, 0);
    assert.equal(reducedController.isRunning(), false);
  } finally {
    permissionsEngine.setPermissionState('local_storage', 'granted');
    agentEngine.setAgentStatus('agent_code', 'idle');
  }
});

test('Supabase repair migration covers all 3 tables, companionData surfaces missing_tables cleanly, and Gemini maps 429 quota cleanly', async () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261120120000_ensure_companion_workspace_studios_agents.sql'
  );
  assert.ok(fs.existsSync(migrationPath), 'Idempotent repair migration must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(sql.includes('companion_projects'));
  assert.ok(sql.includes('companion_studios_state'));
  assert.ok(sql.includes('companion_agent_executions'));
  assert.ok(sql.toLowerCase().includes('notify pgrst'));

  // Missing table report updates cloudSyncHealth instead of silently hiding schema errors
  companionData.resetCloudSyncHealth();
  companionData.reportEngineSyncError(
    'companion_projects',
    new Error('Supabase request failed (404): Could not find the table public.companion_projects in the schema cache (PGRST205)')
  );
  const health = companionData.getCloudSyncHealth();
  assert.equal(health.status, 'missing_tables');
  assert.ok(health.missingTables.includes('companion_projects'));
  companionData.resetCloudSyncHealth();

  // Gemini 429 quota exceeded maps to 429 RATE_LIMITED in chat and keeps providerReachable true in status when models.get passes
  resetBackendCachesForTesting();
  const quotaChat = await handleChatRequest(
    { method: 'POST', authorizationHeader: 'Bearer tok', body: { messages: [{ role: 'user', content: 'hi' }] } },
    {
      env: AUTH_ENV,
      fetchImpl: makeAuthFetch('user_quota'),
      createGeminiClient: () => ({
        models: {
          generateContent: async () => {
            throw new Error('429 RESOURCE_EXHAUSTED: Quota exceeded');
          },
        },
      }),
    }
  );
  assert.equal(quotaChat.statusCode, 429);
  assert.equal(quotaChat.body.code, 'RATE_LIMITED');

  resetBackendCachesForTesting();
  const statusQuotaProbe = await handleModelStatusRequest(
    { method: 'GET', forceRefresh: true, liveProbe: true },
    {
      env: AUTH_ENV,
      createGeminiClient: () => ({
        models: {
          get: async () => ({ name: DEFAULT_GEMINI_MODEL }),
          generateContent: async () => {
            throw new Error('429 RESOURCE_EXHAUSTED: Quota exceeded');
          },
        },
      }),
    }
  );
  assert.equal(statusQuotaProbe.statusCode, 200);
  assert.equal(statusQuotaProbe.body.providerReachable, true);
  assert.equal(statusQuotaProbe.body.state, 'provider_reachable');
  assert.equal(statusQuotaProbe.body.probeDiagnosticCode, 'QUOTA_EXCEEDED');
});

