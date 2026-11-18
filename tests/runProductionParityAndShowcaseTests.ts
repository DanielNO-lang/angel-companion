import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getSupabaseClient,
  getSupabaseConfigState,
  probeSupabaseAuthSettings,
  resetSupabaseClientCacheForTests,
} from '../src/services/supabaseClient';
import {
  getAuthProviderStatuses,
  getVisibleAuthProviders,
} from '../src/services/authProviderRegistry';
import {
  authService,
  buildOAuthSignInOptions,
  classifySupabaseAuthError,
} from '../src/services/authService';
import { getLogoMotionProfile } from '../src/utils/logoMotion';
import {
  getCircularCardOffset,
  getFanSlot,
  nextCardIndex,
  prevCardIndex,
  resolveHorizontalSwipeDirection,
  shouldAutoAdvanceCarousel,
} from '../src/utils/mobileCardFan';
import { evaluateDevicePerformanceTier } from '../src/utils/devicePerformance';
import { deriveWebpPath } from '../src/components/ui/SmartImage';

function withSupabaseEnv<T>(
  envPatch: Record<string, string | undefined>,
  fn: () => T | Promise<T>
): Promise<T> {
  const keys = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ENABLED_PROVIDERS',
  ];
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    if (k in envPatch) {
      if (envPatch[k] === undefined) delete process.env[k];
      else process.env[k] = envPatch[k];
    }
  }
  resetSupabaseClientCacheForTests();

  const restore = () => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
    resetSupabaseClientCacheForTests();
  };

  return Promise.resolve()
    .then(fn)
    .finally(restore);
}

test('supabaseClient distinguishes missing URL/key, placeholders, invalid URL, legacy anon key, publishable key, and cache invalidation', async () => {
  await withSupabaseEnv(
    {
      VITE_SUPABASE_URL: undefined,
      VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
      VITE_SUPABASE_ANON_KEY: undefined,
    },
    () => {
      const bothMissing = getSupabaseConfigState();
      assert.equal(bothMissing.isConfigured, false);
      assert.equal(bothMissing.diagnosticCode, 'url_and_key_missing');
      assert.equal(getSupabaseClient(), null);
    }
  );

  await withSupabaseEnv(
    {
      VITE_SUPABASE_URL: undefined,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_valid_key',
      VITE_SUPABASE_ANON_KEY: undefined,
    },
    () => {
      const urlMissing = getSupabaseConfigState();
      assert.equal(urlMissing.isConfigured, false);
      assert.equal(urlMissing.diagnosticCode, 'url_missing');
      assert.equal(urlMissing.keySource, 'VITE_SUPABASE_PUBLISHABLE_KEY');
    }
  );

  await withSupabaseEnv(
    {
      VITE_SUPABASE_URL: 'https://qltiogotxbxwzwmnypwu.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
      VITE_SUPABASE_ANON_KEY: undefined,
    },
    () => {
      const keyMissing = getSupabaseConfigState();
      assert.equal(keyMissing.isConfigured, false);
      assert.equal(keyMissing.diagnosticCode, 'key_missing');
    }
  );

  await withSupabaseEnv(
    {
      VITE_SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_your_public_key_here',
      VITE_SUPABASE_ANON_KEY: undefined,
    },
    () => {
      const placeholder = getSupabaseConfigState();
      assert.equal(placeholder.isConfigured, false);
      assert.equal(placeholder.diagnosticCode, 'url_and_key_missing');
    }
  );

  await withSupabaseEnv(
    {
      VITE_SUPABASE_URL: 'ftp://invalid-scheme.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_valid_key',
      VITE_SUPABASE_ANON_KEY: undefined,
    },
    () => {
      const invalidUrl = getSupabaseConfigState();
      assert.equal(invalidUrl.isConfigured, false);
      assert.equal(invalidUrl.diagnosticCode, 'invalid_url');
      assert.equal(getSupabaseClient(), null);
    }
  );

  await withSupabaseEnv(
    {
      VITE_SUPABASE_URL: 'https://projalpha.supabase.co/',
      VITE_SUPABASE_PUBLISHABLE_KEY: undefined,
      VITE_SUPABASE_ANON_KEY: 'ey_legacy_anon_key_1',
    },
    () => {
      const legacy = getSupabaseConfigState();
      assert.equal(legacy.isConfigured, true);
      assert.equal(legacy.diagnosticCode, 'configured');
      assert.equal(legacy.keySource, 'VITE_SUPABASE_ANON_KEY');
      assert.equal(legacy.supabaseUrl, 'https://projalpha.supabase.co');
      const clientA = getSupabaseClient();
      assert.ok(clientA);

      // Updating key invalidates cached client cleanly
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_new_key_2';
      const preferred = getSupabaseConfigState();
      assert.equal(preferred.keySource, 'VITE_SUPABASE_PUBLISHABLE_KEY');
      const clientB = getSupabaseClient();
      assert.ok(clientB);
      assert.notEqual(clientA, clientB);
    }
  );
});

test('probeSupabaseAuthSettings reports reachable providers, auth_rejected HTTP 401/403, and network unreachable honestly', async () => {
  await withSupabaseEnv(
    {
      VITE_SUPABASE_URL: 'https://projprobe.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_probe',
      VITE_SUPABASE_ANON_KEY: undefined,
    },
    async () => {
      const reachable = await probeSupabaseAuthSettings(async (url, init) => {
        assert.equal(String(url), 'https://projprobe.supabase.co/auth/v1/settings');
        assert.equal((init?.headers as Record<string, string>)?.apikey, 'sb_publishable_probe');
        return new Response(
          JSON.stringify({
            external: { email: true, google: true, github: false, apple: false, azure: false },
            disable_signup: false,
            mailer_autoconfirm: false,
          }),
          { status: 200 }
        );
      });
      assert.equal(reachable.diagnosticCode, 'reachable');
      assert.equal(reachable.reachable, true);
      assert.equal(reachable.externalProviders.google, true);
      assert.equal(reachable.externalProviders.github, false);

      const rejected = await probeSupabaseAuthSettings(async () => {
        return new Response(JSON.stringify({ error: 'Invalid API key' }), { status: 401 });
      });
      assert.equal(rejected.diagnosticCode, 'auth_rejected');
      assert.equal(rejected.reachable, false);
      assert.equal(rejected.statusCode, 401);

      const unreachable = await probeSupabaseAuthSettings(async () => {
        throw new Error('Failed to fetch');
      });
      assert.equal(unreachable.diagnosticCode, 'unreachable');
      assert.equal(unreachable.reachable, false);
    }
  );
});

test('authProviderRegistry honors live Supabase /auth/v1/settings toggles and classifySupabaseAuthError categorizes failures accurately', () => {
  const disabledGoogle = getAuthProviderStatuses(null, true, {
    google: false,
    github: true,
    apple: false,
    azure: false,
  });
  const googleDisabledStatus = disabledGoogle.find((p) => p.id === 'google');
  const githubEnabledStatus = disabledGoogle.find((p) => p.id === 'github');
  assert.equal(googleDisabledStatus?.isReady, false);
  assert.equal(googleDisabledStatus?.readinessReason, 'provider_disabled_in_supabase');
  assert.equal(githubEnabledStatus?.isReady, true);
  assert.equal(githubEnabledStatus?.readinessReason, 'verified_enabled');

  const visibleWithLiveToggle = getVisibleAuthProviders(null, true, { google: true, github: false });
  assert.equal(visibleWithLiveToggle.find((p) => p.id === 'google')?.isReady, true);
  assert.equal(visibleWithLiveToggle.find((p) => p.id === 'github')?.isReady, false);

  assert.equal(
    classifySupabaseAuthError('Unsupported provider: provider is not enabled', 'Google').category,
    'provider_disabled'
  );
  assert.equal(
    classifySupabaseAuthError('OAuth invalid_client or bad redirect_uri mismatch', 'Google').category,
    'oauth_incomplete'
  );
  assert.equal(
    classifySupabaseAuthError('Failed to fetch from endpoint', 'Google').category,
    'network_unreachable'
  );
  assert.equal(
    classifySupabaseAuthError('Invalid login credentials').category,
    'invalid_credentials'
  );
});

test('logoMotion produces deterministic, varied circular orbital and 3D rotation profiles per seed', () => {
  const a1 = getLogoMotionProfile('landing-hero', 20);
  const a2 = getLogoMotionProfile('landing-hero', 20);
  const nav = getLogoMotionProfile('landing-nav', 14);
  const sidebar = getLogoMotionProfile('dashboard-sidebar', 14);
  const hero = getLogoMotionProfile('dashboard-hero', 14);

  assert.deepEqual(a1, a2);
  assert.ok(a1.orbitRadiusPx >= 2.2 && a1.orbitRadiusPx <= 5);
  assert.ok(a1.orbitDurationSec >= 5.2 && a1.orbitDurationSec <= 9);
  assert.ok(a1.spinDurationSec > 0);
  assert.ok(a1.direction === 1 || a1.direction === -1);

  // Different seeds yield distinct orbital timing/radius/phase values
  const signatures = new Set([
    `${a1.spinDurationSec}-${a1.orbitDurationSec}-${a1.phaseDelaySec}`,
    `${nav.spinDurationSec}-${nav.orbitDurationSec}-${nav.phaseDelaySec}`,
    `${sidebar.spinDurationSec}-${sidebar.orbitDurationSec}-${sidebar.phaseDelaySec}`,
    `${hero.spinDurationSec}-${hero.orbitDurationSec}-${hero.phaseDelaySec}`,
  ]);
  assert.equal(signatures.size, 4);
});

test('mobileCardFan cycles cleanly 1->2->3->1 in both directions, assigns fan slots, and resolves horizontal swipes', () => {
  // Full forward cycle of 3 cards without stopping on card 2
  let idx = 0;
  idx = nextCardIndex(idx, 3);
  assert.equal(idx, 1);
  idx = nextCardIndex(idx, 3);
  assert.equal(idx, 2);
  idx = nextCardIndex(idx, 3);
  assert.equal(idx, 0);

  // Full reverse cycle
  idx = prevCardIndex(0, 3);
  assert.equal(idx, 2);
  idx = prevCardIndex(idx, 3);
  assert.equal(idx, 1);
  idx = prevCardIndex(idx, 3);
  assert.equal(idx, 0);

  // Playing-card fan slot layout for activeIndex = 1
  assert.equal(getFanSlot(0, 1, 3), 'left');
  assert.equal(getFanSlot(1, 1, 3), 'center');
  assert.equal(getFanSlot(2, 1, 3), 'right');

  // Swipe threshold & vertical scroll protection
  assert.equal(resolveHorizontalSwipeDirection(-58, 12, 40), 'next');
  assert.equal(resolveHorizontalSwipeDirection(64, -10, 40), 'prev');
  assert.equal(resolveHorizontalSwipeDirection(-20, 2, 40), null);
  assert.equal(resolveHorizontalSwipeDirection(-45, 75, 40), null);
});

test('SmartImage deriveWebpPath resolves pre-generated showcase .webp assets and workflow/env configs are valid', () => {
  assert.equal(deriveWebpPath('/assets/showcase/mobile-home.png'), '/assets/showcase/mobile-home.webp');
  assert.equal(deriveWebpPath('/assets/showcase/home.png'), '/assets/showcase/home.webp');
  assert.equal(deriveWebpPath('/assets/other/logo.png'), null);

  // Confirm every showcase PNG in public/assets/showcase has a matching .webp asset on disk
  const showcaseDir = path.resolve(process.cwd(), 'public/assets/showcase');
  const pngFiles = fs.readdirSync(showcaseDir).filter((f) => f.endsWith('.png'));
  assert.ok(pngFiles.length >= 9);
  for (const png of pngFiles) {
    const webp = png.replace(/\.png$/, '.webp');
    assert.equal(fs.existsSync(path.join(showcaseDir, webp)), true, `Missing WebP for ${png}`);
  }

  // Confirm .env.local.example has placeholders only and workflow injects VITE_SUPABASE_*
  const envLocalExample = fs.readFileSync(path.resolve(process.cwd(), '.env.local.example'), 'utf8');
  assert.ok(envLocalExample.includes('VITE_SUPABASE_URL='));
  assert.ok(envLocalExample.includes('VITE_SUPABASE_PUBLISHABLE_KEY='));
  assert.equal(envLocalExample.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.'), false);

  const workflow = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/production.yml'), 'utf8');
  assert.ok(workflow.includes('VITE_SUPABASE_URL'));
  assert.ok(workflow.includes('VITE_SUPABASE_PUBLISHABLE_KEY'));
});

test('buildOAuthSignInOptions applies prompt=select_account ONLY to Google and processAuthCallbackWithClient deduplicates PKCE exchanges and verifies session state', async () => {
  const googleOpts = buildOAuthSignInOptions('google', 'https://angel.example.com/auth/callback', 'email profile');
  assert.deepEqual(googleOpts.queryParams, { prompt: 'select_account' });
  assert.equal(googleOpts.redirectTo, 'https://angel.example.com/auth/callback');
  assert.equal(googleOpts.scopes, 'email profile');

  for (const other of ['azure', 'apple', 'github'] as const) {
    const opts = buildOAuthSignInOptions(other, 'https://angel.example.com/auth/callback');
    assert.equal(opts.queryParams, undefined, `${other} must not receive Google prompt=select_account`);
  }

  // PKCE code dedupe + strict restoreSessionFn verification
  authService.resetCallbackDedupeForTests();
  let exchangeCalls = 0;
  let signedOutOnBadRestore = false;

  const mockSession = { access_token: 'tok', refresh_token: 'ref' } as never;
  const mockUser = { id: 'usr_1', email: 'user@example.com' } as never;

  const client = {
    auth: {
      exchangeCodeForSession: async () => {
        exchangeCalls += 1;
        return { data: { session: mockSession, user: mockUser }, error: null };
      },
      verifyOtp: async () => ({ data: {}, error: null }),
      setSession: async () => ({ error: null }),
      signOut: async () => {
        signedOutOnBadRestore = true;
      },
    },
  };

  // Duplicate parallel invocation of same PKCE code invokes exchangeCodeForSession ONLY ONCE
  const [ok1, ok2] = await Promise.all([
    authService.processAuthCallbackWithClient(client, '?code=pkce_once_123', '', async () => ({
      status: 'authenticated',
      user: {
        id: 'usr_1',
        email: 'user@example.com',
        fullName: 'Angel User',
        initials: 'AU',
        emailVerified: true,
        providers: ['google'],
      },
      session: mockSession,
      identities: [],
      error: null,
    })),
    authService.processAuthCallbackWithClient(client, '?code=pkce_once_123', '', async () => ({
      status: 'authenticated',
      user: null,
      session: null,
      identities: [],
      error: null,
    })),
  ]);
  assert.equal(exchangeCalls, 1);
  assert.equal(ok1.outcome, 'authenticated');
  assert.equal(ok2.outcome, 'authenticated');

  // New code where restoreSessionFn fails (e.g. unauthenticated) MUST NOT report authenticated!
  authService.resetCallbackDedupeForTests();
  const failOutcome = await authService.processAuthCallbackWithClient(
    client,
    '?code=pkce_unverified_456',
    '',
    async () => ({
      status: 'unauthenticated',
      user: null,
      session: null,
      identities: [],
      error: 'JWT validation failed',
    })
  );
  assert.equal(failOutcome.outcome, 'error');
  assert.equal(signedOutOnBadRestore, true);
  assert.match(failOutcome.message, /JWT validation failed/i);
});

test('evaluateDevicePerformanceTier classifies high, mid, low, software GL, and reduced-motion capability tiers cleanly', () => {
  const high = evaluateDevicePerformanceTier({
    prefersReducedMotion: false,
    webglSupported: true,
    rendererString: 'ANGLE (Apple, Apple M2, OpenGL 4.1)',
    hardwareConcurrency: 8,
    deviceMemoryGb: 16,
    viewportWidth: 1440,
  });
  assert.equal(high.tier, 'high');
  assert.equal(high.useWebGlForPrimaryEmblems, true);
  assert.equal(high.maxDpr, 2);

  const mid = evaluateDevicePerformanceTier({
    prefersReducedMotion: false,
    webglSupported: true,
    rendererString: 'ANGLE (Intel, Intel Iris Xe)',
    hardwareConcurrency: 4,
    deviceMemoryGb: 4,
    viewportWidth: 390,
  });
  assert.equal(mid.tier, 'mid');
  assert.equal(mid.maxDpr, 1.5);
  assert.ok(mid.starCount < high.starCount);

  const softwareGl = evaluateDevicePerformanceTier({
    prefersReducedMotion: false,
    webglSupported: true,
    rendererString: 'Google SwiftShader Subzero',
    hardwareConcurrency: 8,
    deviceMemoryGb: 8,
    viewportWidth: 1440,
  });
  assert.equal(softwareGl.tier, 'low');
  assert.equal(softwareGl.isSoftwareRenderer, true);
  assert.equal(softwareGl.maxDpr, 1);

  const reduced = evaluateDevicePerformanceTier({
    prefersReducedMotion: true,
    webglSupported: true,
    rendererString: 'NVIDIA RTX 4080',
    hardwareConcurrency: 16,
    deviceMemoryGb: 32,
    viewportWidth: 1440,
  });
  assert.equal(reduced.tier, 'low');
  assert.equal(reduced.targetFps, 0);
  assert.equal(reduced.useWebGlForPrimaryEmblems, false);
});

test('six-device mobile showcase deck cycles through all 6 screens, assigns symmetric fan slots, and respects auto-advance pauses', () => {
  let idx = 0;
  const visited = [idx];
  for (let step = 0; step < 6; step++) {
    idx = nextCardIndex(idx, 6);
    visited.push(idx);
  }
  assert.deepEqual(visited, [0, 1, 2, 3, 4, 5, 0]);
  assert.equal(prevCardIndex(0, 6), 5);

  // For activeIndex = 2 out of 6: 1 is left (-1), 2 is center (0), 3 is right (+1), others hidden
  assert.equal(getCircularCardOffset(1, 2, 6), -1);
  assert.equal(getFanSlot(1, 2, 6), 'left');
  assert.equal(getFanSlot(2, 2, 6), 'center');
  assert.equal(getFanSlot(3, 2, 6), 'right');
  assert.ok(getFanSlot(5, 2, 6).startsWith('hidden-'));

  const baseState = {
    isInViewport: true,
    isDocumentHidden: false,
    isDragging: false,
    isPausedByHoverOrFocus: false,
    prefersReducedMotion: false,
    nowMs: 10000,
    pauseUntilMs: 5000,
  };
  assert.equal(shouldAutoAdvanceCarousel(baseState), true);
  assert.equal(shouldAutoAdvanceCarousel({ ...baseState, isInViewport: false }), false);
  assert.equal(shouldAutoAdvanceCarousel({ ...baseState, isDocumentHidden: true }), false);
  assert.equal(shouldAutoAdvanceCarousel({ ...baseState, isDragging: true }), false);
  assert.equal(shouldAutoAdvanceCarousel({ ...baseState, prefersReducedMotion: true }), false);
});

test('landing and auth structure satisfies sticky header, CTA cleanup, 6 brandless phone chassis, and removed auth orb/rings invariants', () => {
  const heroSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/LandingHero.tsx'), 'utf8');
  assert.equal(/Enter Angel/i.test(heroSource), false, 'Enter Angel Environment CTA must be removed');
  assert.match(heroSource, /Explore Angel/);
  assert.match(heroSource, /Get Started/);

  const navSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/LandingNav.tsx'), 'utf8');
  for (const label of ['Home', 'Capabilities', 'Experience', 'About Angel', 'Privacy']) {
    assert.ok(navSource.includes(label), `Missing nav category: ${label}`);
  }
  assert.ok(navSource.includes('sticky top-0'));

  const landingPageSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/LandingPage.tsx'), 'utf8');
  assert.ok(landingPageSource.includes('overflow-x-clip'));
  assert.equal(landingPageSource.includes('overflow-x-hidden'), false);

  const mobileSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/MobileProductShowcase.tsx'), 'utf8');
  assert.ok(mobileSource.includes('Built for mobile from the inside out!'));
  for (const chassis of ['capsule-island', 'razor-pinhole', 'horizon-visor', 'arch-teardrop', 'chamfer-slate', 'sculpted-glass']) {
    assert.ok(mobileSource.includes(`'${chassis}'`), `Missing phone chassis ${chassis}`);
  }
  for (const forbiddenBrand of ['Apple', 'iPhone', 'Samsung', 'Galaxy', 'Pixel']) {
    assert.equal(new RegExp(`\\b${forbiddenBrand}\\b`, 'i').test(mobileSource), false, `Found forbidden phone brand ${forbiddenBrand}`);
  }

  const authLayoutSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/auth/AuthLayout.tsx'), 'utf8');
  assert.equal(authLayoutSource.includes('AngelCompanion3D'), false, 'AuthLayout must not render AngelCompanion3D orb');
  assert.equal(authLayoutSource.includes('animate-spin-slow'), false, 'AuthLayout must not render spinning orbital rings');
});

test('Cosmic and cloudy environments use DOM/CSS layers instead of full-screen canvas render loops', () => {
  const cosmic = fs.readFileSync(path.join(process.cwd(), 'src/components/background/CosmicEnvironment.tsx'), 'utf8');
  const cloudy = fs.readFileSync(path.join(process.cwd(), 'src/components/background/CloudySkyEnvironment.tsx'), 'utf8');
  const environmentCss = fs.readFileSync(path.join(process.cwd(), 'src/components/background/environment.css'), 'utf8');

  assert.equal(cosmic.includes('<canvas'), false);
  assert.equal(cosmic.includes('requestAnimationFrame'), false);
  assert.equal(cloudy.includes('<canvas'), false);
  assert.equal(cloudy.includes('requestAnimationFrame'), false);
  assert.ok(environmentCss.includes('.angel-cosmic-environment'));
  assert.ok(environmentCss.includes('.angel-cloudy-environment'));
  assert.ok(environmentCss.includes('@keyframes angel-cloud-drift'));
});

test('All automatic Angel emblem instances use the lightweight rotating 3D trefoil', () => {
  const emblem3d = fs.readFileSync(path.join(process.cwd(), 'src/components/branding/AngelEmblem3D.tsx'), 'utf8');
  const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
  const reducedMotionBlock = indexCss.slice(indexCss.indexOf('@media (prefers-reduced-motion: reduce)'));

  assert.ok(emblem3d.includes("const useCompactSvg = renderMode !== '3d' || !perfProfile.webglSupported;"));
  assert.equal(reducedMotionBlock.includes('.angel-emblem-orbit'), false);
  assert.equal(reducedMotionBlock.includes('.angel-emblem-spin'), false);
});
