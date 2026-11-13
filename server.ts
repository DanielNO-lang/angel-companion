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

  // Chat generation endpoint
  app.post('/api/chat', async (req, res) => {
    const { messages, mode, systemInstruction } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY not found in environment. External model provider is pending.',
        status: 'integration_pending',
      });
    }

    try {
      const isThink = mode === 'Think';
      const config: any = {
        systemInstruction:
          systemInstruction ||
          'You are Angel, a universal personal AI companion and intelligent workspace partner. You communicate naturally, concisely, and substantively. You remember conversation history, understand references such as "that", "it", and "the previous one", and respond directly without canned formulas or repetitive intros.',
      };

      if (isThink) {
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
      }

      const contents = (messages || []).map((m: any) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config,
      });

      res.json({
        success: true,
        text: response.text,
        modelUsed: 'gemini-3.8-flash',
        thinkingLevel: isThink ? 'HIGH' : 'DEFAULT',
      });
    } catch (err: any) {
      console.error('[GeminiServer] Model generation error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Gemini model generation failed',
      });
    }
  });

  // Title generation endpoint
  app.post('/api/title', async (req, res) => {
    const { message } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Generate a concise 2 to 4 word title capturing the topic of this user message: "${message}". Reply ONLY with the title text and no punctuation, quotes, or markdown.`,
      });
      res.json({ success: true, title: response.text?.trim() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message });
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
