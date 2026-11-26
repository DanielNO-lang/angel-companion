import assert from 'node:assert/strict';
import { conversationEngine } from '../src/services/conversationEngine';
import { conversationalIntelligence } from '../src/services/conversationalIntelligence';
import { extractIntelligentTitle, DEFAULT_GEMINI_MODEL } from '../src/services/geminiModelService';
import { capabilityRegistry } from '../src/services/capabilityRegistry';
import { universalComposerService } from '../src/services/universalComposerService';
import { handleChatRequest, handleModelStatusRequest, resetBackendCachesForTesting } from '../server/geminiBackend';

async function runConversationalIntelligenceTests() {
  console.log('--- STARTING ANGEL AI: CONVERSATIONAL INTELLIGENCE & REPAIR TEST SUITE ---');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Honest unauthenticated block in ConversationEngine
  await test('Scenario 1: ConversationEngine refuses unauthenticated generation cleanly without fake prose', async () => {
    conversationEngine.setAccessToken(null, null);
    const thread = conversationEngine.createThread('general', undefined, 'Test Unauth');
    await conversationEngine.addMessage(thread.id, 'Hi', 'user');
    const reply = await conversationEngine.generateAssistantResponse(thread.id);

    assert.equal(reply.status, 'failed');
    assert.ok(reply.content.includes('Sign in'), 'Should require sign-in transparently');
    conversationEngine.deleteThread(thread.id);
  });

  // 2. System instruction construction adapts cleanly for general, studio, and Think mode
  await test('Scenario 2: ConversationalIntelligence builds environment-aware & Think instructions', () => {
    const generalInst = conversationalIntelligence.buildSystemInstruction({ scope: 'general' });
    assert.ok(generalInst.includes('Angel'));
    assert.ok(!generalInst.includes('Think Mode is active'));

    const studioThinkInst = conversationalIntelligence.buildSystemInstruction({
      scope: 'studio',
      studioId: 'development-studio',
      mode: 'Think',
    });
    assert.ok(studioThinkInst.includes('development-studio'));
    assert.ok(studioThinkInst.includes('Think Mode is active'));
  });

  // 3. Verified backend chat path handles real conversation history & Think mode (via mocked provider)
  await test('Scenario 3: Authenticated /api/chat passes multi-turn history and Think config to Gemini', async () => {
    resetBackendCachesForTesting();
    let capturedParams: any = null;
    const res = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: {
          mode: 'Think',
          messages: [
            { role: 'user', content: 'I want to build a photography portfolio site' },
            { role: 'assistant', content: 'Great — what layout style do you prefer?' },
            { role: 'user', content: 'Minimal grid with lightbox' },
          ],
        },
      },
      {
        env: {
          SUPABASE_URL: 'https://proj.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'pub_key',
          GEMINI_API_KEY: 'server_secret',
        },
        fetchImpl: async (url) => {
          if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'user_1', email: 'u@test.com' }), { status: 200 });
          }
          return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
        },
        createGeminiClient: () => ({
          models: {
            generateContent: async (params) => {
              capturedParams = params;
              return { text: 'A minimal masonry or uniform 3-column CSS Grid works cleanly with a keyboard-accessible lightbox.' };
            },
          },
        }),
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.modelUsed, DEFAULT_GEMINI_MODEL);
    assert.equal(res.body.appliedMode, 'Think');
    assert.equal(res.body.thinkingLevel, 'HIGH');
    assert.ok(Array.isArray(capturedParams?.contents) && capturedParams.contents.length === 3);
  });

  // 4. Model status endpoint reports credentials_missing honestly without GEMINI_API_KEY
  await test('Scenario 4: Model status reports credentials_missing when server key is absent', async () => {
    resetBackendCachesForTesting();
    const res = await handleModelStatusRequest(
      { method: 'GET', forceRefresh: true },
      { env: {} }
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.state, 'credentials_missing');
    assert.equal(res.body.connected, false);
    assert.equal(res.body.model, DEFAULT_GEMINI_MODEL);
  });

  // 5. Intelligent title generation is concise (2-4 words) and never truncated with "..."
  await test('Scenario 5: Conversation titles are concise and never truncated with ellipsis', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'General Conversation');
    await conversationEngine.addMessage(thread.id, 'I want to build a website for my photography portfolio', 'user');

    assert.ok(!thread.title.includes('...'));
    assert.ok(thread.title.includes('Photography'));

    const greetingTitle = extractIntelligentTitle('Hi');
    assert.equal(greetingTitle, 'General Conversation');
    conversationEngine.deleteThread(thread.id);
  });

  // 6. Custom user-renamed title preservation
  await test('Scenario 6: Custom user-renamed title is never overwritten', async () => {
    const thread = conversationEngine.createThread('general', undefined, 'My Custom Project Title');
    conversationEngine.renameThread(thread.id, 'My Custom Project Title');
    assert.equal(thread.isCustomTitle, true);

    await conversationEngine.addMessage(thread.id, 'What is the capital of France?', 'user');
    assert.equal(thread.title, 'My Custom Project Title');
    conversationEngine.deleteThread(thread.id);
  });

  // 7. General & Studio context isolation + capability registry integrity
  await test('Scenario 7: General and Studio threads maintain strict isolation and capability registry intact', () => {
    const genThread = conversationEngine.getActiveThread('general');
    const studioThread = conversationEngine.getActiveThread('studio', 'research-studio');
    assert.notEqual(genThread.id, studioThread.id);
    assert.equal(genThread.scope, 'general');
    assert.equal(studioThread.scope, 'studio');
    assert.equal(studioThread.studioId, 'research-studio');

    const caps = capabilityRegistry.getAllCapabilities();
    assert.ok(caps.length >= 8);
    assert.ok(caps.some((c) => c.id === 'cap_code_generator'));
  });

  // 8. Structured backend diagnostics & secret redaction without credential leaks
  await test('Scenario 8: Backend error diagnostics capture requestId, stage, endpoint, method, providerStatus, and scrub API keys', async () => {
    resetBackendCachesForTesting();
    const res = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: {
          messages: [{ role: 'user', content: 'Hello Angel.' }],
        },
      },
      {
        env: {
          SUPABASE_URL: 'https://proj.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'pub_key',
          GEMINI_API_KEY: 'AIzaTestFakeSecretKey1234567890',
        },
        fetchImpl: async (url) => {
          if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'diag_user', email: 'd@test.com' }), { status: 200 });
          }
          return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
        },
        createGeminiClient: () => ({
          models: {
            generateContent: async () => {
              const err = new Error('404 NOT_FOUND: Model gemini-3.8-flash not found for key=AIzaTestFakeSecretKey1234567890') as Error & { status?: number };
              err.status = 404;
              throw err;
            },
          },
        }),
      }
    );

    assert.equal(res.statusCode, 502);
    assert.equal(res.body.code, 'MODEL_NOT_FOUND');
    assert.ok(typeof res.body.requestId === 'string' && res.body.requestId.length > 0);
    assert.equal(res.headers?.['x-request-id'], res.body.requestId);
    const diag = res.body.diagnostic as Record<string, unknown>;
    assert.equal(diag.endpoint, '/api/chat');
    assert.equal(diag.method, 'POST');
    assert.equal(diag.stage, 'provider_generate');
    assert.equal(diag.providerStatus, 404);
    assert.equal(diag.providerCode, 'MODEL_NOT_FOUND');
    assert.equal(String(diag.providerDetail).includes('AIzaTestFakeSecretKey1234567890'), false);
  });

  // 9. Empty candidate finishReason is surfaced cleanly in EMPTY_RESPONSE diagnostics
  await test('Scenario 9: Empty Gemini candidate response captures finishReason in diagnostic', async () => {
    resetBackendCachesForTesting();
    const res = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: {
          messages: [{ role: 'user', content: 'Hello Angel.' }],
        },
      },
      {
        env: {
          SUPABASE_URL: 'https://proj.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'pub_key',
          GEMINI_API_KEY: 'server_secret',
        },
        fetchImpl: async (url) => {
          if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'empty_user', email: 'e@test.com' }), { status: 200 });
          }
          return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
        },
        createGeminiClient: () => ({
          models: {
            generateContent: async () => ({
              text: '',
              candidates: [{ finishReason: 'SAFETY' }],
            }),
          },
        }),
      }
    );

    assert.equal(res.statusCode, 502);
    assert.equal(res.body.code, 'EMPTY_RESPONSE');
    const diag = res.body.diagnostic as Record<string, unknown>;
    assert.equal(diag.stage, 'response_extraction');
    assert.equal(diag.providerCode, 'SAFETY');
    assert.ok(String(diag.providerDetail).includes('SAFETY'));
  });

  // 10. Upstream 503 UNAVAILABLE (high demand) maps to 503 MODEL_UNAVAILABLE with calm friendly message
  await test('Scenario 10: Upstream 503 UNAVAILABLE maps to MODEL_UNAVAILABLE with structured diagnostics', async () => {
    resetBackendCachesForTesting();
    let calls = 0;
    const res = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: {
          messages: [{ role: 'user', content: 'Hello Angel.' }],
        },
      },
      {
        env: {
          SUPABASE_URL: 'https://proj.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'pub_key',
          GEMINI_API_KEY: 'server_secret',
        },
        fetchImpl: async (url) => {
          if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'demand_user', email: 'm@test.com' }), { status: 200 });
          }
          return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
        },
        createGeminiClient: () => ({
          models: {
            generateContent: async () => {
              calls++;
              const err = new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}') as Error & { status?: number };
              err.status = 503;
              throw err;
            },
          },
        }),
      }
    );

    assert.equal(calls, 6, 'Should attempt bounded retries on primary and emergency fallback before returning MODEL_UNAVAILABLE');
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'MODEL_UNAVAILABLE');
    const diag = res.body.diagnostic as Record<string, unknown>;
    assert.equal(diag.providerStatus, 503);
    assert.equal(diag.providerCode, 'MODEL_UNAVAILABLE');
    assert.equal(diag.stage, 'provider_generate');
  });

  // 11. Primary gemini-3.8-flash 503 failure recovers via emergency gemini-3.1-flash-lite fallback with context preserved
  await test('Scenario 11: Primary gemini-3.8-flash 503 failure recovers via emergency gemini-3.1-flash-lite fallback', async () => {
    resetBackendCachesForTesting();
    const requestedModels: string[] = [];
    const res = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: {
          messages: [
            { role: 'user', content: 'My favourite colour is blue.' },
            { role: 'assistant', content: 'I will remember that!' },
            { role: 'user', content: 'What is my favourite colour?' },
          ],
        },
      },
      {
        env: {
          SUPABASE_URL: 'https://proj.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'pub_key',
          GEMINI_API_KEY: 'server_secret',
        },
        fetchImpl: async (url) => {
          if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'fallback_user', email: 'f@test.com' }), { status: 200 });
          }
          return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
        },
        createGeminiClient: () => ({
          models: {
            generateContent: async (params: any) => {
              requestedModels.push(params.model);
              if (params.model === 'gemini-3.8-flash') {
                const err = new Error('503 Service Unavailable: High demand') as Error & { status?: number };
                err.status = 503;
                throw err;
              }
              return { text: 'Your favourite colour is blue (via Gemini 3.1 Flash Lite).' };
            },
          },
        }),
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.requestedModel, 'gemini-3.8-flash');
    assert.equal(res.body.actualModel, 'gemini-3.1-flash-lite');
    assert.equal(res.body.fallbackActivated, true);
    assert.equal(res.body.reply, 'Your favourite colour is blue (via Gemini 3.1 Flash Lite).');
    assert.ok(requestedModels.includes('gemini-3.8-flash'));
    assert.ok(requestedModels.includes('gemini-3.1-flash-lite'));
    assert.equal(requestedModels.includes('gemini-4-hydrogen'), false);
  });

  // 12. Stale gemini-4-hydrogen env override never contacts Hydrogen and routes cleanly to gemini-3.8-flash
  await test('Scenario 12: Stale GEMINI_MODEL=gemini-4-hydrogen override normalizes safely to gemini-3.8-flash', async () => {
    resetBackendCachesForTesting();
    const requestedModels: string[] = [];
    const res = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: {
          messages: [{ role: 'user', content: 'Ping check' }],
        },
      },
      {
        env: {
          SUPABASE_URL: 'https://proj.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'pub_key',
          GEMINI_API_KEY: 'server_secret',
          GEMINI_MODEL: 'gemini-4-hydrogen',
        },
        fetchImpl: async (url) => {
          if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'override_user', email: 'o@test.com' }), { status: 200 });
          }
          return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
        },
        createGeminiClient: () => ({
          models: {
            generateContent: async (params: any) => {
              requestedModels.push(params.model);
              return { text: 'Primary gemini-3.8-flash responded.' };
            },
          },
        }),
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.requestedModel, 'gemini-3.8-flash');
    assert.equal(res.body.actualModel, 'gemini-3.8-flash');
    assert.equal(res.body.fallbackActivated, false);
    assert.deepEqual(requestedModels, ['gemini-3.8-flash']);
  });

  // 13. Slow primary 503 fails over immediately without burning retries and activates short cooldown probe
  await test('Scenario 13: Slow primary 503 fails over on attempt 1 and uses single cooldown probe on next turn', async () => {
    resetBackendCachesForTesting();
    let virtualNow = 100000;
    const requestedModelsTurn1: string[] = [];
    const env = {
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'pub_key',
      GEMINI_API_KEY: 'server_secret',
    };
    const fetchImpl: typeof fetch = async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'slow_user', email: 's@test.com' }), { status: 200 });
      }
      return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
    };

    const res1 = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: { messages: [{ role: 'user', content: 'First message during slow outage' }] },
      },
      {
        env,
        fetchImpl,
        now: () => virtualNow,
        createGeminiClient: () => ({
          models: {
            generateContent: async (params: any) => {
              requestedModelsTurn1.push(params.model);
              if (params.model === 'gemini-3.8-flash') {
                virtualNow += 2200; // Simulate slow 2.2s 503 upstream failure
                const err = new Error('503 Service Unavailable: High demand') as Error & { status?: number };
                err.status = 503;
                throw err;
              }
              virtualNow += 300;
              return { text: 'Fast fallback reply on turn 1.' };
            },
          },
        }),
      }
    );

    assert.equal(res1.statusCode, 200);
    assert.equal(res1.body.actualModel, 'gemini-3.1-flash-lite');
    assert.deepEqual(
      requestedModelsTurn1,
      ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
      'Slow 503 should fail over after 1 primary attempt instead of 3'
    );

    // Turn 2 within 45s cooldown should also probe primary at most once even on instant 503
    virtualNow += 5000;
    const requestedModelsTurn2: string[] = [];
    const res2 = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: { messages: [{ role: 'user', content: 'Second message within cooldown' }] },
      },
      {
        env,
        fetchImpl,
        now: () => virtualNow,
        createGeminiClient: () => ({
          models: {
            generateContent: async (params: any) => {
              requestedModelsTurn2.push(params.model);
              if (params.model === 'gemini-3.8-flash') {
                const err = new Error('503 Service Unavailable') as Error & { status?: number };
                err.status = 503;
                throw err;
              }
              return { text: 'Fast fallback reply on turn 2.' };
            },
          },
        }),
      }
    );

    assert.equal(res2.statusCode, 200);
    assert.equal(res2.body.actualModel, 'gemini-3.1-flash-lite');
    assert.deepEqual(
      requestedModelsTurn2,
      ['gemini-3.8-flash', 'gemini-3.1-flash-lite'],
      'Cooldown window should probe primary once before fast fallback'
    );
    resetBackendCachesForTesting();
  });

  // 14. ConversationEngine emits live thinking notifications and recovers from 401 via tokenRefresher
  await test('Scenario 14: ConversationEngine notifies thinking state changes and refreshes expired token on 401', async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };

    let fetchCount = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/chat')) {
        fetchCount++;
        const auth = (init?.headers as Record<string, string>)?.authorization || '';
        if (auth === 'Bearer expired_tok') {
          return new Response(JSON.stringify({ success: false, code: 'UNAUTHENTICATED', error: 'Expired JWT' }), { status: 401 });
        }
        return new Response(
          JSON.stringify({ success: true, reply: 'Recovered with refreshed token!', actualModel: 'gemini-3.8-flash' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('/api/title')) {
        return new Response(JSON.stringify({ success: true, title: 'Token Recovery' }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    try {
      conversationEngine.setAccessToken('expired_tok', 'user_refresh_test');
      conversationEngine.setTokenRefresher(async () => 'fresh_valid_tok');
      const thread = conversationEngine.createThread('general', undefined, 'Refresh Test');
      await conversationEngine.addMessage(thread.id, 'Hello after idle tab', 'user');

      const generatingStates: boolean[] = [];
      const unsub = conversationEngine.subscribe(() => {
        generatingStates.push(conversationEngine.isGenerating(thread.id));
      });

      const reply = await conversationEngine.generateAssistantResponse(thread.id);
      unsub();

      assert.equal(reply.status, 'completed');
      assert.equal(reply.content, 'Recovered with refreshed token!');
      assert.equal(fetchCount, 2, 'Should retry once after refreshing expired JWT');
      assert.ok(generatingStates.includes(true), 'Should notify subscribers when thinking begins');
      assert.equal(generatingStates[generatingStates.length - 1], false, 'Should notify subscribers when thinking ends');
      conversationEngine.deleteThread(thread.id);
    } finally {
      conversationEngine.setTokenRefresher(null);
      conversationEngine.setAccessToken(null, null);
      globalThis.fetch = originalFetch;
      if (originalWindow === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = originalWindow;
    }
  });

  // 15. universalComposerService invokes onUserTurnSaved immediately before awaiting slow AI reply
  await test('Scenario 15: universalComposerService triggers onUserTurnSaved before slow chat response finishes', async () => {
    const originalFetch = globalThis.fetch;
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };

    let resolveChat!: (res: Response) => void;
    const chatDeferred = new Promise<Response>((resolve) => {
      resolveChat = resolve;
    });

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/chat')) {
        return chatDeferred;
      }
      return new Response(JSON.stringify({ success: true, title: 'Quick Turn' }), { status: 200 });
    }) as typeof fetch;

    try {
      conversationEngine.setAccessToken('tok_immediate', 'user_immediate');
      const thread = conversationEngine.createThread('general', undefined, 'Immediate Save Test');
      let savedCallbackFiredBeforeReply = false;

      const submitPromise = universalComposerService.submit(
        { type: 'general', conversationId: thread.id },
        'Immediate feedback prompt',
        undefined,
        {
          onUserTurnSaved: (savedId) => {
            savedCallbackFiredBeforeReply = savedId === thread.id;
          },
        }
      );

      // Give microtasks for addMessage + onUserTurnSaved to execute while /api/chat is still pending
      await new Promise((resolve) => setTimeout(resolve, 15));
      assert.equal(savedCallbackFiredBeforeReply, true, 'onUserTurnSaved should fire before /api/chat resolves');
      assert.equal(conversationEngine.isGenerating(thread.id), true, 'Thread should already be marked in-flight');

      resolveChat(
        new Response(JSON.stringify({ success: true, reply: 'Done after wait', actualModel: 'gemini-3.8-flash' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

      const finalResult = await submitPromise;
      assert.equal(finalResult.success, true);
      assert.equal(conversationEngine.isGenerating(thread.id), false);
      conversationEngine.deleteThread(thread.id);
    } finally {
      conversationEngine.setAccessToken(null, null);
      globalThis.fetch = originalFetch;
      if (originalWindow === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = originalWindow;
    }
  });

  // 16. Circuit breaker skips degraded primary synchronously after 2 consecutive failures and recovers after cooldown expiry
  await test('Scenario 16: Circuit breaker bypasses degraded primary after 2 failures for chat and title, then probes after expiry', async () => {
    resetBackendCachesForTesting();
    let virtualNow = 200000;
    const env = {
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'pub_key',
      GEMINI_API_KEY: 'server_secret',
    };
    const fetchImpl: typeof fetch = async (url) => {
      if (String(url).includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'cb_user', email: 'cb@test.com' }), { status: 200 });
      }
      return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
    };

    const runTurn = async (shouldPrimaryFail: boolean) => {
      const modelsCalled: string[] = [];
      const res = await handleChatRequest(
        {
          method: 'POST',
          authorizationHeader: 'Bearer valid_tok',
          body: { messages: [{ role: 'user', content: 'Circuit breaker check' }] },
        },
        {
          env,
          fetchImpl,
          now: () => virtualNow,
          sleep: async () => {},
          createGeminiClient: () => ({
            models: {
              generateContent: async (params: any) => {
                modelsCalled.push(params.model);
                if (params.model === 'gemini-3.8-flash' && shouldPrimaryFail) {
                  virtualNow += 2000;
                  throw Object.assign(new Error('503 Service Unavailable'), { status: 503 });
                }
                return { text: `Reply from ${params.model}` };
              },
            },
          }),
        }
      );
      return { res, modelsCalled };
    };

    // Turn 1 (failure #1) & Turn 2 (failure #2 during cooldown) open circuit breaker
    const t1 = await runTurn(true);
    assert.equal(t1.res.statusCode, 200);
    assert.deepEqual(t1.modelsCalled, ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);

    virtualNow += 5000;
    const t2 = await runTurn(true);
    assert.equal(t2.res.statusCode, 200);
    assert.deepEqual(t2.modelsCalled, ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);

    // Turn 3 within 120s skips gemini-3.8-flash completely (0ms primary wait)
    virtualNow += 10000;
    const t3 = await runTurn(true);
    assert.equal(t3.res.statusCode, 200);
    assert.equal(t3.res.body.requestedModel, 'gemini-3.8-flash');
    assert.equal(t3.res.body.actualModel, 'gemini-3.1-flash-lite');
    assert.equal(t3.res.body.fallbackActivated, true);
    assert.deepEqual(t3.modelsCalled, ['gemini-3.1-flash-lite'], 'Circuit open must skip degraded primary completely');

    // /api/title also skips degraded primary while circuit is open
    const titleModelsCalled: string[] = [];
    const titleRes = await (await import('../server/geminiBackend')).handleTitleRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: { message: 'Circuit breaker title check' },
      },
      {
        env,
        fetchImpl,
        now: () => virtualNow,
        sleep: async () => {},
        createGeminiClient: () => ({
          models: {
            generateContent: async (params: any) => {
              titleModelsCalled.push(params.model);
              return { text: 'Direct Fallback Title' };
            },
          },
        }),
      }
    );
    assert.equal(titleRes.statusCode, 200);
    assert.deepEqual(titleModelsCalled, ['gemini-3.1-flash-lite']);

    // After 125s circuit expiry, primary is probed again and resets circuit on success
    virtualNow += 125000;
    const t4 = await runTurn(false);
    assert.equal(t4.res.statusCode, 200);
    assert.equal(t4.res.body.actualModel, 'gemini-3.8-flash');
    assert.equal(t4.res.body.fallbackActivated, false);
    assert.deepEqual(t4.modelsCalled, ['gemini-3.8-flash']);
    resetBackendCachesForTesting();
  });

  // 17. Final fallback tier retries after TIMEOUT and strips thinkingConfig to recover instead of 504
  await test('Scenario 17: Final tier TIMEOUT retries without thinkingConfig and succeeds instead of returning 504', async () => {
    resetBackendCachesForTesting();
    let liteCalls = 0;
    const liteConfigs: Array<Record<string, unknown>> = [];

    const res = await handleChatRequest(
      {
        method: 'POST',
        authorizationHeader: 'Bearer valid_tok',
        body: { messages: [{ role: 'user', content: 'Recover from slow fallback stream' }] },
      },
      {
        env: {
          SUPABASE_URL: 'https://proj.supabase.co',
          SUPABASE_PUBLISHABLE_KEY: 'pub_key',
          GEMINI_API_KEY: 'server_secret',
        },
        fetchImpl: async (url) => {
          if (String(url).includes('/auth/v1/user')) {
            return new Response(JSON.stringify({ id: 'timeout_rec_user', email: 'tr@test.com' }), { status: 200 });
          }
          return new Response(JSON.stringify([{ allowed: true, reset_at: new Date(Date.now() + 60000).toISOString() }]), { status: 200 });
        },
        sleep: async () => {},
        createGeminiClient: () => ({
          models: {
            generateContent: async (params: any) => {
              if (params.model === 'gemini-3.8-flash') {
                throw new Error('Gemini generation (gemini-3.8-flash) timed out after 6500ms');
              }
              liteCalls++;
              liteConfigs.push({ ...(params.config || {}) });
              if (liteCalls < 3) {
                throw new Error(`Gemini generation (gemini-3.1-flash-lite) (attempt ${liteCalls}) timed out after 12000ms`);
              }
              return { text: 'Recovered cleanly on attempt 3 without thinkingConfig.' };
            },
          },
        }),
      }
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.actualModel, 'gemini-3.1-flash-lite');
    assert.equal(liteCalls, 3, 'Final tier should allow up to 3 attempts on TIMEOUT');
    assert.ok(liteConfigs[0].thinkingConfig, 'Attempt 1 starts with MINIMAL thinkingConfig');
    assert.equal(liteConfigs[1].thinkingConfig, undefined, 'Attempt 2+ after TIMEOUT must strip thinkingConfig');
    assert.equal(liteConfigs[2].thinkingConfig, undefined);
    resetBackendCachesForTesting();
  });

  console.log(`\n--- TEST SUITE SUMMARY: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runConversationalIntelligenceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
