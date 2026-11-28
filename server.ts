import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
  handleChatRequest,
  handleChatStreamRequest,
  handleModelStatusRequest,
  handleTitleRequest,
  handleTranslateRequest,
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

  app.use(express.json({ limit: '8mb' }));

  app.get('/api/model/status', async (req, res) => {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const liveProbe =
      req.query.probe === 'generate' ? true : req.query.probe === 'none' ? false : undefined;
    const includeTiers = req.query.tiers === '1' || req.query.tiers === 'true';
    const result = await handleModelStatusRequest({
      method: req.method,
      forceRefresh,
      liveProbe,
      includeTiers,
    });
    if (result.headers) {
      Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
    }
    res.setHeader('cache-control', 'no-store');
    res.status(result.statusCode).json(result.body);
  });

  app.post('/api/chat', async (req, res) => {
    const wantsStream =
      req.headers.accept?.includes('text/event-stream') || req.query.stream === '1';

    if (wantsStream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const abortController = new AbortController();
      req.on('close', () => {
        if (!res.writableEnded) {
          abortController.abort();
        }
      });

      await handleChatStreamRequest(
        {
          method: req.method,
          authorizationHeader: req.headers.authorization || '',
          body: req.body,
          signal: abortController.signal,
        },
        (event) => {
          if (!res.writableEnded && !abortController.signal.aborted) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        }
      );

      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

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

  app.post('/api/translate', async (req, res) => {
    const result = await handleTranslateRequest({
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

  app.get('/manifest.webmanifest', (_req, res) => {
    const distManifest = path.resolve(process.cwd(), 'dist', 'manifest.webmanifest');
    const publicManifest = path.resolve(process.cwd(), 'public', 'manifest.webmanifest');
    const manifestPath =
      process.env.NODE_ENV === 'production' && fs.existsSync(distManifest)
        ? distManifest
        : publicManifest;
    res.setHeader('content-type', 'application/manifest+json; charset=utf-8');
    res.setHeader('cache-control', 'public, max-age=0, must-revalidate');
    res.sendFile(manifestPath);
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : true,
        ws: { server: httpServer },
        watch: hmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[AngelServer] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[ServerStartError]', err);
});
