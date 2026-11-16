import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import crypto from 'node:crypto';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';
export const MAX_MESSAGES_PER_REQUEST = 40;
export const MAX_MESSAGE_LENGTH = 12000;
export const MAX_TOTAL_PAYLOAD_CHARS = 64000;
export const MAX_SYSTEM_INSTRUCTION_LENGTH = 8000;
export const PROVIDER_TIMEOUT_MS = 25000;
export const HEALTH_PROBE_TIMEOUT_MS = 4500;
export const HEALTH_CACHE_TTL_MS = 60000;

export type ModelHealthState =
  | 'credentials_missing'
  | 'credentials_configured'
  | 'provider_reachable'
  | 'generation_successful'
  | 'provider_unavailable';

export interface ModelHealthStatus {
  state: ModelHealthState;
  connected: boolean;
  credentialsConfigured: boolean;
  providerReachable: boolean;
  generationVerified: boolean;
  model: string;
  thinkModeSupported: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string;
  statusCode?: number;
}

export interface ChatRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestBody {
  messages?: unknown;
  mode?: unknown;
  systemInstruction?: unknown;
}

export interface VerifiedUserResult {
  ok: boolean;
  statusCode: number;
  error?: string;
  errorCode?: 'UNCONFIGURED' | 'UNAUTHENTICATED' | 'AUTH_UNAVAILABLE';
  userId?: string;
  email?: string;
}

export interface BackendResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
}

export interface GeminiClientLike {
  models: {
    generateContent: (params: Record<string, unknown>) => Promise<{ text?: string }>;
    get?: (params: { model: string }) => Promise<unknown>;
  };
}

export interface BackendDependencies {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  createGeminiClient?: (apiKey: string) => GeminiClientLike;
  now?: () => number;
}

interface HealthCacheEntry {
  status: ModelHealthStatus;
  expiresAt: number;
  model: string;
  hasKey: boolean;
}

let healthCache: HealthCacheEntry | null = null;
let lastGenerationVerification: {
  verified: boolean;
  error?: string;
  at: number;
  latencyMs?: number;
  model: string;
} | null = null;

// In-memory sliding window fallback per userId + endpoint when Supabase rate-limit RPC is unavailable
const memoryRateLimits = new Map<string, { windowStart: number; count: number }>();

export function resetBackendCachesForTesting(): void {
  healthCache = null;
  lastGenerationVerification = null;
  memoryRateLimits.clear();
}

function getEnv(deps?: BackendDependencies): Record<string, string | undefined> {
  return deps?.env || (typeof process !== 'undefined' ? process.env : {});
}

export function resolveConfiguredModel(env: Record<string, string | undefined>): string {
  const configured = env.GEMINI_MODEL?.trim();
  return configured || DEFAULT_GEMINI_MODEL;
}

export function resolveSupabaseServerConfig(env: Record<string, string | undefined>): {
  url: string | null;
  key: string | null;
} {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim() || null;
  const key =
    (
      env.SUPABASE_PUBLISHABLE_KEY ||
      env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      env.VITE_SUPABASE_ANON_KEY ||
      ''
    ).trim() || null;
  return { url, key };
}

function createDefaultGeminiClient(apiKey: string): GeminiClientLike {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  }) as unknown as GeminiClientLike;
}

function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 12);
}

function logEvent(
  endpoint: string,
  details: {
    statusCode: number;
    latencyMs: number;
    userId?: string;
    mode?: string;
    model?: string;
    code?: string;
  }
): void {
  const safeUser = details.userId ? hashUserId(details.userId) : 'anon';
  console.info(
    JSON.stringify({
      scope: 'angel-ai-api',
      endpoint,
      statusCode: details.statusCode,
      latencyMs: details.latencyMs,
      userHash: safeUser,
      mode: details.mode,
      model: details.model,
      code: details.code,
    })
  );
}

export async function verifySupabaseSessionFromHeader(
  authorizationHeader: string | null | undefined,
  deps?: BackendDependencies
): Promise<VerifiedUserResult> {
  const env = getEnv(deps);
  const { url, key } = resolveSupabaseServerConfig(env);
  if (!url || !key) {
    return {
      ok: false,
      statusCode: 503,
      error: 'Authentication verification service is not configured on the server.',
      errorCode: 'UNCONFIGURED',
    };
  }

  const raw = authorizationHeader || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Please sign in to continue.',
      errorCode: 'UNAUTHENTICATED',
    };
  }

  const fetchFn = deps?.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetchFn(`${url}/auth/v1/user`, {
      headers: {
        apikey: key,
        authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        statusCode: 401,
        error: 'Your session is invalid or has expired. Please sign in again.',
        errorCode: 'UNAUTHENTICATED',
      };
    }

    const user = (await response.json().catch(() => null)) as { id?: string; email?: string } | null;
    if (!user?.id) {
      return {
        ok: false,
        statusCode: 401,
        error: 'Unable to verify user identity from session.',
        errorCode: 'UNAUTHENTICATED',
      };
    }

    return {
      ok: true,
      statusCode: 200,
      userId: user.id,
      email: user.email,
    };
  } catch {
    return {
      ok: false,
      statusCode: 503,
      error: 'Unable to reach identity verification service. Please try again.',
      errorCode: 'AUTH_UNAVAILABLE',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function enforceRateLimit(
  userId: string,
  token: string,
  endpoint: string,
  deps?: BackendDependencies,
  maxRequests = 30,
  windowSeconds = 60
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const env = getEnv(deps);
  const { url, key } = resolveSupabaseServerConfig(env);
  const fetchFn = deps?.fetchImpl || fetch;
  const nowFn = deps?.now || Date.now;

  // Attempt Supabase RPC backed rate limit first (works cleanly across serverless invocations)
  if (url && key && token) {
    try {
      const res = await fetchFn(`${url}/rest/v1/rpc/consume_companion_rate_limit`, {
        method: 'POST',
        headers: {
          apikey: key,
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          p_endpoint: endpoint,
          p_max_requests: maxRequests,
          p_window_seconds: windowSeconds,
        }),
      });
      if (res.ok) {
        const rows = (await res.json().catch(() => null)) as Array<{
          allowed?: boolean;
          reset_at?: string;
        }> | null;
        const first = Array.isArray(rows) ? rows[0] : null;
        if (first && typeof first.allowed === 'boolean') {
          const resetMs = first.reset_at ? new Date(first.reset_at).getTime() : nowFn() + windowSeconds * 1000;
          const retryAfter = Math.max(1, Math.ceil((resetMs - nowFn()) / 1000));
          return { allowed: first.allowed, retryAfterSeconds: retryAfter };
        }
      }
    } catch {
      // Fall back to in-memory limiter if RPC is unavailable
    }
  }

  const bucketKey = `${userId}:${endpoint}`;
  const current = nowFn();
  const windowMs = windowSeconds * 1000;
  const existing = memoryRateLimits.get(bucketKey);

  if (!existing || current - existing.windowStart >= windowMs) {
    memoryRateLimits.set(bucketKey, { windowStart: current, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > maxRequests) {
    const retryAfter = Math.max(1, Math.ceil((existing.windowStart + windowMs - current) / 1000));
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isThinkingConfigRejection(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return (
    msg.includes('thinking') &&
    (msg.includes('not supported') ||
      msg.includes('invalid') ||
      msg.includes('unsupported') ||
      msg.includes('unknown field') ||
      msg.includes('400'))
  );
}

export function validateChatPayload(body: ChatRequestBody): {
  valid: boolean;
  statusCode: number;
  error?: string;
  messages?: ChatRequestMessage[];
  mode?: string;
  systemInstruction?: string;
} {
  const rawMessages = body?.messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > MAX_MESSAGES_PER_REQUEST) {
    return {
      valid: false,
      statusCode: 400,
      error: `Send between 1 and ${MAX_MESSAGES_PER_REQUEST} conversation messages.`,
    };
  }

  let totalChars = 0;
  const normalizedMessages: ChatRequestMessage[] = [];

  for (const item of rawMessages) {
    if (!item || typeof item !== 'object') {
      return { valid: false, statusCode: 400, error: 'Each conversation message must be an object.' };
    }
    const candidate = item as { role?: unknown; content?: unknown };
    if (candidate.role !== 'user' && candidate.role !== 'assistant') {
      return { valid: false, statusCode: 400, error: 'Message role must be user or assistant.' };
    }
    if (typeof candidate.content !== 'string' || !candidate.content.trim()) {
      return { valid: false, statusCode: 400, error: 'Messages must contain non-empty text.' };
    }
    if (candidate.content.length > MAX_MESSAGE_LENGTH) {
      return {
        valid: false,
        statusCode: 400,
        error: `Individual messages must not exceed ${MAX_MESSAGE_LENGTH} characters.`,
      };
    }

    totalChars += candidate.content.length;
    if (totalChars > MAX_TOTAL_PAYLOAD_CHARS) {
      return {
        valid: false,
        statusCode: 400,
        error: `Combined conversation payload exceeds the ${MAX_TOTAL_PAYLOAD_CHARS} character limit. Start a new thread or shorten earlier turns.`,
      };
    }

    normalizedMessages.push({
      role: candidate.role,
      content: candidate.content,
    });
  }

  const defaultInstruction =
    'You are Angel, a thoughtful, natural, capable Universal Personal AI Companion. ' +
    'Respond directly, accurately, and conversationally. Respect the complete conversation history. ' +
    'Do not claim to have performed actions or accessed external integrations unless a connected capability confirms it.';

  const systemInstruction =
    typeof body.systemInstruction === 'string' && body.systemInstruction.trim()
      ? body.systemInstruction.trim().slice(0, MAX_SYSTEM_INSTRUCTION_LENGTH)
      : defaultInstruction;

  const mode = typeof body.mode === 'string' && body.mode.trim() ? body.mode.trim() : 'Standard Intelligent';

  return {
    valid: true,
    statusCode: 200,
    messages: normalizedMessages,
    mode,
    systemInstruction,
  };
}

export async function handleChatRequest(
  params: {
    method: string;
    authorizationHeader?: string | null;
    body: unknown;
  },
  deps?: BackendDependencies
): Promise<BackendResponse> {
  const nowFn = deps?.now || Date.now;
  const startedAt = nowFn();

  if (params.method !== 'POST') {
    return { statusCode: 405, body: { success: false, error: 'Method not allowed.' } };
  }

  const authResult = await verifySupabaseSessionFromHeader(params.authorizationHeader, deps);
  if (!authResult.ok || !authResult.userId) {
    logEvent('/api/chat', {
      statusCode: authResult.statusCode,
      latencyMs: nowFn() - startedAt,
      code: authResult.errorCode || 'AUTH_FAILED',
    });
    return {
      statusCode: authResult.statusCode,
      body: {
        success: false,
        error: authResult.error || 'Please sign in to continue.',
        code: authResult.errorCode || 'UNAUTHENTICATED',
      },
    };
  }

  const token = (params.authorizationHeader || '').replace(/^Bearer\s+/i, '').trim();
  const rateLimit = await enforceRateLimit(authResult.userId, token, 'chat', deps, 30, 60);
  if (!rateLimit.allowed) {
    logEvent('/api/chat', {
      statusCode: 429,
      latencyMs: nowFn() - startedAt,
      userId: authResult.userId,
      code: 'RATE_LIMITED',
    });
    return {
      statusCode: 429,
      headers: { 'retry-after': String(rateLimit.retryAfterSeconds) },
      body: {
        success: false,
        error: `Too many requests. Please wait ${rateLimit.retryAfterSeconds}s before trying again.`,
        code: 'RATE_LIMITED',
      },
    };
  }

  const env = getEnv(deps);
  const apiKey = env.GEMINI_API_KEY?.trim();
  const modelUsed = resolveConfiguredModel(env);
  if (!apiKey) {
    return {
      statusCode: 503,
      body: {
        success: false,
        error: 'GEMINI_API_KEY is not configured in the server environment.',
        status: 'credentials_missing',
      },
    };
  }

  const validation = validateChatPayload((params.body || {}) as ChatRequestBody);
  if (!validation.valid || !validation.messages) {
    return {
      statusCode: validation.statusCode,
      body: {
        success: false,
        error: validation.error || 'Invalid request payload.',
        code: 'VALIDATION_ERROR',
      },
    };
  }

  const ai = (deps?.createGeminiClient || createDefaultGeminiClient)(apiKey);
  const requestedMode = validation.mode || 'Standard Intelligent';
  const isThinkRequested = requestedMode === 'Think';
  const baseConfig: Record<string, unknown> = {
    systemInstruction: validation.systemInstruction,
  };
  if (isThinkRequested) {
    baseConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
  }

  const contents = validation.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    let appliedMode = requestedMode;
    let thinkingLevel = isThinkRequested ? 'HIGH' : 'DEFAULT';
    let response: { text?: string };

    try {
      response = await withTimeout(
        ai.models.generateContent({
          model: modelUsed,
          contents,
          config: baseConfig,
        }),
        PROVIDER_TIMEOUT_MS,
        'Gemini generation'
      );
    } catch (innerErr) {
      if (isThinkRequested && isThinkingConfigRejection(innerErr)) {
        // Graceful fallback if custom overridden model rejects thinkingConfig
        const fallbackConfig: Record<string, unknown> = {
          systemInstruction: validation.systemInstruction,
        };
        response = await withTimeout(
          ai.models.generateContent({
            model: modelUsed,
            contents,
            config: fallbackConfig,
          }),
          PROVIDER_TIMEOUT_MS,
          'Gemini generation fallback'
        );
        appliedMode = 'Standard Intelligent';
        thinkingLevel = 'DEFAULT';
      } else {
        throw innerErr;
      }
    }

    const reply = response.text?.trim();
    const latencyMs = nowFn() - startedAt;

    if (!reply) {
      lastGenerationVerification = {
        verified: false,
        error: 'Empty response from model provider.',
        at: nowFn(),
        latencyMs,
        model: modelUsed,
      };
      healthCache = null;
      return {
        statusCode: 502,
        body: {
          success: false,
          error: 'Angel could not produce a response. Please try again.',
          code: 'EMPTY_RESPONSE',
        },
      };
    }

    lastGenerationVerification = {
      verified: true,
      at: nowFn(),
      latencyMs,
      model: modelUsed,
    };
    healthCache = null;

    logEvent('/api/chat', {
      statusCode: 200,
      latencyMs,
      userId: authResult.userId,
      mode: appliedMode,
      model: modelUsed,
      code: 'OK',
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        reply,
        text: reply,
        modelUsed,
        requestedMode,
        appliedMode,
        thinkingLevel,
      },
    };
  } catch (error) {
    const latencyMs = nowFn() - startedAt;
    const message = error instanceof Error ? error.message : 'Model generation error';
    const isTimeout = message.toLowerCase().includes('timed out');

    lastGenerationVerification = {
      verified: false,
      error: message,
      at: nowFn(),
      latencyMs,
      model: modelUsed,
    };
    healthCache = null;

    logEvent('/api/chat', {
      statusCode: isTimeout ? 504 : 502,
      latencyMs,
      userId: authResult.userId,
      mode: requestedMode,
      model: modelUsed,
      code: isTimeout ? 'TIMEOUT' : 'PROVIDER_ERROR',
    });

    return {
      statusCode: isTimeout ? 504 : 502,
      body: {
        success: false,
        error: isTimeout
          ? 'Angel took too long to respond. Please try again.'
          : 'Angel could not reach the conversation model. Please try again.',
        code: isTimeout ? 'TIMEOUT' : 'PROVIDER_ERROR',
      },
    };
  }
}

export async function handleTitleRequest(
  params: {
    method: string;
    authorizationHeader?: string | null;
    body: unknown;
  },
  deps?: BackendDependencies
): Promise<BackendResponse> {
  const nowFn = deps?.now || Date.now;
  const startedAt = nowFn();

  if (params.method !== 'POST') {
    return { statusCode: 405, body: { success: false, error: 'Method not allowed.' } };
  }

  const authResult = await verifySupabaseSessionFromHeader(params.authorizationHeader, deps);
  if (!authResult.ok || !authResult.userId) {
    return {
      statusCode: authResult.statusCode,
      body: {
        success: false,
        error: authResult.error || 'Please sign in to continue.',
      },
    };
  }

  const token = (params.authorizationHeader || '').replace(/^Bearer\s+/i, '').trim();
  const rateLimit = await enforceRateLimit(authResult.userId, token, 'title', deps, 30, 60);
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: { 'retry-after': String(rateLimit.retryAfterSeconds) },
      body: {
        success: false,
        error: `Rate limit exceeded. Retry in ${rateLimit.retryAfterSeconds}s.`,
      },
    };
  }

  const body = (params.body || {}) as { message?: unknown };
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > MAX_MESSAGE_LENGTH) {
    return { statusCode: 400, body: { success: false, error: 'A valid message is required.' } };
  }

  const env = getEnv(deps);
  const apiKey = env.GEMINI_API_KEY?.trim();
  const modelUsed = resolveConfiguredModel(env);
  if (!apiKey) {
    return { statusCode: 503, body: { success: false, error: 'GEMINI_API_KEY is not configured.' } };
  }

  const ai = (deps?.createGeminiClient || createDefaultGeminiClient)(apiKey);
  try {
    const result = await withTimeout(
      ai.models.generateContent({
        model: modelUsed,
        contents: `Generate a concise 2 to 4 word title for this message. Reply only with the title: ${body.message.trim()}`,
      }),
      10000,
      'Gemini title generation'
    );
    const title = result.text?.trim().replace(/^["']|["']$/g, '') || '';
    logEvent('/api/title', {
      statusCode: 200,
      latencyMs: nowFn() - startedAt,
      userId: authResult.userId,
      model: modelUsed,
      code: 'OK',
    });
    return {
      statusCode: 200,
      body: { success: Boolean(title), title: title || 'General Conversation', modelUsed },
    };
  } catch {
    logEvent('/api/title', {
      statusCode: 502,
      latencyMs: nowFn() - startedAt,
      userId: authResult.userId,
      model: modelUsed,
      code: 'PROVIDER_ERROR',
    });
    return { statusCode: 502, body: { success: false, error: 'Could not generate a title.' } };
  }
}

export async function handleModelStatusRequest(
  params: {
    method: string;
    forceRefresh?: boolean;
    liveProbe?: boolean;
  },
  deps?: BackendDependencies
): Promise<BackendResponse> {
  if (params.method !== 'GET') {
    return { statusCode: 405, body: { error: 'Method not allowed.' } };
  }

  const nowFn = deps?.now || Date.now;
  const env = getEnv(deps);
  const apiKey = env.GEMINI_API_KEY?.trim() || '';
  const hasKey = Boolean(apiKey);
  const model = resolveConfiguredModel(env);
  const checkedAt = new Date(nowFn()).toISOString();

  if (!hasKey) {
    const missingStatus: ModelHealthStatus = {
      state: 'credentials_missing',
      connected: false,
      credentialsConfigured: false,
      providerReachable: false,
      generationVerified: false,
      model,
      thinkModeSupported: true,
      checkedAt,
      latencyMs: null,
      message: 'GEMINI_API_KEY is not configured in server environment.',
    };
    return { statusCode: 200, body: { ...missingStatus } };
  }

  // Return cached probe status if still fresh and forceRefresh is false
  if (
    !params.forceRefresh &&
    healthCache &&
    healthCache.expiresAt > nowFn() &&
    healthCache.model === model &&
    healthCache.hasKey === hasKey
  ) {
    return { statusCode: 200, body: { ...healthCache.status } };
  }

  const probeStarted = nowFn();
  const ai = (deps?.createGeminiClient || createDefaultGeminiClient)(apiKey);

  // Determine live provider reachability via lightweight metadata get (and optional generation probe)
  let providerReachable = false;
  let generationVerified = Boolean(
    lastGenerationVerification?.verified &&
      lastGenerationVerification.model === model &&
      nowFn() - lastGenerationVerification.at < 15 * 60 * 1000
  );
  let probeError: string | null = null;
  let latencyMs: number | null = lastGenerationVerification?.latencyMs ?? null;

  if (params.liveProbe !== false) {
    try {
      if (typeof ai.models.get === 'function') {
        await withTimeout(ai.models.get({ model }), HEALTH_PROBE_TIMEOUT_MS, 'Gemini health probe');
        providerReachable = true;
        latencyMs = nowFn() - probeStarted;
      }

      if (params.liveProbe === true) {
        const genRes = await withTimeout(
          ai.models.generateContent({
            model,
            contents: 'Reply with OK.',
          }),
          HEALTH_PROBE_TIMEOUT_MS,
          'Gemini generation probe'
        );
        if (genRes.text && genRes.text.trim()) {
          providerReachable = true;
          generationVerified = true;
          latencyMs = nowFn() - probeStarted;
          lastGenerationVerification = {
            verified: true,
            at: nowFn(),
            latencyMs,
            model,
          };
        }
      }
    } catch (err) {
      probeError = err instanceof Error ? err.message : 'Provider unreachable';
      providerReachable = false;
      latencyMs = nowFn() - probeStarted;
    }
  }

  let state: ModelHealthState = 'credentials_configured';
  let message = 'Gemini server credentials are configured. Provider probe pending.';

  if (probeError || (lastGenerationVerification && !lastGenerationVerification.verified && !providerReachable)) {
    state = 'provider_unavailable';
    message = `Gemini credentials present, but provider check failed: ${probeError || lastGenerationVerification?.error || 'unavailable'}.`;
  } else if (generationVerified) {
    state = 'generation_successful';
    message = `Gemini (${model}) is reachable and verified with live generation.`;
  } else if (providerReachable) {
    state = 'provider_reachable';
    message = `Gemini (${model}) credentials valid and provider API is reachable.`;
  }

  const statusPayload: ModelHealthStatus = {
    state,
    connected: state === 'provider_reachable' || state === 'generation_successful' || state === 'credentials_configured',
    credentialsConfigured: true,
    providerReachable,
    generationVerified,
    model,
    thinkModeSupported: true,
    checkedAt,
    latencyMs,
    message,
  };

  healthCache = {
    status: statusPayload,
    expiresAt: nowFn() + HEALTH_CACHE_TTL_MS,
    model,
    hasKey,
  };

  return { statusCode: 200, body: { ...statusPayload } };
}
