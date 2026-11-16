import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
  handleChatRequest,
  handleModelStatusRequest,
  handleTitleRequest,
} from './server/geminiBackend';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: false });
}
dotenv.config({ override: false });

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

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/model/status', async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const liveProbe = req.query.probe === 'generate' ? true : req.query.probe !== 'none';
    const result = await handleModelStatusRequest({
      method: req.method,
      forceRefresh,
      liveProbe,
    });
    res.setHeader('cache-control', 'no-store');
    res.status(result.statusCode).json(result.body);
  });

  app.post('/api/chat', async (req, res) => {
    const result = await handleChatRequest({
      method: req.method,
      authorizationHeader: req.headers.authorization || '',
      body: req.body,
    });
    if (result.headers) {
      Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
    }
    res.setHeader('cache-control', 'no-store');
    res.status(result.statusCode).json(result.body);
  });

  app.post('/api/title', async (req, res) => {
    const result = await handleTitleRequest({
      method: req.method,
      authorizationHeader: req.headers.authorization || '',
      body: req.body,
    });
    if (result.headers) {
      Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
    }
    res.setHeader('cache-control', 'no-store');
    res.status(result.statusCode).json(result.body);
  });

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
