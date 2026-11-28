import test from 'node:test';
import assert from 'node:assert/strict';
import { ThinkingLevel } from '@google/genai';
import {
  DEFAULT_GEMINI_MODEL,
  EMERGENCY_FALLBACK_MODEL,
  ACTIVE_MODEL_FALLBACK_CHAIN,
  FREE_MODEL_FALLBACK_CHAIN,
  resolveConfiguredModel,
  resolveCandidateModels,
  buildEnvRuntimeAudit,
  extractRetryAfterMs,
  classifyTaskComplexityForThinking,
  classifyTaskForModelRouting,
  resolveThinkingConfigForModel,
  handleChatRequest,
  handleChatStreamRequest,
  handleTranslateRequest,
  handleTitleRequest,
  handleModelStatusRequest,
  resetBackendCachesForTesting,
  getModelUsageCounts,
  type BackendDependencies,
  type ChatStreamEvent,
} from './geminiBackend';

function createMockSupabaseFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/auth/v1/user')) {
      return new Response(
        JSON.stringify({ id: 'user_test_123', email: 'tester@example.com' }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    if (url.includes('/rest/v1/rpc/consume_companion_rate_limit')) {
      return new Response(
        JSON.stringify([{ allowed: true, remaining: 29, reset_at: new Date(Date.now() + 60000).toISOString() }]),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;
}

function makeDeps(
  generateImpl: (params: Record<string, unknown>) => Promise<{ text?: string }>,
  overrides: Partial<BackendDependencies> = {}
): BackendDependencies {
  return {
    env: {
      GEMINI_API_KEY: 'test-key-not-real',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      ...(overrides.env || {}),
    },
    fetchImpl: overrides.fetchImpl || createMockSupabaseFetch(),
    sleep: overrides.sleep || (async () => {}),
    createGeminiClient:
      overrides.createGeminiClient ||
      (() => ({
        models: {
          generateContent: generateImpl,
          get: async ({ model }: { model: string }) => ({ name: `models/${model}` }),
          list: async () => ({
            page: [
              { name: `models/${DEFAULT_GEMINI_MODEL}` },
              { name: `models/${EMERGENCY_FALLBACK_MODEL}` },
            ],
          }),
        },
      })),
    ...(overrides.now ? { now: overrides.now } : {}),
  };
}

test('resolveCandidateModels uses gemini-3.8-flash primary and gemini-3.1-flash-lite emergency fallback, never Hydrogen', () => {
  assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
  assert.equal(EMERGENCY_FALLBACK_MODEL, 'gemini-3.1-flash-lite');
  assert.deepEqual([...ACTIVE_MODEL_FALLBACK_CHAIN], ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);
  assert.deepEqual([...FREE_MODEL_FALLBACK_CHAIN], ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);

  assert.deepEqual(resolveCandidateModels('gemini-3.8-flash'), ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);
  assert.deepEqual(resolveCandidateModels('gemini-4-hydrogen'), ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);
  assert.equal(resolveConfiguredModel({ GEMINI_MODEL: 'gemini-4-hydrogen' }), 'gemini-3.8-flash');
  assert.equal(resolveConfiguredModel({ GEMINI_MODEL: 'models/gemini-4-hydrogen' }), 'gemini-3.8-flash');

  const audit = buildEnvRuntimeAudit({
    GEMINI_API_KEY: 'AIzaTestKey123456',
    GEMINI_MODEL: 'gemini-4-hydrogen',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  });
  assert.equal(audit.configuredModel, 'gemini-3.8-flash');
  assert.equal(audit.defaultModel, 'gemini-3.8-flash');
  assert.equal(audit.obsoleteOverrideIgnored, true);
  assert.deepEqual(audit.fallbackChain, ['gemini-3.8-flash', 'gemini-3.1-flash-lite']);
});

test('adaptive thinkingLevel uses LOW for casual chat, HIGH for complex reasoning on gemini-3.8-flash, and MINIMAL on emergency tier', () => {
  assert.equal(
    classifyTaskComplexityForThinking('Standard Intelligent', [{ role: 'user', content: 'Hello Angel!' }]),
    'low'
  );
  assert.equal(
    classifyTaskComplexityForThinking('Think', [{ role: 'user', content: 'Hello!' }]),
    'high'
  );
  assert.equal(
    classifyTaskComplexityForThinking('Deep Research', [{ role: 'user', content: 'Explain photosynthesis.' }]),
    'high'
  );
  assert.equal(
    classifyTaskComplexityForThinking('Code Analysis', [{ role: 'user', content: 'Check this function.' }]),
    'high'
  );
  assert.equal(
    classifyTaskComplexityForThinking('Standard Intelligent', [
      { role: 'user', content: 'Please debug this TypeScript SQL architecture audit step-by-step.' },
    ]),
    'high'
  );

  const lowCfg = resolveThinkingConfigForModel('gemini-3.8-flash', 'Standard Intelligent', [
    { role: 'user', content: 'Hi there' },
  ]);
  assert.equal(lowCfg.thinkingConfig?.thinkingLevel, ThinkingLevel.LOW);

  const highCfg = resolveThinkingConfigForModel('gemini-3.8-flash', 'Think', [
    { role: 'user', content: 'Hi there' },
  ]);
  assert.equal(highCfg.thinkingConfig?.thinkingLevel, ThinkingLevel.HIGH);

  const emergencyCfg = resolveThinkingConfigForModel('gemini-3.1-flash-lite', 'Standard Intelligent', [
    { role: 'user', content: 'Hi there' },
  ]);
  assert.equal(emergencyCfg.thinkingConfig?.thinkingLevel, ThinkingLevel.MINIMAL);
});

test('extractRetryAfterMs extracts bounded Retry-After headers and retryDelay strings', () => {
  const errHeader = { response: { headers: { 'retry-after': '2' } } };
  assert.equal(extractRetryAfterMs(errHeader), 2000);

  const errDetails = { error: { details: [{ retryDelay: '1.5s' }] } };
  assert.equal(extractRetryAfterMs(errDetails), 1500);

  const errCapped = { message: 'Please retry-after: 45s' };
  assert.equal(extractRetryAfterMs(errCapped), 5000);
});

test('handleChatRequest simulates primary 503 failover to gemini-3.1-flash-lite while preserving full conversation context and telemetry', async () => {
  resetBackendCachesForTesting();
  const attemptedModels: string[] = [];
  let fallbackPayloadContents: unknown = null;

  const deps = makeDeps(
    async (params) => {
      const model = String(params.model);
      attemptedModels.push(model);

      if (model === DEFAULT_GEMINI_MODEL) {
        throw Object.assign(new Error('503 Service Unavailable - high demand'), { status: 503 });
      }
      if (model === EMERGENCY_FALLBACK_MODEL) {
        fallbackPayloadContents = params.contents;
        return { text: 'Your favourite colour is blue.' };
      }
      throw new Error(`Unexpected model ${model}`);
    },
    {
      env: {
        GEMINI_API_KEY: 'test-key-not-real',
        GEMINI_MODEL: 'gemini-4-hydrogen', // Ensure stale override never calls Hydrogen
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      },
    }
  );

  const res = await handleChatRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer test_jwt',
      body: {
        mode: 'Think',
        messages: [
          { role: 'user', content: 'My favourite colour is blue.' },
          { role: 'assistant', content: 'Got it — blue is a calm choice.' },
          { role: 'user', content: 'What colour did I mention?' },
        ],
      },
    },
    deps
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.requestedModel, DEFAULT_GEMINI_MODEL);
  assert.equal(res.body.actualModel, EMERGENCY_FALLBACK_MODEL);
  assert.equal(res.body.modelUsed, EMERGENCY_FALLBACK_MODEL);
  assert.equal(res.body.fallbackActivated, true);
  assert.match(String(res.body.fallbackReason), /MODEL_UNAVAILABLE/);
  assert.ok(typeof res.body.retryCount === 'number' && res.body.retryCount >= 1);
  assert.ok(typeof res.body.durationMs === 'number');
  assert.equal(attemptedModels.includes('gemini-4-hydrogen'), false);
  assert.ok(attemptedModels.includes(DEFAULT_GEMINI_MODEL));
  assert.ok(attemptedModels.includes(EMERGENCY_FALLBACK_MODEL));
  assert.equal(Array.isArray(fallbackPayloadContents) ? fallbackPayloadContents.length : 0, 3);

  const counts = getModelUsageCounts();
  assert.equal(counts[EMERGENCY_FALLBACK_MODEL], 1);
  assert.equal(counts[DEFAULT_GEMINI_MODEL], 0);
});

test('handleChatRequest aborts fallback immediately on API_KEY_INVALID', async () => {
  resetBackendCachesForTesting();
  const attemptedModels: string[] = [];

  const deps = makeDeps(async (params) => {
    attemptedModels.push(String(params.model));
    throw Object.assign(new Error('API_KEY_INVALID: API key not valid'), { status: 400 });
  });

  const res = await handleChatRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer test_jwt',
      body: { mode: 'Think', messages: [{ role: 'user', content: 'Hello!' }] },
    },
    deps
  );

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'API_KEY_INVALID');
  assert.deepEqual(attemptedModels, [DEFAULT_GEMINI_MODEL]);
});

test('handleChatRequest retries transient 503 on primary with Retry-After and succeeds without fallback', async () => {
  resetBackendCachesForTesting();
  let calls = 0;
  const sleeps: number[] = [];

  const deps = makeDeps(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw Object.assign(new Error('503 high demand'), {
          status: 503,
          response: { headers: { 'retry-after': '1' } },
        });
      }
      return { text: 'Primary succeeded after transient retry.' };
    },
    {
      sleep: async (ms: number) => {
        sleeps.push(ms);
      },
    }
  );

  const res = await handleChatRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer test_jwt',
      body: { mode: 'Think', messages: [{ role: 'user', content: 'Hi Angel' }] },
    },
    deps
  );

  assert.equal(res.statusCode, 200);
  assert.equal(calls, 2);
  assert.equal(res.body.actualModel, DEFAULT_GEMINI_MODEL);
  assert.equal(res.body.fallbackActivated, false);
  assert.equal(res.body.retryCount, 1);
  assert.ok(sleeps.length === 1 && sleeps[0] >= 1000);
});

test('handleTitleRequest retries transient 503 and fails over cleanly from primary to emergency fallback', async () => {
  resetBackendCachesForTesting();
  const attempted: string[] = [];

  const deps = makeDeps(async (params) => {
    const model = String(params.model);
    attempted.push(model);
    if (model === DEFAULT_GEMINI_MODEL) {
      throw Object.assign(new Error('503 Service Unavailable'), { status: 503 });
    }
    return { text: '"Blue Color Chat"' };
  });

  const res = await handleTitleRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer test_jwt',
      body: { message: 'My favourite colour is blue.' },
    },
    deps
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.title, 'Blue Color Chat');
  assert.equal(res.body.requestedModel, DEFAULT_GEMINI_MODEL);
  assert.equal(res.body.actualModel, EMERGENCY_FALLBACK_MODEL);
  assert.equal(res.body.fallbackActivated, true);
  assert.equal(attempted.includes('gemini-4-hydrogen'), false);
  assert.ok(attempted.includes(DEFAULT_GEMINI_MODEL));
  assert.ok(attempted.includes(EMERGENCY_FALLBACK_MODEL));
});

test('handleModelStatusRequest with includeTiers probes active 2-tier stack without calling Hydrogen', async () => {
  resetBackendCachesForTesting();
  const probedModels: string[] = [];

  const deps = makeDeps(async (params) => {
    const model = String(params.model);
    probedModels.push(model);
    return { text: 'OK' };
  });

  const statusRes = await handleModelStatusRequest(
    {
      method: 'GET',
      forceRefresh: true,
      liveProbe: true,
      includeTiers: true,
    },
    deps
  );

  assert.equal(statusRes.statusCode, 200);
  const tierResults = statusRes.body.tierResults as Array<{
    model: string;
    tier: string;
    generationVerified: boolean;
  }>;
  assert.equal(tierResults.length, 2);
  assert.equal(tierResults[0].model, DEFAULT_GEMINI_MODEL);
  assert.equal(tierResults[0].tier, 'primary');
  assert.equal(tierResults[0].generationVerified, true);
  assert.equal(tierResults[1].model, EMERGENCY_FALLBACK_MODEL);
  assert.equal(tierResults[1].tier, 'emergency');
  assert.equal(tierResults[1].generationVerified, true);
  assert.equal(probedModels.includes('gemini-4-hydrogen'), false);

  const available = statusRes.body.availableTextModels as string[];
  assert.ok(Array.isArray(available) && available.includes(DEFAULT_GEMINI_MODEL));
});

test('handleModelStatusRequest verifies fallback tier and reports envAudit safely when primary returns 503', async () => {
  resetBackendCachesForTesting();
  const deps = makeDeps(
    async (params) => {
      const model = String(params.model);
      if (model === DEFAULT_GEMINI_MODEL) {
        throw Object.assign(new Error('503 Service Unavailable - high demand'), { status: 503 });
      }
      return { text: 'OK' };
    },
    {
      env: {
        NETLIFY: 'true',
        GEMINI_API_KEY: 'AIzaTestSecretShouldNeverLeakInEnvAudit123',
        GEMINI_MODEL: 'gemini-4-hydrogen',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      },
      createGeminiClient: () => ({
        models: {
          get: async ({ model }: { model: string }) => {
            if (model === DEFAULT_GEMINI_MODEL) {
              throw Object.assign(new Error('503 Service Unavailable'), { status: 503 });
            }
            return { name: `models/${model}` };
          },
          generateContent: async (params: Record<string, unknown>) => {
            if (String(params.model) === DEFAULT_GEMINI_MODEL) {
              throw Object.assign(new Error('503 Service Unavailable'), { status: 503 });
            }
            return { text: 'OK' };
          },
        },
      }),
    }
  );

  const statusRes = await handleModelStatusRequest(
    {
      method: 'GET',
      forceRefresh: true,
      liveProbe: true,
    },
    deps
  );

  assert.equal(statusRes.statusCode, 200);
  assert.equal(statusRes.body.state, 'generation_successful');
  assert.equal(statusRes.body.connected, true);
  assert.equal(statusRes.body.providerReachable, true);
  assert.equal(statusRes.body.generationVerified, true);
  assert.equal(statusRes.body.model, DEFAULT_GEMINI_MODEL);
  assert.equal(statusRes.body.activeModel, EMERGENCY_FALLBACK_MODEL);
  assert.equal(statusRes.body.fallbackActivated, true);

  const envAudit = statusRes.body.envAudit as Record<string, unknown>;
  assert.equal(envAudit.runtime, 'netlify-function');
  assert.equal(envAudit.geminiApiKeyConfigured, true);
  assert.equal(envAudit.geminiModelOverrideConfigured, false);
  assert.equal(envAudit.obsoleteOverrideIgnored, true);
  assert.equal(envAudit.configuredModel, DEFAULT_GEMINI_MODEL);
  assert.equal(envAudit.defaultModel, DEFAULT_GEMINI_MODEL);
  assert.deepEqual(envAudit.fallbackChain, [DEFAULT_GEMINI_MODEL, EMERGENCY_FALLBACK_MODEL]);
  assert.equal(JSON.stringify(statusRes.body).includes('AIzaTestSecretShouldNeverLeakInEnvAudit123'), false);
});

test('classifyTaskForModelRouting sends everyday chat directly to gemini-3.1-flash-lite and demanding tasks to gemini-3.8-flash', () => {
  const everyday = classifyTaskForModelRouting({
    configuredModel: DEFAULT_GEMINI_MODEL,
    requestedMode: 'Standard Intelligent',
    messages: [{ role: 'user', content: 'Hey Angel, how are you doing today?' }],
  });
  assert.equal(everyday.tier, 'everyday');
  assert.equal(everyday.primaryModel, EMERGENCY_FALLBACK_MODEL);
  assert.deepEqual(everyday.candidateModels, [EMERGENCY_FALLBACK_MODEL, DEFAULT_GEMINI_MODEL]);

  const thinkRouting = classifyTaskForModelRouting({
    configuredModel: DEFAULT_GEMINI_MODEL,
    requestedMode: 'Think',
    messages: [{ role: 'user', content: 'Hi' }],
  });
  assert.equal(thinkRouting.tier, 'advanced');
  assert.equal(thinkRouting.primaryModel, DEFAULT_GEMINI_MODEL);

  const attachmentRouting = classifyTaskForModelRouting({
    configuredModel: DEFAULT_GEMINI_MODEL,
    requestedMode: 'Standard Intelligent',
    messages: [{ role: 'user', content: 'Transcribe this' }],
    attachments: [{ name: 'voice.mp3', mimeType: 'audio/mpeg', sizeBytes: 1200 }],
  });
  assert.equal(attachmentRouting.tier, 'advanced');
  assert.equal(attachmentRouting.primaryModel, DEFAULT_GEMINI_MODEL);
});

test('handleChatStreamRequest emits stage/delta/done events, fails over pre-token, and supports AbortSignal cancellation', async () => {
  resetBackendCachesForTesting();
  const events: ChatStreamEvent[] = [];

  await handleChatStreamRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer test_jwt',
      body: { mode: 'Deep Research', messages: [{ role: 'user', content: 'Compare solar vs wind storage.' }] },
    },
    (ev) => events.push(ev),
    {
      env: {
        GEMINI_API_KEY: 'test-key-not-real',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      },
      fetchImpl: createMockSupabaseFetch(),
      sleep: async () => {},
      createGeminiClient: () => ({
        models: {
          generateContent: async () => ({ text: 'fallback' }),
          generateContentStream: async (params: Record<string, unknown>) => {
            if (String(params.model) === DEFAULT_GEMINI_MODEL) {
              throw Object.assign(new Error('503 Service Unavailable'), { status: 503 });
            }
            return (async function* () {
              yield { text: 'Solar ' };
              yield { text: 'and wind.' };
            })();
          },
        },
      }),
    }
  );

  assert.ok(events.some((e) => e.type === 'stage' && e.stage === 'Researching'));
  const deltas = events.filter((e) => e.type === 'delta').map((e) => (e.type === 'delta' ? e.text : ''));
  assert.deepEqual(deltas, ['Solar ', 'and wind.']);
  const done = events.find((e) => e.type === 'done');
  assert.ok(done && done.type === 'done');
  assert.equal(done.reply, 'Solar and wind.');
  assert.equal(done.requestedModel, DEFAULT_GEMINI_MODEL);
  assert.equal(done.actualModel, EMERGENCY_FALLBACK_MODEL);
  assert.equal(done.fallbackActivated, true);

  // Test user AbortSignal stops stream mid-way without emitting done
  const abortCtrl = new AbortController();
  const abortedEvents: ChatStreamEvent[] = [];
  await handleChatStreamRequest(
    {
      method: 'POST',
      authorizationHeader: 'Bearer test_jwt',
      signal: abortCtrl.signal,
      body: { mode: 'Standard Intelligent', messages: [{ role: 'user', content: 'Say hi' }] },
    },
    (ev) => {
      abortedEvents.push(ev);
      if (ev.type === 'delta') abortCtrl.abort();
    },
    {
      env: {
        GEMINI_API_KEY: 'test-key-not-real',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      },
      fetchImpl: createMockSupabaseFetch(),
      createGeminiClient: () => ({
        models: {
          generateContent: async () => ({ text: '' }),
          generateContentStream: async () =>
            (async function* () {
              yield { text: 'Part 1 ' };
              yield { text: 'Part 2' };
            })(),
        },
      }),
    }
  );
  assert.equal(abortedEvents.some((e) => e.type === 'done'), false);
});

test('handleTranslateRequest validates auth/input and translates text cleanly via gemini-3.1-flash-lite', async () => {
  resetBackendCachesForTesting();
  const unauth = await handleTranslateRequest(
    { method: 'POST', authorizationHeader: null, body: { text: 'Hello', targetLanguage: 'Spanish' } },
    makeDeps(async () => ({ text: 'Hola' }))
  );
  assert.equal(unauth.statusCode, 401);

  const empty = await handleTranslateRequest(
    { method: 'POST', authorizationHeader: 'Bearer test_jwt', body: { text: '   ', targetLanguage: 'Spanish' } },
    makeDeps(async () => ({ text: '' }))
  );
  assert.equal(empty.statusCode, 400);

  let usedModel = '';
  const ok = await handleTranslateRequest(
    { method: 'POST', authorizationHeader: 'Bearer test_jwt', body: { text: 'Good morning', targetLanguage: 'French' } },
    makeDeps(async (params) => {
      usedModel = String(params.model);
      return { text: 'Bonjour' };
    })
  );
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.success, true);
  assert.equal(ok.body.translatedText, 'Bonjour');
  assert.equal(usedModel, EMERGENCY_FALLBACK_MODEL);
});
