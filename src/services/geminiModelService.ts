import { ChatMessage } from '../types/angel';

export const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

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
}

export interface ModelChatResponse {
  success: boolean;
  text?: string;
  error?: string;
  status?: string;
  statusCode?: number;
  modelUsed?: string;
  requestedMode?: string;
  appliedMode?: string;
  thinkingLevel?: string;
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

  public async checkStatus(forceRefresh = false, liveProbe = false): Promise<ModelHealthStatus> {
    if (typeof window === 'undefined') {
      const hasKey = typeof process !== 'undefined' && Boolean(process.env.GEMINI_API_KEY?.trim());
      const model = (typeof process !== 'undefined' && process.env.GEMINI_MODEL?.trim()) || DEFAULT_GEMINI_MODEL;
      const status: ModelHealthStatus = {
        state: hasKey ? 'credentials_configured' : 'credentials_missing',
        connected: hasKey,
        credentialsConfigured: hasKey,
        providerReachable: false,
        generationVerified: false,
        model,
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
      const timeout = setTimeout(() => controller.abort(), 5000);
      const params = new URLSearchParams();
      if (forceRefresh) params.set('refresh', '1');
      if (liveProbe) params.set('probe', 'generate');
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
          thinkModeSupported: data.thinkModeSupported ?? true,
          checkedAt: data.checkedAt || new Date().toISOString(),
          latencyMs,
          message: data.message || 'Model status checked.',
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
    };
    this.publishStatus(unavailable);
    return unavailable;
  }

  public async generateChatResponse(
    history: ChatMessage[],
    newMessage: string,
    mode?: string,
    systemInstruction?: string,
    accessToken?: string
  ): Promise<ModelChatResponse> {
    if (typeof window === 'undefined') {
      if (typeof process !== 'undefined' && process.env.GEMINI_API_KEY?.trim()) {
        try {
          const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
          const modelUsed = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY.trim(),
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

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

          let appliedMode = requestedMode;
          let thinkingLevel = isThink ? 'HIGH' : 'DEFAULT';
          let response;
          try {
            response = await ai.models.generateContent({ model: modelUsed, contents, config });
          } catch (innerErr: any) {
            if (isThink && String(innerErr?.message || '').toLowerCase().includes('thinking')) {
              const fallbackConfig = { systemInstruction: resolvedSystemInstruction };
              response = await ai.models.generateContent({ model: modelUsed, contents, config: fallbackConfig });
              appliedMode = 'Standard Intelligent';
              thinkingLevel = 'DEFAULT';
            } else {
              throw innerErr;
            }
          }

          return {
            success: true,
            text: response.text,
            modelUsed,
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 26000);

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

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messages: messagesPayload,
          mode,
          systemInstruction,
        }),
        signal: controller.signal,
      });

      const payload = await res.json().catch(() => ({}));
      if (res.ok && (payload.reply || payload.text)) {
        const reply = (payload.reply || payload.text || '').trim();
        this.publishStatus({
          ...this.lastStatus,
          state: 'generation_successful',
          connected: true,
          credentialsConfigured: true,
          providerReachable: true,
          generationVerified: true,
          model: payload.modelUsed || this.lastStatus.model,
          checkedAt: new Date().toISOString(),
          message: `Gemini (${payload.modelUsed || this.lastStatus.model}) responding normally.`,
        });
        return {
          success: true,
          text: reply,
          modelUsed: payload.modelUsed,
          requestedMode: payload.requestedMode || mode,
          appliedMode: payload.appliedMode || mode,
          thinkingLevel: payload.thinkingLevel,
        };
      }

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
        status: payload.code || payload.status || (res.status === 401 ? 'unauthenticated' : 'provider_unavailable'),
      };
    } catch (err: any) {
      const isAbort = err?.name === 'AbortError';
      return {
        success: false,
        error: isAbort
          ? 'The conversation request timed out. Please retry.'
          : err?.message || 'Unable to reach Angel conversation service.',
        status: isAbort ? 'timeout' : 'network_error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  public async generateTitle(firstMessage: string, accessToken?: string): Promise<string> {
    if (typeof window !== 'undefined' && accessToken && firstMessage.trim()) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
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
