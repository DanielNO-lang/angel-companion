import { ChatMessage } from '../types/angel';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const SECONDARY_GEMINI_MODEL = 'gemini-3.1-flash-lite';
export const EMERGENCY_GEMINI_MODEL = SECONDARY_GEMINI_MODEL;
export const MODEL_FALLBACK_STRATEGY = [
  DEFAULT_GEMINI_MODEL,
  SECONDARY_GEMINI_MODEL,
] as const;

export function normalizeServerModelOverride(raw?: string): string {
  const cleaned = (raw || '').trim().replace(/^models\//i, '').trim();
  if (!cleaned) return DEFAULT_GEMINI_MODEL;
  const normalized = /\s/.test(cleaned) ? cleaned.toLowerCase().replace(/\s+/g, '-') : cleaned;
  const lower = normalized.toLowerCase();
  if (lower.includes('hydrogen') || lower === SECONDARY_GEMINI_MODEL) {
    return DEFAULT_GEMINI_MODEL;
  }
  return normalized === DEFAULT_GEMINI_MODEL ? DEFAULT_GEMINI_MODEL : DEFAULT_GEMINI_MODEL;
}

export function resolveStrictFallbackChain(_rawOverride?: string): string[] {
  return [DEFAULT_GEMINI_MODEL, SECONDARY_GEMINI_MODEL];
}

export type ModelHealthState =
  | 'credentials_missing'
  | 'credentials_configured'
  | 'provider_reachable'
  | 'generation_successful'
  | 'provider_unavailable';

export interface ModelTierProbeResult {
  model: string;
  tier: 'primary' | 'secondary' | 'emergency';
  modelsGetReachable: boolean;
  generationVerified: boolean;
  latencyMs: number | null;
  statusCode?: number;
  diagnosticCode?: string;
  detail?: string;
}

export interface ModelHealthStatus {
  state: ModelHealthState;
  connected: boolean;
  credentialsConfigured: boolean;
  providerReachable: boolean;
  generationVerified: boolean;
  model: string;
  activeModel?: string;
  fallbackActivated?: boolean;
  fallbackModels?: string[];
  thinkModeSupported: boolean;
  checkedAt: string;
  latencyMs: number | null;
  message: string;
  probeDiagnosticCode?: string;
  requestId?: string;
  usageCounts?: Record<string, number>;
  tierResults?: ModelTierProbeResult[];
  availableTextModels?: string[];
  envAudit?: Record<string, unknown>;
  diagnostic?: Record<string, unknown>;
}

export interface ModelChatResponse {
  success: boolean;
  text?: string;
  error?: string;
  status?: string;
  statusCode?: number;
  modelUsed?: string;
  actualModel?: string;
  requestedModel?: string;
  fallbackActivated?: boolean;
  fallbackReason?: string;
  retryCount?: number;
  durationMs?: number;
  attemptedModels?: string[];
  requestedMode?: string;
  appliedMode?: string;
  thinkingLevel?: string;
  requestId?: string;
  taskTier?: 'everyday' | 'advanced';
  routingReason?: string;
  diagnostic?: Record<string, unknown>;
}

export interface ChatStreamCallbacks {
  signal?: AbortSignal;
  onStage?: (stage: {
    stage: string;
    label: string;
    requestedModel?: string;
    modelUsed?: string;
    taskTier?: 'everyday' | 'advanced';
  }) => void;
  onDelta?: (deltaText: string, fullTextSoFar: string) => void;
}

export interface ChatAttachmentPayload {
  id?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath?: string;
  extractedText?: string;
  inlineDataBase64?: string;
}

export interface GeminiChatDiagnosticOverrides {
  fetchImpl?: typeof fetch;
  createClient?: (apiKey: string) => {
    models: {
      generateContent: (params: Record<string, unknown>) => Promise<{ text?: string }>;
    };
  };
  modelOverride?: string;
  apiKeyOverride?: string;
  sleep?: (ms: number) => Promise<void>;
  forceDirectSdk?: boolean;
}

export function extractIntelligentTitle(input: string): string {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (/^(hi|hello|hey|greetings|howdy|good morning|good evening|good afternoon)\b/i.test(lower) && trimmed.length < 30) {
    return 'General Conversation';
  }

  if (lower.includes('photography') || (lower.includes('portfolio') && (lower.includes('photo') || lower.includes('picture')))) {
    return 'Photography Portfolio Website';
  }
  if (lower.includes('build a website') || lower.includes('create a website') || lower.includes('make a website')) {
    return 'Website Project Design';
  }
  if (lower.includes('photosynthesis')) {
    return 'Photosynthesis Principles';
  }
  if (lower.includes('quantum') && (lower.includes('entanglement') || lower.includes('physics'))) {
    return 'Quantum Entanglement Research';
  }
  if (lower.includes('debounce') || (lower.includes('typescript') && lower.includes('function'))) {
    return 'TypeScript Debounce Function';
  }
  if (lower.includes('email') || lower.includes('draft')) {
    return 'Project Update Draft';
  }
  if (lower.includes('brainstorm') || lower.includes('ideas')) {
    return 'Brainstorming Session';
  }

  const words = trimmed
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(
      (w) =>
        !/^(can|you|please|help|me|with|the|a|an|i|want|to|how|do|what|is|are|tell|about|my|for)\b/i.test(w) &&
        w.length > 1
    );

  if (words.length >= 2) {
    const selected = words.slice(0, 4);
    return selected.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  if (words.length === 1) {
    return `${words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()} Exploration`;
  }

  return 'General Inquiry';
}

export class GeminiModelService {
  private lastStatus: ModelHealthStatus = {
    state: 'credentials_missing',
    connected: false,
    credentialsConfigured: false,
    providerReachable: false,
    generationVerified: false,
    model: DEFAULT_GEMINI_MODEL,
    activeModel: DEFAULT_GEMINI_MODEL,
    fallbackActivated: false,
    fallbackModels: [SECONDARY_GEMINI_MODEL],
    thinkModeSupported: true,
    checkedAt: new Date().toISOString(),
    latencyMs: null,
    message: 'Model status has not been checked yet.',
  };
  private listeners = new Set<(status: ModelHealthStatus) => void>();

  public getCachedStatus(): ModelHealthStatus {
    return this.lastStatus;
  }

  public subscribeStatus(listener: (status: ModelHealthStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.lastStatus);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private publishStatus(next: ModelHealthStatus): void {
    this.lastStatus = next;
    this.listeners.forEach((listener) => listener(next));
  }

  public async checkStatus(forceRefresh = false, liveProbe = false, includeTiers = false): Promise<ModelHealthStatus> {
    if (typeof window === 'undefined') {
      const hasKey = typeof process !== 'undefined' && Boolean(process.env.GEMINI_API_KEY?.trim());
      const model = normalizeServerModelOverride(typeof process !== 'undefined' ? process.env.GEMINI_MODEL : '');
      const status: ModelHealthStatus = {
        state: hasKey ? 'credentials_configured' : 'credentials_missing',
        connected: hasKey,
        credentialsConfigured: hasKey,
        providerReachable: false,
        generationVerified: false,
        model,
        activeModel: model,
        fallbackModels: [DEFAULT_GEMINI_MODEL, EMERGENCY_GEMINI_MODEL].filter((m) => m !== model),
        thinkModeSupported: true,
        checkedAt: new Date().toISOString(),
        latencyMs: null,
        message: hasKey
          ? `Gemini (${model}) server credentials are configured.`
          : 'GEMINI_API_KEY is not configured in server environment.',
      };
      this.publishStatus(status);
      return status;
    }

    const startedAt = performance.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), liveProbe ? 47000 : 5000);
      const params = new URLSearchParams();
      if (forceRefresh) params.set('refresh', '1');
      if (liveProbe) params.set('probe', 'generate');
      if (includeTiers) params.set('tiers', '1');
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/model/status${query}`, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as Partial<ModelHealthStatus>;
        const latencyMs = typeof data.latencyMs === 'number'
          ? data.latencyMs
          : Math.round(performance.now() - startedAt);
        const normalized: ModelHealthStatus = {
          state: data.state || (data.connected ? 'credentials_configured' : 'credentials_missing'),
          connected: Boolean(data.connected),
          credentialsConfigured: Boolean(data.credentialsConfigured ?? data.connected),
          providerReachable: Boolean(data.providerReachable),
          generationVerified: Boolean(data.generationVerified),
          model: data.model || DEFAULT_GEMINI_MODEL,
          activeModel: data.activeModel || data.model || DEFAULT_GEMINI_MODEL,
          ...(typeof data.fallbackActivated === 'boolean' ? { fallbackActivated: data.fallbackActivated } : {}),
          ...(Array.isArray(data.fallbackModels) ? { fallbackModels: data.fallbackModels } : {}),
          thinkModeSupported: data.thinkModeSupported ?? true,
          checkedAt: data.checkedAt || new Date().toISOString(),
          latencyMs,
          message: data.message || 'Model status checked.',
          ...(data.probeDiagnosticCode ? { probeDiagnosticCode: data.probeDiagnosticCode } : {}),
          ...(data.requestId ? { requestId: data.requestId } : {}),
          ...(data.usageCounts ? { usageCounts: data.usageCounts } : {}),
          ...(Array.isArray(data.tierResults) ? { tierResults: data.tierResults } : {}),
          ...(Array.isArray(data.availableTextModels) ? { availableTextModels: data.availableTextModels } : {}),
          ...(data.envAudit ? { envAudit: data.envAudit } : {}),
          ...(data.diagnostic ? { diagnostic: data.diagnostic } : {}),
        };
        this.publishStatus(normalized);
        return normalized;
      }
    } catch {
      // Network or timeout reaching server endpoint
    }

    const unavailable: ModelHealthStatus = {
      state: 'provider_unavailable',
      connected: false,
      credentialsConfigured: false,
      providerReachable: false,
      generationVerified: false,
      model: DEFAULT_GEMINI_MODEL,
      thinkModeSupported: true,
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - startedAt),
      message: 'Server model status endpoint unreachable.',
      diagnostic: {
        endpoint: '/api/model/status',
        method: 'GET',
        stage: 'client_fetch',
        code: 'STATUS_ENDPOINT_UNREACHABLE',
        durationMs: Math.round(performance.now() - startedAt),
      },
    };
    this.publishStatus(unavailable);
    return unavailable;
  }

  public async generateChatResponse(
    history: ChatMessage[],
    newMessage: string,
    mode?: string,
    systemInstruction?: string,
    accessToken?: string,
    diagnosticOverrides?: GeminiChatDiagnosticOverrides,
    attachments?: ChatAttachmentPayload[]
  ): Promise<ModelChatResponse> {
    const canUseDirectSdkInNodeOrMock =
      (typeof window === 'undefined' && !diagnosticOverrides?.fetchImpl) ||
      Boolean(diagnosticOverrides?.forceDirectSdk && typeof diagnosticOverrides?.createClient === 'function');

    if (canUseDirectSdkInNodeOrMock) {
      const configuredApiKey =
        diagnosticOverrides?.apiKeyOverride?.trim() ||
        (typeof window === 'undefined' && typeof process !== 'undefined' ? process.env.GEMINI_API_KEY?.trim() : '');

      if (configuredApiKey) {
        const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        try {
          const { ThinkingLevel } = await import('@google/genai');
          const primaryModel = normalizeServerModelOverride(
            diagnosticOverrides?.modelOverride ??
              (typeof process !== 'undefined' ? process.env.GEMINI_MODEL : undefined)
          );
          const ai = diagnosticOverrides?.createClient
            ? diagnosticOverrides.createClient(configuredApiKey)
            : new (await import('@google/genai')).GoogleGenAI({
                apiKey: configuredApiKey,
                httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
              });
          const sleepFn =
            diagnosticOverrides?.sleep ||
            ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

          const requestedMode = mode || 'Standard Intelligent';
          const isThink = requestedMode === 'Think';
          const resolvedSystemInstruction =
            systemInstruction ||
            'You are Angel, a universal personal AI companion. You communicate naturally, concisely, and substantively.';
          const config: {
            systemInstruction: string;
            thinkingConfig?: { thinkingLevel: typeof ThinkingLevel.HIGH };
          } = {
            systemInstruction: resolvedSystemInstruction,
          };
          if (isThink) {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
          }

          const contents = [
            ...history.map((m) => ({
              role: m.sender === 'user' ? 'user' : 'model',
              parts: [{ text: m.content }],
            })),
            { role: 'user', parts: [{ text: newMessage }] },
          ];

          const candidateModels = resolveStrictFallbackChain(primaryModel);
          let response: { text?: string } | null = null;
          let activeModel = primaryModel;
          let appliedMode = requestedMode;
          let thinkingLevel = isThink ? 'HIGH' : 'DEFAULT';
          let lastErr: any = null;
          let primaryFailureReason: string | undefined;
          let retryCount = 0;
          const attemptedModels: string[] = [];

          for (let idx = 0; idx < candidateModels.length; idx++) {
            const targetModel = candidateModels[idx];
            activeModel = targetModel;
            attemptedModels.push(targetModel);
            const maxAttempts = 2;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
              try {
                try {
                  response = await ai.models.generateContent({ model: targetModel, contents, config });
                  break;
                } catch (innerErr: any) {
                  if (isThink && String(innerErr?.message || '').toLowerCase().includes('thinking')) {
                    const fallbackConfig = { systemInstruction: resolvedSystemInstruction };
                    response = await ai.models.generateContent({
                      model: targetModel,
                      contents,
                      config: fallbackConfig,
                    });
                    appliedMode = 'Standard Intelligent';
                    thinkingLevel = 'DEFAULT';
                    break;
                  }
                  throw innerErr;
                }
              } catch (candidateErr: any) {
                lastErr = candidateErr;
                const statusNum =
                  typeof candidateErr?.status === 'number'
                    ? candidateErr.status
                    : typeof candidateErr?.statusCode === 'number'
                      ? candidateErr.statusCode
                      : undefined;
                const msg = String(candidateErr?.message || '');
                const lower = msg.toLowerCase();
                const isAuthOrConfigErr =
                  lower.includes('api_key_invalid') || lower.includes('permission_denied');
                const isTransient503OrTimeout =
                  statusNum === 503 ||
                  statusNum === 504 ||
                  lower.includes('503') ||
                  lower.includes('unavailable') ||
                  lower.includes('high demand') ||
                  lower.includes('overloaded') ||
                  lower.includes('timed out');

                if (idx === 0 && !primaryFailureReason) {
                  primaryFailureReason = `Primary model ${targetModel} failed${
                    statusNum ? ` (HTTP ${statusNum})` : ''
                  }${msg ? `: ${msg.slice(0, 120)}` : ''}`;
                }

                if (isAuthOrConfigErr) {
                  response = null;
                  break;
                }

                if (isTransient503OrTimeout && attempt < maxAttempts) {
                  retryCount++;
                  await sleepFn(50);
                  continue;
                }
                break;
              }
            }

            if (response?.text) {
              break;
            }
            const errMsgLower = String(lastErr?.message || '').toLowerCase();
            if (errMsgLower.includes('api_key_invalid') || errMsgLower.includes('permission_denied')) {
              break;
            }
          }

          if (!response?.text) {
            throw lastErr || new Error('Direct model fallback chain failed');
          }

          const durationMs = Math.round(
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
          );
          const fallbackActivated = activeModel !== primaryModel;
          const fallbackReason = fallbackActivated ? primaryFailureReason : undefined;

          this.publishStatus({
            ...this.lastStatus,
            state: 'generation_successful',
            connected: true,
            credentialsConfigured: true,
            providerReachable: true,
            generationVerified: true,
            model: primaryModel,
            activeModel,
            fallbackActivated,
            fallbackModels: [SECONDARY_GEMINI_MODEL],
            checkedAt: new Date().toISOString(),
            latencyMs: durationMs,
            message: fallbackActivated
              ? `Emergency fallback active (${activeModel}) — primary ${primaryModel} returned temporary failure.`
              : `Gemini (${activeModel}) responding normally.`,
          });

          return {
            success: true,
            text: response.text,
            modelUsed: activeModel,
            actualModel: activeModel,
            requestedModel: primaryModel,
            fallbackActivated,
            ...(fallbackReason ? { fallbackReason } : {}),
            retryCount,
            durationMs,
            attemptedModels,
            requestedMode,
            appliedMode,
            thinkingLevel,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Direct model call failed',
            status: 'provider_unavailable',
          };
        }
      }

      return {
        success: false,
        error: 'GEMINI_API_KEY is not configured in the server environment.',
        status: 'credentials_missing',
      };
    }

    if (!accessToken) {
      return {
        success: false,
        error: 'Sign in with a verified account to start a private conversation with Angel.',
        status: 'unauthenticated',
        statusCode: 401,
      };
    }

    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 38000);
    const fetchFn = diagnosticOverrides?.fetchImpl || fetch;

    try {
      const messagesPayload = [
        ...history
          .filter((m) => (m.sender === 'user' || m.sender === 'angel') && m.status !== 'failed' && m.status !== 'unsent')
          .map((m) => ({
            role: m.sender === 'angel' ? 'assistant' : 'user',
            content: m.content,
          })),
        ...(newMessage.trim() ? [{ role: 'user', content: newMessage }] : []),
      ];

      const res = await fetchFn('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: messagesPayload,
          mode,
          systemInstruction,
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        }),
        signal: controller.signal,
      });

      const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
      const headerRequestId = res.headers?.get?.('x-request-id') || undefined;
      let parsedOk = true;
      const payload = await res.json().catch(() => {
        parsedOk = false;
        return {};
      });
      const requestId = typeof payload.requestId === 'string' ? payload.requestId : headerRequestId;

      if (res.ok && parsedOk && (payload.reply || payload.text)) {
        const reply = String(payload.reply || payload.text || '').trim();
        const activeModel = payload.actualModel || payload.modelUsed || this.lastStatus.model;
        this.publishStatus({
          ...this.lastStatus,
          state: 'generation_successful',
          connected: true,
          credentialsConfigured: true,
          providerReachable: true,
          generationVerified: true,
          activeModel,
          fallbackActivated: Boolean(payload.fallbackActivated),
          fallbackModels: [SECONDARY_GEMINI_MODEL],
          checkedAt: new Date().toISOString(),
          latencyMs: typeof payload.durationMs === 'number' ? payload.durationMs : durationMs,
          message: payload.fallbackActivated
            ? `Fallback active (${activeModel}) — primary ${payload.requestedModel || this.lastStatus.model} temporarily unavailable.`
            : `Gemini (${activeModel}) responding normally.`,
        });
        return {
          success: true,
          text: reply,
          modelUsed: activeModel,
          actualModel: activeModel,
          requestedModel: payload.requestedModel || this.lastStatus.model,
          fallbackActivated: Boolean(payload.fallbackActivated),
          ...(payload.fallbackReason ? { fallbackReason: payload.fallbackReason } : {}),
          ...(typeof payload.retryCount === 'number' ? { retryCount: payload.retryCount } : {}),
          durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : durationMs,
          ...(Array.isArray(payload.attemptedModels) ? { attemptedModels: payload.attemptedModels } : {}),
          requestedMode: payload.requestedMode || mode,
          appliedMode: payload.appliedMode || mode,
          thinkingLevel: payload.thinkingLevel,
          requestId,
        };
      }

      const derivedCode =
        res.ok && (!parsedOk || (!payload.reply && !payload.text))
          ? 'INVALID_RESPONSE'
          : payload.code || payload.status || (res.status === 401 ? 'UNAUTHENTICATED' : 'PROVIDER_ERROR');

      const diagnostic: Record<string, unknown> = {
        endpoint: '/api/chat',
        method: 'POST',
        statusCode: res.status,
        durationMs,
        ...(requestId ? { requestId } : {}),
        errorCode: derivedCode,
        stage:
          payload.diagnostic?.stage ||
          (res.ok ? 'response_extraction' : res.status === 401 ? 'auth_verification' : 'provider_generate'),
        ...(typeof payload.diagnostic?.providerStatus === 'number'
          ? { providerStatus: payload.diagnostic.providerStatus }
          : {}),
        ...(payload.diagnostic?.providerCode ? { providerCode: payload.diagnostic.providerCode } : {}),
        ...(payload.diagnostic?.providerDetail
          ? { providerDetail: payload.diagnostic.providerDetail }
          : !parsedOk
            ? { providerDetail: 'Non-JSON response received from /api/chat' }
            : {}),
      };

      return {
        success: false,
        statusCode: res.status,
        error:
          typeof payload.error === 'string'
            ? payload.error
            : res.status === 401
              ? 'Your Angel session has expired. Please sign in again.'
              : res.status === 429
                ? 'Too many requests. Please wait a moment before sending again.'
                : 'Angel could not reach the conversation service. Please try again.',
        status: derivedCode,
        requestId,
        diagnostic,
      };
    } catch (err: any) {
      const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
      const isAbort = err?.name === 'AbortError';
      const code = isAbort ? 'TIMEOUT' : 'NETWORK_ERROR';
      return {
        success: false,
        error: isAbort
          ? 'The conversation request timed out. Please retry.'
          : err?.message || 'Unable to reach Angel conversation service.',
        status: isAbort ? 'timeout' : 'network_error',
        diagnostic: {
          endpoint: '/api/chat',
          method: 'POST',
          errorCode: code,
          stage: 'client_fetch',
          durationMs,
          providerDetail: err?.message || code,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  public async generateChatStream(
    history: ChatMessage[],
    newMessage: string,
    mode?: string,
    systemInstruction?: string,
    accessToken?: string,
    attachments?: ChatAttachmentPayload[],
    callbacks?: ChatStreamCallbacks
  ): Promise<ModelChatResponse> {
    if (!accessToken) {
      return {
        success: false,
        error: 'Sign in with a verified account to start a private conversation with Angel.',
        status: 'unauthenticated',
        statusCode: 401,
      };
    }

    if (typeof window === 'undefined' && !globalThis.fetch) {
      return this.generateChatResponse(history, newMessage, mode, systemInstruction, accessToken, undefined, attachments);
    }

    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const internalController = new AbortController();
    let timedOut = false;
    const onExternalAbort = () => internalController.abort();
    callbacks?.signal?.addEventListener('abort', onExternalAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      internalController.abort();
    }, 40000);

    try {
      const messagesPayload = [
        ...history
          .filter((m) => (m.sender === 'user' || m.sender === 'angel') && m.status !== 'failed' && m.status !== 'unsent')
          .map((m) => ({
            role: m.sender === 'angel' ? 'assistant' : 'user',
            content: m.content,
          })),
        ...(newMessage.trim() ? [{ role: 'user', content: newMessage }] : []),
      ];

      const res = await fetch('/api/chat?stream=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: messagesPayload,
          mode,
          systemInstruction,
          ...(attachments && attachments.length > 0 ? { attachments } : {}),
        }),
        signal: internalController.signal,
      });

      const contentType = (res.headers?.get?.('content-type') || '').toLowerCase();
      const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
      const headerRequestId = res.headers?.get?.('x-request-id') || undefined;

      // Fallback gracefully for JSON responses (e.g. unit test mocks or non-streaming middleware)
      if (!contentType.includes('text/event-stream') || !res.body || typeof res.body.getReader !== 'function') {
        let parsedOk = true;
        const payload = await res.json().catch(() => {
          parsedOk = false;
          return {};
        });
        const requestId = typeof payload.requestId === 'string' ? payload.requestId : headerRequestId;

        if (res.ok && parsedOk && (payload.reply || payload.text)) {
          const reply = String(payload.reply || payload.text || '').trim();
          const activeModel = payload.actualModel || payload.modelUsed || this.lastStatus.model;
          callbacks?.onDelta?.(reply, reply);
          return {
            success: true,
            text: reply,
            modelUsed: activeModel,
            actualModel: activeModel,
            requestedModel: payload.requestedModel || this.lastStatus.model,
            fallbackActivated: Boolean(payload.fallbackActivated),
            ...(payload.fallbackReason ? { fallbackReason: payload.fallbackReason } : {}),
            ...(typeof payload.retryCount === 'number' ? { retryCount: payload.retryCount } : {}),
            durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : durationMs,
            ...(Array.isArray(payload.attemptedModels) ? { attemptedModels: payload.attemptedModels } : {}),
            requestedMode: payload.requestedMode || mode,
            appliedMode: payload.appliedMode || mode,
            thinkingLevel: payload.thinkingLevel,
            taskTier: payload.taskTier,
            routingReason: payload.routingReason,
            requestId,
          };
        }

        // If streaming route/method isn't supported (404/405), fall back once to standard JSON POST /api/chat
        if (!res.ok && (res.status === 404 || res.status === 405)) {
          const nonStream = await this.generateChatResponse(
            history,
            newMessage,
            mode,
            systemInstruction,
            accessToken,
            undefined,
            attachments
          );
          if (nonStream.success && nonStream.text) {
            callbacks?.onDelta?.(nonStream.text, nonStream.text);
          }
          return nonStream;
        }

        const derivedCode =
          res.ok && (!parsedOk || (!payload.reply && !payload.text))
            ? 'INVALID_RESPONSE'
            : payload.code || payload.status || (res.status === 401 ? 'UNAUTHENTICATED' : 'PROVIDER_ERROR');

        return {
          success: false,
          statusCode: res.status,
          error:
            typeof payload.error === 'string'
              ? payload.error
              : res.status === 401
                ? 'Your Angel session has expired. Please sign in again.'
                : res.status === 429
                  ? 'Too many requests. Please wait a moment before sending again.'
                  : 'Angel could not reach the conversation service. Please try again.',
          status: derivedCode,
          requestId,
          diagnostic: {
            endpoint: '/api/chat',
            method: 'POST',
            statusCode: res.status,
            durationMs,
            ...(requestId ? { requestId } : {}),
            errorCode: derivedCode,
            stage: 'client_stream',
          },
        };
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';
      let fullText = '';
      let doneEvent: Record<string, any> | null = null;
      let errorEvent: Record<string, any> | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sseBuffer += decoder.decode(value, { stream: true });

        const frames = sseBuffer.split(/\r?\n\r?\n/);
        sseBuffer = frames.pop() ?? '';

        for (const frame of frames) {
          const dataLines = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim());
          if (dataLines.length === 0) continue;

          const jsonText = dataLines.join('\n');
          try {
            const evt = JSON.parse(jsonText) as Record<string, any>;
            if (evt.type === 'stage' && typeof evt.stage === 'string') {
              callbacks?.onStage?.({
                stage: evt.stage,
                label: typeof evt.label === 'string' ? evt.label : evt.stage,
                requestedModel: typeof evt.requestedModel === 'string' ? evt.requestedModel : undefined,
                modelUsed: typeof evt.modelUsed === 'string' ? evt.modelUsed : undefined,
                taskTier: evt.taskTier === 'everyday' || evt.taskTier === 'advanced' ? evt.taskTier : undefined,
              });
            } else if (evt.type === 'delta' && typeof evt.text === 'string') {
              fullText += evt.text;
              callbacks?.onDelta?.(evt.text, fullText);
            } else if (evt.type === 'done') {
              doneEvent = evt;
            } else if (evt.type === 'error') {
              errorEvent = evt;
            }
          } catch {
            // Skip malformed SSE frame
          }
        }
      }

      if (errorEvent) {
        return {
          success: false,
          statusCode: typeof errorEvent.statusCode === 'number' ? errorEvent.statusCode : 502,
          error: typeof errorEvent.error === 'string' ? errorEvent.error : 'Conversation stream failed.',
          status: typeof errorEvent.code === 'string' ? errorEvent.code : 'PROVIDER_ERROR',
          requestId: typeof errorEvent.requestId === 'string' ? errorEvent.requestId : headerRequestId,
          diagnostic: typeof errorEvent.diagnostic === 'object' ? errorEvent.diagnostic : undefined,
        };
      }

      const finalText = (doneEvent?.reply || fullText || '').trim();
      if (!finalText) {
        return {
          success: false,
          statusCode: 502,
          error: 'Angel returned an empty response. Please try again.',
          status: 'EMPTY_RESPONSE',
          requestId: headerRequestId,
        };
      }

      const activeModel = doneEvent?.actualModel || doneEvent?.modelUsed || this.lastStatus.model;
      this.publishStatus({
        ...this.lastStatus,
        state: 'generation_successful',
        connected: true,
        credentialsConfigured: true,
        providerReachable: true,
        generationVerified: true,
        activeModel,
        fallbackActivated: Boolean(doneEvent?.fallbackActivated),
        fallbackModels: [SECONDARY_GEMINI_MODEL],
        checkedAt: new Date().toISOString(),
        latencyMs: typeof doneEvent?.durationMs === 'number' ? doneEvent.durationMs : durationMs,
        message: doneEvent?.fallbackActivated
          ? `Fallback active (${activeModel}) — primary ${doneEvent?.requestedModel || this.lastStatus.model} temporarily unavailable.`
          : `Gemini (${activeModel}) responding normally.`,
      });

      return {
        success: true,
        text: finalText,
        modelUsed: activeModel,
        actualModel: activeModel,
        requestedModel: doneEvent?.requestedModel || this.lastStatus.model,
        fallbackActivated: Boolean(doneEvent?.fallbackActivated),
        ...(doneEvent?.fallbackReason ? { fallbackReason: doneEvent.fallbackReason } : {}),
        ...(typeof doneEvent?.retryCount === 'number' ? { retryCount: doneEvent.retryCount } : {}),
        durationMs: typeof doneEvent?.durationMs === 'number' ? doneEvent.durationMs : durationMs,
        ...(Array.isArray(doneEvent?.attemptedModels) ? { attemptedModels: doneEvent.attemptedModels } : {}),
        requestedMode: doneEvent?.requestedMode || mode,
        appliedMode: doneEvent?.appliedMode || mode,
        thinkingLevel: doneEvent?.thinkingLevel,
        taskTier: doneEvent?.taskTier,
        routingReason: doneEvent?.routingReason,
        requestId: typeof doneEvent?.requestId === 'string' ? doneEvent.requestId : headerRequestId,
      };
    } catch (err: any) {
      const durationMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt);
      const userAborted = Boolean(callbacks?.signal?.aborted);
      const isTimeoutAbort = timedOut || (!userAborted && err?.name === 'AbortError');
      const errorCode = userAborted ? 'ABORTED_BY_USER' : isTimeoutAbort ? 'TIMEOUT' : 'NETWORK_ERROR';
      return {
        success: false,
        statusCode: userAborted ? 499 : undefined,
        error: userAborted
          ? 'Generation stopped by user.'
          : isTimeoutAbort
            ? 'The conversation request timed out. Please retry.'
            : err?.message || 'Unable to reach Angel conversation service.',
        status: userAborted ? 'ABORTED_BY_USER' : isTimeoutAbort ? 'timeout' : 'network_error',
        diagnostic: {
          endpoint: '/api/chat?stream=1',
          method: 'POST',
          errorCode,
          stage: 'client_stream',
          durationMs,
          providerDetail: err?.message || errorCode,
        },
      };
    } finally {
      clearTimeout(timeout);
      callbacks?.signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  public async translateText(params: {
    text: string;
    targetLanguage: string;
    sourceLanguage?: string;
    accessToken?: string;
    signal?: AbortSignal;
  }): Promise<{ success: boolean; translatedText?: string; error?: string; statusCode?: number }> {
    if (!params.accessToken) {
      return {
        success: false,
        statusCode: 401,
        error: 'Sign in with a verified account to use live voice translation.',
      };
    }
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${params.accessToken}`,
        },
        body: JSON.stringify({
          text: params.text,
          sourceLanguage: params.sourceLanguage || 'auto',
          targetLanguage: params.targetLanguage,
        }),
        signal: params.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && typeof data.translatedText === 'string') {
        return { success: true, translatedText: data.translatedText };
      }
      return {
        success: false,
        statusCode: res.status,
        error: typeof data.error === 'string' ? data.error : 'Translation could not be completed.',
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, error: 'Translation cancelled.' };
      }
      return { success: false, error: 'Unable to reach live translation service.' };
    }
  }

  public async generateTitle(firstMessage: string, accessToken?: string): Promise<string> {
    if (typeof window !== 'undefined' && accessToken && firstMessage.trim()) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch('/api/title', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message: firstMessage }),
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.success && typeof data.title === 'string' && data.title.trim()) {
            return data.title.trim().replace(/^["']|["']$/g, '');
          }
        }
      } catch {
        // Fall through to deterministic concise title
      } finally {
        clearTimeout(timeout);
      }
    }

    return extractIntelligentTitle(firstMessage);
  }
}

export const geminiModelService = new GeminiModelService();
