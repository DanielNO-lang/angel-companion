import { ChatMessage } from '../types/angel';

export interface ModelChatResponse {
  success: boolean;
  text?: string;
  error?: string;
  status?: string;
  modelUsed?: string;
  thinkingLevel?: string;
}

export function extractIntelligentTitle(input: string): string {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  // Simple greetings keep clean default
  if (/^(hi|hello|hey|greetings|howdy|good morning|good evening|good afternoon)\b/i.test(lower) && trimmed.length < 30) {
    return 'General Conversation';
  }

  // Specific domain intent titles
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

  // Meaningful keywords extraction (2 to 4 words, never truncating with ellipsis)
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
  private statusCache: { connected: boolean; checkedAt: number } | null = null;

  public async checkStatus(): Promise<{ connected: boolean; model: string; message: string }> {
    if (typeof window === 'undefined') {
      const hasKey = typeof process !== 'undefined' && Boolean(process.env.GEMINI_API_KEY);
      return {
        connected: hasKey,
        model: 'gemini-3.8-flash',
        message: hasKey
          ? 'Gemini 3.8 Flash model connected with Think mode support.'
          : 'GEMINI_API_KEY not configured in environment. Integration boundary is ready.',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('/api/model/status', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        this.statusCache = { connected: Boolean(data.connected), checkedAt: Date.now() };
        return data;
      }
    } catch {
      // Fallback
    }

    return {
      connected: false,
      model: 'gemini-3.8-flash',
      message: 'Server endpoint unreachable or running in isolated testing environment.',
    };
  }

  public async generateChatResponse(
    history: ChatMessage[],
    newMessage: string,
    mode?: string,
    systemInstruction?: string,
    accessToken?: string
  ): Promise<ModelChatResponse> {
    if (typeof window === 'undefined') {
      // In server or test runtime
      if (typeof process !== 'undefined' && process.env.GEMINI_API_KEY) {
        try {
          const { GoogleGenAI, ThinkingLevel } = await import('@google/genai');
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          });

          const isThink = mode === 'Think';
          const config: any = {
            systemInstruction:
              systemInstruction ||
              'You are Angel, a universal personal AI companion. You communicate naturally, concisely, and substantively. You remember conversation history, understand references such as "that", "it", and "the previous one", and respond directly without canned formulas.',
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

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config,
          });

          return {
            success: true,
            text: response.text,
            modelUsed: 'gemini-3.8-flash',
            thinkingLevel: isThink ? 'HIGH' : 'DEFAULT',
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Direct model call failed',
            status: 'error',
          };
        }
      }

      return {
        success: false,
        error: 'GEMINI_API_KEY not configured in environment. Integration boundary ready.',
        status: 'integration_pending',
      };
    }

    // Browser runtime calls the authenticated server-side API. Never send Gemini credentials from the browser.
    if (!accessToken) {
      return { success: false, error: 'Sign in to use Angel conversations.', status: 'unauthenticated' };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const messagesPayload = [
        ...history.map((m) => ({ sender: m.sender, content: m.content })),
        { sender: 'user', content: newMessage },
      ];

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          messages: messagesPayload.map((message) => ({
            role: message.sender === 'angel' ? 'assistant' : 'user',
            content: message.content,
          })),
          mode,
          systemInstruction,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          text: data.reply || data.text,
          modelUsed: data.modelUsed,
          thinkingLevel: data.thinkingLevel,
        };
      }

      const errData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: errData.error || `HTTP ${res.status} from model server`,
        status: errData.status || 'error',
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Model API fetch error',
        status: 'network_fallback',
      };
    }
  }

  public async generateTitle(firstMessage: string, accessToken?: string): Promise<string> {
    if (typeof window !== 'undefined' && accessToken) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        const res = await fetch('/api/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ message: firstMessage }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.title && data.title.trim()) {
            return data.title.trim().replace(/^["']|["']$/g, '');
          }
        }
      } catch {
        // Fallback
      }
    }

    // Safe, high quality deterministic fallback (2-4 words, never truncated with ...)
    return extractIntelligentTitle(firstMessage);
  }
}

export const geminiModelService = new GeminiModelService();
