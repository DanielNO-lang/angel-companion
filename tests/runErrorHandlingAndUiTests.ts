import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearSanitizedDiagnostics,
  containsTechnicalLeak,
  FRIENDLY_ERROR_MESSAGES,
  getSanitizedDiagnosticsForDev,
  logSanitizedDiagnostic,
  redactDiagnosticData,
  scrubSensitiveText,
  toFriendlyError,
} from '../src/services/errorHandlingService';
import {
  getAuthFlowOrigin,
  isSensitiveOrCallbackUrl,
  popSafeReturnRoute,
  pushSafeRoute,
  resetRecoveryNavigationForTests,
  restoreSafeWorkflowDraft,
  saveSafeWorkflowDraft,
  setAuthFlowOrigin,
} from '../src/services/recoveryNavigationService';

test('toFriendlyError maps technical failures to calm user-safe messages with zero technical leaks', () => {
  clearSanitizedDiagnostics();

  const cases: Array<{ raw: unknown; context: Parameters<typeof toFriendlyError>[1]; expectedCategory: string }> = [
    { raw: '400 Bad Request', context: 'general', expectedCategory: 'unknown_failure' },
    { raw: '401 Unauthorized: jwt expired', context: 'session', expectedCategory: 'invalid_session' },
    { raw: '403 access_denied', context: 'google_oauth', expectedCategory: 'oauth_rejected' },
    { raw: '429 Too Many Requests', context: 'ai', expectedCategory: 'api_rate_limit' },
    { raw: '500 Internal Server Error', context: 'general', expectedCategory: 'server_failure' },
    { raw: '502 Bad Gateway', context: 'ai', expectedCategory: 'ai_unavailable' },
    { raw: 'invalid_client: OAuth client secret invalid', context: 'google_oauth', expectedCategory: 'missing_config' },
    { raw: 'otp_expired', context: 'auth', expectedCategory: 'expired_callback' },
    { raw: 'redirect_uri_mismatch', context: 'google_oauth', expectedCategory: 'redirect_mismatch' },
    { raw: new TypeError('Cannot read properties of undefined'), context: 'render', expectedCategory: 'render_exception' },
    { raw: 'Failed to exchange authorization code', context: 'google_oauth', expectedCategory: 'expired_callback' },
    { raw: 'Missing VITE_SUPABASE_URL and GEMINI_API_KEY', context: 'auth', expectedCategory: 'missing_config' },
    { raw: 'Failed to fetch (network timeout)', context: 'network', expectedCategory: 'network_timeout' },
    { raw: 'Image load failed: naturalWidth === 0', context: 'media', expectedCategory: 'media_failure' },
  ];

  for (const c of cases) {
    const res = toFriendlyError(c.raw, c.context, { logDiagnostic: true });
    assert.equal(res.category, c.expectedCategory, `Expected ${c.expectedCategory} for "${String(c.raw)}"`);
    assert.equal(
      containsTechnicalLeak(res.userMessage),
      false,
      `User message leaked technical details for "${String(c.raw)}": ${res.userMessage}`
    );
    assert.ok(res.userMessage.length > 10);
  }

  assert.equal(
    toFriendlyError('403 access_denied', 'google_oauth', { logDiagnostic: false }).userMessage,
    FRIENDLY_ERROR_MESSAGES.GOOGLE_OAUTH
  );
  assert.equal(
    toFriendlyError('500 Internal Server Error', 'general', { logDiagnostic: false }).userMessage,
    FRIENDLY_ERROR_MESSAGES.GENERAL
  );
  assert.ok(getSanitizedDiagnosticsForDev().length > 0);
});

test('scrubSensitiveText and redactDiagnosticData strip secrets, tokens, codes, and paths', () => {
  const scrubbed = scrubSensitiveText(
    'Bearer supersecrettoken123 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.sig ?code=abc123&access_token=tok999 at /app/applet/src/services/authService.ts:44:12'
  );
  assert.equal(scrubbed.includes('supersecrettoken123'), false);
  assert.equal(scrubbed.includes('eyJhbGciOi'), false);
  assert.equal(scrubbed.includes('abc123'), false);
  assert.equal(scrubbed.includes('tok999'), false);
  assert.equal(scrubbed.includes('src/services/authService.ts'), false);

  const redacted = redactDiagnosticData({
    password: 'my-secret-password',
    code: 'oauth-auth-code',
    access_token: 'acc-123',
    refresh_token: 'ref-456',
    apikey: 'sb_secret_key',
    client_secret: 'google-client-secret',
    provider: 'google',
    safeCount: 3,
  });

  assert.equal(redacted.password, '[REDACTED]');
  assert.equal(redacted.code, '[REDACTED]');
  assert.equal(redacted.access_token, '[REDACTED]');
  assert.equal(redacted.refresh_token, '[REDACTED]');
  assert.equal(redacted.apikey, '[REDACTED]');
  assert.equal(redacted.client_secret, '[REDACTED]');
  assert.equal(redacted.provider, 'google');
  assert.equal(redacted.safeCount, 3);

  const diag = logSanitizedDiagnostic({
    category: 'oauth_rejected',
    context: 'google_oauth',
    rawError: 'Failed with access_token=secret123',
    metadata: { client_secret: 'shhh', step: 'callback' },
  });
  assert.equal(diag.summary.includes('secret123'), false);
  assert.equal(diag.metadata?.client_secret, '[REDACTED]');
  assert.equal(diag.metadata?.step, 'callback');
});

test('recoveryNavigationService prevents callback/error loops and preserves safe origin routes & drafts', () => {
  resetRecoveryNavigationForTests();

  assert.equal(isSensitiveOrCallbackUrl('/auth/callback'), true);
  assert.equal(isSensitiveOrCallbackUrl('/auth/callback?error=access_denied'), true);
  assert.equal(isSensitiveOrCallbackUrl('/signin?code=12345'), true);
  assert.equal(isSensitiveOrCallbackUrl('/signin'), false);
  assert.equal(isSensitiveOrCallbackUrl('/'), false);

  pushSafeRoute('landing');
  pushSafeRoute('signin');
  pushSafeRoute('auth-callback'); // blocked from safe stack

  assert.equal(popSafeReturnRoute('signin', 'landing'), 'landing');
  assert.equal(popSafeReturnRoute('landing', 'signin'), 'signin');

  setAuthFlowOrigin('signup');
  assert.equal(getAuthFlowOrigin(), 'signup');

  saveSafeWorkflowDraft({ authEmail: 'user@example.com' });
  assert.equal(restoreSafeWorkflowDraft()?.authEmail, 'user@example.com');
});

test('UI & structural requirements: single-row header, footer links, auto previews, canonical trefoil, no dead stubs, ErrorBoundary', () => {
  const landingNav = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/LandingNav.tsx'), 'utf8');
  assert.ok(landingNav.includes('data-nav-strip="true"'));
  assert.equal(landingNav.includes('data-mobile-nav-strip'), false, 'LandingNav must use a single horizontal row without a stacked mobile bottom strip');
  for (const label of ['Home', 'Capabilities', 'Experience', 'About Angel', 'Privacy']) {
    assert.ok(landingNav.includes(label), `LandingNav missing ${label}`);
  }
  assert.ok(landingNav.includes('sticky top-0'));

  const footer = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/PrivacyClosingFooter.tsx'), 'utf8');
  assert.ok(footer.includes('>Privacy<') || footer.includes('Privacy'));
  assert.ok(footer.includes('Terms &amp; Conditions') || footer.includes('Terms & Conditions'));
  assert.equal(footer.includes('Core Capabilities'), false, 'Footer must not duplicate Core Capabilities link');
  assert.equal(footer.includes("onScrollToSection('about')"), false, 'Footer must not duplicate About Angel link');
  assert.equal(footer.includes("onScrollToSection('experience')"), false, 'Footer must not duplicate Experience link');

  const capabilities = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/CapabilitiesShowcase.tsx'), 'utf8');
  assert.equal(capabilities.includes('Auto-rotating'), false, 'CapabilitiesShowcase must not have manual Auto-rotating/Paused button');
  assert.equal(capabilities.includes('cap-tab-'), false, 'CapabilitiesShowcase option boxes must be removed');
  assert.ok(capabilities.includes('Previous slide') && capabilities.includes('Next slide'), 'CapabilitiesShowcase must include manual Previous/Next slide controls');

  const authLayout = fs.readFileSync(path.resolve(process.cwd(), 'src/components/auth/AuthLayout.tsx'), 'utf8');
  assert.equal(authLayout.includes('Angel Companion Environment'), false, 'AuthLayout must remove Angel Companion Environment pill badge');
  assert.ok(authLayout.includes('lg:sticky'), 'AuthLayout desktop identity panel must remain sticky while scrolling');
  assert.ok(authLayout.includes('ml-auto'), 'AuthLayout compact mobile logo must sit on the right');

  const appTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(appTsx.includes('AngelEmblem3D') && appTsx.includes('Loading...'), 'App loading screen must show centered rotating 3D Angel logo above Loading...');

  const cosmic = fs.readFileSync(path.resolve(process.cwd(), 'src/components/background/CosmicEnvironment.tsx'), 'utf8');
  assert.ok(cosmic.includes('WebGLRenderer') && cosmic.includes('axialAngle') && cosmic.includes('buildEquirectangularPlanetCanvas'));
  assert.equal(cosmic.includes('gl.finish'), false, 'CosmicEnvironment must not block frames with gl.finish()');

  const mobileShowcase = fs.readFileSync(path.resolve(process.cwd(), 'src/components/landing/MobileProductShowcase.tsx'), 'utf8');
  assert.equal(mobileShowcase.includes('Previous mobile view'), false, 'MobileProductShowcase must not have manual prev arrow button');
  assert.equal(mobileShowcase.includes('Next mobile view'), false, 'MobileProductShowcase must not have manual next arrow button');
  assert.equal(mobileShowcase.includes('Pause mobile carousel'), false, 'MobileProductShowcase must not have manual pause toggle button');

  const emblem = fs.readFileSync(path.resolve(process.cwd(), 'src/components/branding/AngelEmblem.tsx'), 'utf8');
  assert.ok(emblem.includes('Math.sin(tau) + 2 * Math.sin(2 * tau)'), 'AngelEmblem must compute canonical TrefoilCurve geometry');
  assert.ok(emblem.includes('Math.cos(tau) - 2 * Math.cos(2 * tau)'), 'AngelEmblem must compute canonical TrefoilCurve geometry');

  const quickAccess = fs.readFileSync(path.resolve(process.cwd(), 'src/components/home/QuickAccessPanel.tsx'), 'utf8');
  assert.equal(quickAccess.includes("'analytics'"), false);
  assert.equal(quickAccess.includes("'create'"), false);

  const morePopup = fs.readFileSync(path.resolve(process.cwd(), 'src/components/layout/MoreNavigationPopup.tsx'), 'utf8');
  for (const deadId of ['apps', 'devices', 'schedules', 'locked-chats', 'archive', 'recycle-bin']) {
    assert.equal(morePopup.includes(`'${deadId}'`), false, `MoreNavigationPopup still contains dead stub ${deadId}`);
  }

  const mainTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf8');
  assert.ok(mainTsx.includes('ErrorBoundary'), 'Root main.tsx must wrap App in ErrorBoundary');

  // Ensure no UI component exposes internal env var names
  const componentsDir = path.resolve(process.cwd(), 'src/components');
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
  for (const file of walk(componentsDir)) {
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(/VITE_SUPABASE_|GEMINI_API_KEY|SUPABASE_SERVICE_ROLE/.test(content), false, `UI component exposes env var name: ${file}`);
  }
});
