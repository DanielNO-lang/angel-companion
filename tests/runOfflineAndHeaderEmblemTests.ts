import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildConversationCacheSnapshot,
  clearRecentConversationsCache,
  CONVERSATION_SW_CACHE_NAME,
  loadRecentConversationsFromCache,
  mergeConversationSnapshots,
  pruneThreadsForLocalCache,
  readSnapshotFromCacheStorage,
  saveRecentConversationsToCache,
  writeSnapshotToCacheStorage,
  type CachedConversationThread,
} from '../src/services/conversationCache';
import { ConversationEngine } from '../src/services/conversationEngine';

function createMemoryStorage(options?: { failFirstSet?: boolean }) {
  const map = new Map<string, string>();
  let failedOnce = false;
  return {
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      if (options?.failFirstSet && !failedOnce) {
        failedOnce = true;
        throw new Error('QuotaExceededError');
      }
      map.set(key, value);
    },
    removeItem(key: string): void {
      map.delete(key);
    },
  };
}

function createMockCacheStorage() {
  const stores = new Map<string, Map<string, Response>>();
  return {
    async open(cacheName: string) {
      if (!stores.has(cacheName)) {
        stores.set(cacheName, new Map<string, Response>());
      }
      const bucket = stores.get(cacheName)!;
      return {
        async put(request: RequestInfo | URL, response: Response) {
          bucket.set(String(request), response.clone());
        },
        async match(request: RequestInfo | URL) {
          const hit = bucket.get(String(request));
          return hit ? hit.clone() : undefined;
        },
      } as unknown as Cache;
    },
  } as unknown as CacheStorage;
}

function makeThread(
  id: string,
  title: string,
  updatedAt: string,
  messageCount = 2,
  scope: 'general' | 'studio' = 'general'
): CachedConversationThread {
  return {
    id,
    title,
    scope,
    studioId: scope === 'studio' ? 'research-studio' : undefined,
    createdAt: '2026-11-19T10:00:00.000Z',
    updatedAt,
    isArchived: false,
    messages: Array.from({ length: messageCount }, (_, idx) => ({
      id: `${id}_msg_${idx}`,
      sender: idx % 2 === 0 ? 'user' : 'angel',
      content: `Offline cached turn ${idx + 1} for ${title}`,
      timestamp: '10:00 AM',
      status: 'completed' as const,
    })),
  };
}

test('pruneThreadsForLocalCache deduplicates, drops demo seeds, and keeps newest bounded history', () => {
  const raw: CachedConversationThread[] = [
    makeThread('conv_general_1', 'Legacy Demo Seed', '2026-11-20T09:00:00.000Z', 4),
    makeThread('t_old', 'Older Thread', '2026-11-18T12:00:00.000Z', 3),
    makeThread('t_new', 'Newer Version', '2026-11-20T12:00:00.000Z', 25),
    makeThread('t_new', 'Stale Duplicate', '2026-11-19T08:00:00.000Z', 2),
  ];

  const pruned = pruneThreadsForLocalCache(raw, 2, 10);
  assert.equal(pruned.length, 2);
  assert.equal(pruned[0].id, 't_new');
  assert.equal(pruned[0].title, 'Newer Version');
  assert.equal(pruned[0].messages.length, 10);
  assert.equal(pruned[1].id, 't_old');
});

test('mergeConversationSnapshots combines primary and cached messages without losing offline turns', () => {
  const cached = [
    makeThread('thread_alpha', 'Project Horizon', '2026-11-20T10:00:00.000Z', 2),
    makeThread('thread_cached_only', 'Cached Only Offline Thread', '2026-11-19T15:00:00.000Z', 3),
  ];
  const primary: CachedConversationThread[] = [
    {
      ...makeThread('thread_alpha', 'Project Horizon Updated', '2026-11-20T11:00:00.000Z', 2),
      messages: [
        ...makeThread('thread_alpha', 'Project Horizon Updated', '2026-11-20T11:00:00.000Z', 2).messages,
        {
          id: 'thread_alpha_msg_offline_extra',
          sender: 'user',
          content: 'Turn added while offline',
          timestamp: '11:00 AM',
          status: 'completed',
        },
      ],
    },
  ];

  const merged = mergeConversationSnapshots(primary, cached);
  assert.equal(merged.length, 2);
  const alpha = merged.find((t) => t.id === 'thread_alpha');
  assert.ok(alpha);
  assert.equal(alpha.title, 'Project Horizon Updated');
  assert.equal(alpha.messages.length, 3);
  assert.ok(merged.some((t) => t.id === 'thread_cached_only'));
});

test('saveRecentConversationsToCache persists snapshot, handles QuotaExceededError fallback, and clears cleanly', () => {
  const threads = Array.from({ length: 20 }, (_, idx) =>
    makeThread(`t_${idx}`, `Thread ${idx}`, `2026-11-20T${String(idx).padStart(2, '0')}:00:00.000Z`, 5)
  );
  const storageWithQuotaHit = createMemoryStorage({ failFirstSet: true });

  const saved = saveRecentConversationsToCache('user_123', threads, true, storageWithQuotaHit);
  assert.equal(saved.threadCount, 15, 'Should compact to 15 threads when initial setItem throws QuotaExceededError');
  assert.equal(saved.pendingCloudSync, true);

  const loaded = loadRecentConversationsFromCache('user_123', storageWithQuotaHit);
  assert.ok(loaded);
  assert.equal(loaded.threads.length, 15);
  assert.equal(loaded.pendingCloudSync, true);

  clearRecentConversationsCache('user_123', storageWithQuotaHit);
  assert.equal(loadRecentConversationsFromCache('user_123', storageWithQuotaHit), null);
});

test('writeSnapshotToCacheStorage and readSnapshotFromCacheStorage mirror conversation history in Service Worker Cache API', async () => {
  const mockCaches = createMockCacheStorage();
  const snapshot = buildConversationCacheSnapshot(
    'user_sw_1',
    [makeThread('sw_thread_1', 'Offline Architecture Notes', '2026-11-20T14:00:00.000Z', 4)],
    false
  );

  const wrote = await writeSnapshotToCacheStorage(snapshot, mockCaches);
  assert.equal(wrote, true);
  assert.equal(CONVERSATION_SW_CACHE_NAME, 'angel-conversation-history-v1');

  const restored = await readSnapshotFromCacheStorage('user_sw_1', mockCaches);
  assert.ok(restored);
  assert.equal(restored.threadCount, 1);
  assert.equal(restored.threads[0].title, 'Offline Architecture Notes');
  assert.equal(restored.threads[0].messages.length, 4);
});

test('ConversationEngine getRecentThreads prioritizes non-empty threads and reports offline cache status', async () => {
  const engine = new ConversationEngine();
  const emptyThread = engine.createThread('general', undefined, 'Empty Draft');
  const richThread = engine.createThread('general', undefined, 'Cached Strategy Chat');
  await engine.addMessage(richThread.id, 'Summarize the rollout checklist', 'user');

  const recent = engine.getRecentThreads(5);
  assert.equal(recent[0].id, richThread.id);
  assert.ok(recent.some((t) => t.id === emptyThread.id));

  const status = engine.getOfflineCacheStatus();
  assert.ok(status.threadCount >= 2);
  assert.ok(status.messageCount >= 1);
  assert.ok(typeof status.cachedAt === 'string' || status.cachedAt === null);
});

test('All page headers use the exact same 3D rotating triquetra animation and asset as the center hero element', () => {
  const root = process.cwd();
  const landingNav = fs.readFileSync(path.join(root, 'src/components/landing/LandingNav.tsx'), 'utf8');
  const dashHeader = fs.readFileSync(path.join(root, 'src/components/layout/Header.tsx'), 'utf8');
  const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8');
  const authLayout = fs.readFileSync(path.join(root, 'src/components/auth/AuthLayout.tsx'), 'utf8');
  const incognito = fs.readFileSync(path.join(root, 'src/components/pages/IncognitoChatPage.tsx'), 'utf8');
  const footer = fs.readFileSync(path.join(root, 'src/components/landing/PrivacyClosingFooter.tsx'), 'utf8');

  for (const [label, source] of [
    ['LandingNav', landingNav],
    ['Header', dashHeader],
    ['Sidebar', sidebar],
    ['AuthLayout', authLayout],
    ['IncognitoChatPage', incognito],
    ['PrivacyClosingFooter', footer],
  ] as const) {
    assert.ok(
      source.includes('AngelEmblem3D'),
      `${label} must render canonical AngelEmblem3D component`
    );
    assert.ok(
      source.includes('renderMode="3d"'),
      `${label} header emblem must force renderMode="3d" so it uses the hero 3D WebGL triquetra instead of compact SVG fallback`
    );
    assert.ok(
      source.includes('rotationSpeed={18}'),
      `${label} header emblem must match hero rotationSpeed={18}`
    );
  }

  assert.equal(
    authLayout.includes('renderMode="svg"'),
    false,
    'AuthLayout must not downgrade its desktop form header logo to flat SVG'
  );
});

test('Sidebar Recent Conversations subscribes to live/cached conversationEngine threads and PWA/offline scaffolding is wired', () => {
  const root = process.cwd();
  const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  const mainTsx = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
  const viteConfig = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');

  assert.ok(sidebar.includes('conversationEngine.getRecentThreads'));
  assert.equal(sidebar.includes("'personal-assistant'"), false);
  assert.ok(app.includes('<OfflineIndicator'));
  assert.ok(mainTsx.includes('registerAngelServiceWorker'));
  assert.ok(viteConfig.includes('VitePWA'));
  assert.ok(viteConfig.includes("handler: 'NetworkOnly'"));
  assert.equal(viteConfig.includes('angel-supabase-threads-cache'), false);
  assert.ok(viteConfig.includes('navigateFallbackAllowlist'));
  assert.ok(viteConfig.includes('maximumFileSizeToCacheInBytes'));
  assert.ok(fs.existsSync(path.join(root, 'public/pwa-192x192.png')));
  assert.ok(fs.existsSync(path.join(root, 'public/pwa-512x512.png')));
  assert.ok(fs.existsSync(path.join(root, 'public/pwa-maskable-512x512.png')));
  assert.ok(fs.existsSync(path.join(root, 'public/apple-touch-icon.png')));
});

test('Manifest JSON, Vite React dedupe, Netlify headers, and static NewConversationPage import prevent production hook/manifest/ws regressions', () => {
  const root = process.cwd();
  const manifestPath = path.join(root, 'public/manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'public/manifest.webmanifest must exist on disk');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    start_url?: string;
    display?: string;
    icons?: Array<{ src: string }>;
  };
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);

  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('href="/manifest.webmanifest"'));
  assert.ok(indexHtml.includes('crossorigin="use-credentials"'));

  const viteConfig = fs.readFileSync(path.join(root, 'vite.config.ts'), 'utf8');
  assert.ok(viteConfig.includes("dedupe: ['react', 'react-dom'"));
  assert.ok(viteConfig.includes('optimizeDeps:'));
  assert.ok(viteConfig.includes('manifest\\.webmanifest'));
  assert.ok(viteConfig.includes('navigateFallbackDenylist'));

  const netlifyToml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  assert.ok(netlifyToml.includes('/manifest.webmanifest'));
  assert.ok(netlifyToml.includes('application/manifest+json'));

  const serverTs = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
  assert.ok(serverTs.includes("app.get('/manifest.webmanifest'"));
  assert.ok(serverTs.includes('ws: { server: httpServer }'));

  const appTsx = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  assert.ok(appTsx.includes("import { NewConversationPage } from './components/pages/NewConversationPage'"));
  assert.equal(appTsx.includes("import('./components/pages/NewConversationPage')"), false);
});

