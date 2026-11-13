import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function resolvePort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--port=')) {
      const parsed = parseInt(args[i].split('=')[1], 10);
      if (!Number.isNaN(parsed)) return parsed;
    } else if (args[i] === '--port' && args[i + 1]) {
      const parsed = parseInt(args[i + 1], 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  if (process.env.NODE_ENV === 'production' && process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (process.env.DEFAULT_APP_PORT) {
    const parsed = parseInt(process.env.DEFAULT_APP_PORT, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 3000;
}

async function startServer() {
  const app = express();
  const PORT = resolvePort();

  app.use(express.json({ limit: '25mb' }));

  // Helper to initialize GoogleGenAI client on the server
  function getGeminiClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  async function verifySupabaseAccessToken(req: express.Request): Promise<boolean> {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    if (!token || !supabaseUrl || !supabaseKey) return false;
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: supabaseKey, authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Model status
  app.get('/api/model/status', (req, res) => {
    const hasKey = Boolean(process.env.GEMINI_API_KEY);
    res.json({
      connected: hasKey,
      model: 'gemini-3.8-flash',
      thinkModeSupported: true,
      message: hasKey
        ? 'Gemini 3.8 Flash model connected with Think mode support.'
        : 'GEMINI_API_KEY not configured in environment. Integration boundary is ready.',
    });
  });

  // Chat generation endpoint. Every request must carry a verified Supabase access token.
  app.post('/api/chat', async (req, res) => {
    if (!(await verifySupabaseAccessToken(req))) {
      return res.status(401).json({ success: false, error: 'Please sign in to continue.' });
    }

    const { messages, mode, systemInstruction } = req.body || {};
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured in the server environment.',
        status: 'integration_pending',
      });
    }

    const safeMessages = Array.isArray(messages) ? messages : [];
    if (!safeMessages.length || safeMessages.length > 40) {
      return res.status(400).json({ success: false, error: 'Send between 1 and 40 messages.' });
    }
    if (safeMessages.some((m: any) =>
      !m ||
      !['user', 'assistant'].includes(m.role) ||
      typeof m.content !== 'string' ||
      !m.content.trim() ||
      m.content.length > 12000
    )) {
      return res.status(400).json({ success: false, error: 'One or more messages are invalid or too long.' });
    }

    try {
      const isThink = mode === 'Think';
      const config: any = {
        systemInstruction:
          typeof systemInstruction === 'string'
            ? systemInstruction.slice(0, 8000)
            : 'You are Angel, a thoughtful, natural, capable Universal Personal AI Companion. Respond directly and honestly.',
      };
      if (isThink) config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };

      const contents = safeMessages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        contents,
        config,
      });
      const reply = response.text?.trim();
      if (!reply) return res.status(502).json({ success: false, error: 'Angel could not produce a response.' });

      return res.json({
        success: true,
        reply,
        text: reply,
        modelUsed: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        thinkingLevel: isThink ? 'HIGH' : 'DEFAULT',
      });
    } catch (err: any) {
      console.error('[GeminiServer] Authenticated model generation error:', err);
      return res.status(502).json({
        success: false,
        error: 'Angel could not reach the conversation model. Please try again.',
      });
    }
  });

  // Title generation endpoint is also authenticated. The browser may use a local title fallback.
  app.post('/api/title', async (req, res) => {
    if (!(await verifySupabaseAccessToken(req))) {
      return res.status(401).json({ success: false, error: 'Please sign in to continue.' });
    }

    const { message } = req.body || {};
    if (typeof message !== 'string' || !message.trim() || message.length > 12000) {
      return res.status(400).json({ success: false, error: 'A valid message is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY is not configured.' });
    }

    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        contents: `Generate a concise 2 to 4 word title for this message. Reply only with the title: ${message}`,
      });
      return res.json({ success: true, title: response.text?.trim() });
    } catch (err: any) {
      console.error('[GeminiServer] Title generation error:', err);
      return res.status(502).json({ success: false, error: 'Angel could not generate a title.' });
    }
  });

  // Mount Vite middlewares in dev mode, or serve dist in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AngelServer] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ServerStartError]', err);
});
