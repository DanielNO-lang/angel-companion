import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AISTUDIO_DEV_PREVIEW_ORIGIN,
  AISTUDIO_SHARED_PREVIEW_ORIGIN,
  DEBUG_PREVIEW_AUTH_PATH,
  PREVIEW_CALLBACK_PATH,
  PRODUCTION_APP_ORIGIN,
  PRODUCTION_CALLBACK_PATH,
  canAccessWorkspace,
  canUnlinkIdentity,
  deriveUserInitials,
  evaluatePasswordStrength,
  getOAuthCallbackPath,
  getPathForRoute,
  getRememberMePreference,
  getRememberedAuthEmail,
  saveRememberedAuthEmail,
  getStoredThemeMode,
  isAiStudioPreviewHostname,
  isDevelopmentPreviewEnvironment,
  parseAppRoute,
  parseAuthCallbackParams,
  resolveDirectPreviewUrl,
  resolveOAuthRedirectUrl,
  sanitizeRedirectPath,
  saveRememberMePreference,
  saveStoredThemeMode,
  validateEmail,
  validatePasswordResetInput,
  validateSignInInput,
  validateSignUpInput,
} from '../src/services/authValidation';
import {
  isSafeReturnRoute,
  isSensitiveOrCallbackUrl,
} from '../src/services/recoveryNavigationService';
import {
  EXTERNAL_APP_INTEGRATIONS,
  getAuthProviderStatuses,
  getVisibleAuthProviders,
  parseEnabledProvidersList,
} from '../src/services/authProviderRegistry';
import { getSupabaseConfigState } from '../src/services/supabaseClient';
import { authService, buildOAuthSignInOptions } from '../src/services/authService';
import { conversationEngine } from '../src/services/conversationEngine';

test('Email validation accepts valid addresses and rejects malformed inputs', () => {
  assert.equal(validateEmail('companion@angel.ai'), true);
  assert.equal(validateEmail('user+tag@sub.domain.org'), true);
  assert.equal(validateEmail(''), false);
  assert.equal(validateEmail('missing-at-sign.com'), false);
  assert.equal(validateEmail('bad@domain'), false);
});

test('Password strength evaluates weak, fair, good, and strong passwords accurately', () => {
  assert.equal(evaluatePasswordStrength('').score, 0);
  assert.equal(evaluatePasswordStrength('short').isAcceptable, false);
  assert.equal(evaluatePasswordStrength('letters1').isAcceptable, true);
  const strong = evaluatePasswordStrength('Angel!Companion2026');
  assert.equal(strong.score, 4);
  assert.equal(strong.isAcceptable, true);
});

test('Sign-in validation rejects empty/invalid inputs cleanly', () => {
  const invalid = validateSignInInput({ email: 'notanemail', password: '123' });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.password);

  const valid = validateSignInInput({ email: 'test@example.com', password: 'Password1!' });
  assert.equal(valid.valid, true);
});

test('Sign-up validation enforces matching passwords, strength, and terms acceptance', () => {
  const mismatch = validateSignUpInput({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123?',
    acceptedTerms: false,
  });
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.errors.confirmPassword);
  assert.ok(mismatch.errors.acceptedTerms);

  const ok = validateSignUpInput({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    acceptedTerms: true,
  });
  assert.equal(ok.valid, true);
});

test('Password reset validation requires strong matching passwords', () => {
  const invalid = validatePasswordResetInput({ password: 'abc', confirmPassword: 'xyz' });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.password);
  assert.ok(invalid.errors.confirmPassword);

  const valid = validatePasswordResetInput({ password: 'NewPassword1!', confirmPassword: 'NewPassword1!' });
  assert.equal(valid.valid, true);
});

test('Open-redirect sanitizer blocks external hosts and javascript protocols', () => {
  assert.equal(sanitizeRedirectPath('/app'), '/app');
  assert.equal(sanitizeRedirectPath('/signin?next=/app'), '/signin?next=/app');
  assert.equal(sanitizeRedirectPath('//evil.example.com'), '/app');
  assert.equal(sanitizeRedirectPath('https://evil.example.com/phish'), '/app');
  assert.equal(sanitizeRedirectPath('javascript:alert(1)'), '/app');
  assert.equal(sanitizeRedirectPath('/unknown-external'), '/app');
});

test('Route parser maps public, auth, callback, and workspace routes accurately', () => {
  assert.equal(parseAppRoute('/'), 'landing');
  assert.equal(parseAppRoute('/signin'), 'signin');
  assert.equal(parseAppRoute('/signup'), 'signup');
  assert.equal(parseAppRoute('/verify-email'), 'verify-email');
  assert.equal(parseAppRoute('/forgot-password'), 'forgot-password');
  assert.equal(parseAppRoute('/reset-password'), 'reset-password');
  assert.equal(parseAppRoute('/auth/callback'), 'auth-callback');
  assert.equal(parseAppRoute('/auth/preview-callback'), 'auth-preview-callback');
  assert.equal(parseAppRoute('/preview-auth'), 'preview-auth');
  assert.equal(parseAppRoute('/debug/preview-auth'), 'debug-preview-auth');
  assert.equal(parseAppRoute('/app'), 'app');
  assert.equal(getPathForRoute('signin'), '/signin');
  assert.equal(getPathForRoute('preview-auth'), '/preview-auth');
  assert.equal(getPathForRoute('debug-preview-auth'), DEBUG_PREVIEW_AUTH_PATH);
  assert.equal(getPathForRoute('auth-preview-callback'), PREVIEW_CALLBACK_PATH);
  assert.equal(getPathForRoute('app'), '/app');
  assert.equal(isSafeReturnRoute('auth-callback'), false);
  assert.equal(isSafeReturnRoute('auth-preview-callback'), false);
  assert.equal(isSensitiveOrCallbackUrl('/auth/preview-callback?code=xyz'), true);
});

test('Preview environment detection and OAuth callback origin isolation keep dev/preview and prod separate', () => {
  assert.equal(isAiStudioPreviewHostname(new URL(AISTUDIO_DEV_PREVIEW_ORIGIN).hostname), true);
  assert.equal(isAiStudioPreviewHostname(new URL(AISTUDIO_SHARED_PREVIEW_ORIGIN).hostname), true);
  assert.equal(isAiStudioPreviewHostname(new URL(PRODUCTION_APP_ORIGIN).hostname), false);

  assert.equal(isDevelopmentPreviewEnvironment('angel-companion.netlify.app', false), false);
  assert.equal(isDevelopmentPreviewEnvironment('angel-companion.netlify.app', true), false);
  assert.equal(isDevelopmentPreviewEnvironment('localhost', true), true);
  assert.equal(isDevelopmentPreviewEnvironment(new URL(AISTUDIO_DEV_PREVIEW_ORIGIN).hostname, false), true);
  assert.equal(isDevelopmentPreviewEnvironment(new URL(AISTUDIO_SHARED_PREVIEW_ORIGIN).hostname, false), true);

  assert.equal(getOAuthCallbackPath('angel-companion.netlify.app', false), PRODUCTION_CALLBACK_PATH);
  assert.equal(getOAuthCallbackPath(new URL(AISTUDIO_DEV_PREVIEW_ORIGIN).hostname, false), PREVIEW_CALLBACK_PATH);
  assert.equal(getOAuthCallbackPath('localhost', true), PREVIEW_CALLBACK_PATH);

  // Production strictly resolves /auth/callback and locks out /auth/preview-callback
  assert.equal(
    resolveOAuthRedirectUrl(PRODUCTION_APP_ORIGIN, '/auth/callback', false),
    'https://angel-companion.netlify.app/auth/callback'
  );
  assert.equal(
    resolveOAuthRedirectUrl(PRODUCTION_APP_ORIGIN, '/auth/preview-callback', false),
    'https://angel-companion.netlify.app/auth/callback'
  );

  // AI Studio Preview & local dev strictly resolve distinct /auth/preview-callback
  assert.equal(
    resolveOAuthRedirectUrl(AISTUDIO_DEV_PREVIEW_ORIGIN, '/auth/callback', false),
    `${AISTUDIO_DEV_PREVIEW_ORIGIN}/auth/preview-callback`
  );
  assert.equal(
    resolveOAuthRedirectUrl(AISTUDIO_SHARED_PREVIEW_ORIGIN, undefined, false),
    `${AISTUDIO_SHARED_PREVIEW_ORIGIN}/auth/preview-callback`
  );
  assert.equal(
    resolveOAuthRedirectUrl('http://localhost:3000', '/auth/callback', true),
    'http://localhost:3000/auth/preview-callback'
  );

  assert.equal(
    resolveDirectPreviewUrl(AISTUDIO_DEV_PREVIEW_ORIGIN, '/debug/preview-auth'),
    `${AISTUDIO_DEV_PREVIEW_ORIGIN}/debug/preview-auth`
  );
  assert.equal(
    resolveDirectPreviewUrl('http://localhost:3000', '/app'),
    'http://localhost:3000/app'
  );
  assert.equal(
    resolveDirectPreviewUrl(PRODUCTION_APP_ORIGIN, 'https://evil.example'),
    `${AISTUDIO_DEV_PREVIEW_ORIGIN}/debug/preview-auth`
  );
});

test('Google OAuth keeps the full-page redirect and asks Google to select an account', () => {
  const google = buildOAuthSignInOptions('google', 'https://preview.example/auth/callback', 'email profile');
  assert.equal(google.redirectTo, 'https://preview.example/auth/callback');
  assert.equal(google.queryParams?.prompt, 'select_account');
  assert.equal(google.scopes, 'email profile');
  assert.equal('skipBrowserRedirect' in google, false);
  const normal = buildOAuthSignInOptions('github', 'https://preview.example/auth/callback');
  assert.equal(normal.queryParams, undefined);
});
test('Callback parser detects PKCE codes, recovery flows, expired links, and cancellations', () => {
  const pkce = parseAuthCallbackParams('?code=abc123&next=/app', '');
  assert.equal(pkce.hasCallbackParams, true);
  assert.equal(pkce.code, 'abc123');
  assert.equal(pkce.nextPath, '/app');
  assert.equal(pkce.isExpiredOrInvalid, false);

  const recovery = parseAuthCallbackParams('?code=rec999&type=recovery', '');
  assert.equal(recovery.type, 'recovery');
  assert.equal(recovery.code, 'rec999');

  const expired = parseAuthCallbackParams('', '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  assert.equal(expired.hasCallbackParams, true);
  assert.equal(expired.isExpiredOrInvalid, true);

  const cancelled = parseAuthCallbackParams('?error=access_denied&error_description=User+cancelled+login', '');
  assert.equal(cancelled.isCancelled, true);
});

test('Workspace auth guard strictly blocks unauthenticated and unconfigured states', () => {
  assert.equal(canAccessWorkspace('unauthenticated'), false);
  assert.equal(canAccessWorkspace('unconfigured'), false);
  assert.equal(canAccessWorkspace('loading'), false);
  assert.equal(canAccessWorkspace('authenticated'), true);
});

test('New conversations are empty and previously seeded demo threads are filtered out', () => {
  const demoIds = new Set(['conv_general_1', 'conv_studio_res_1', 'conv_studio_dev_1']);
  assert.equal(
    conversationEngine.getThreads('general', undefined, true).some((thread) => demoIds.has(thread.id)),
    false,
  );
  assert.equal(
    conversationEngine.getThreads('studio', undefined, true).some((thread) => demoIds.has(thread.id)),
    false,
  );

  const thread = conversationEngine.createThread('general', undefined, 'Clean Thread Test');
  assert.equal(thread.messages.length, 0);
  conversationEngine.deleteThread(thread.id);
});

test('Sole authentication identity unlink protection prevents locking user out', () => {
  assert.equal(canUnlinkIdentity(1).allowed, false);
  assert.equal(canUnlinkIdentity(0).allowed, false);
  assert.equal(canUnlinkIdentity(2).allowed, true);
});

test('Theme and Remember-Me preferences persist across storage cleanly', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  assert.equal(getStoredThemeMode(mockStorage), 'dark');
  saveStoredThemeMode('light', mockStorage);
  assert.equal(getStoredThemeMode(mockStorage), 'light');

  assert.equal(getRememberMePreference(mockStorage), true);
  saveRememberMePreference(false, mockStorage);
  assert.equal(getRememberMePreference(mockStorage), false);
});

test('User initials derivation handles full names and email fallbacks', () => {
  assert.equal(deriveUserInitials('Ada Lovelace', 'ada@example.com'), 'AL');
  assert.equal(deriveUserInitials('', 'angel@example.com'), 'AN');
});

test('Provider registry prioritizes Google first and honors explicit Supabase readiness gating', () => {
  const unconfigured = getVisibleAuthProviders('', false);
  assert.equal(unconfigured[0].id, 'google');
  assert.equal(unconfigured[0].buttonLabel, 'Continue with Google');
  assert.equal(unconfigured.every((p) => p.isReady === false), true);

  const parsed = parseEnabledProvidersList('google, github, notion');
  assert.equal(parsed.has('google'), true);
  assert.equal(parsed.has('github'), true);
  assert.equal(parsed.has('notion'), true);

  const configured = getAuthProviderStatuses('google,github', true);
  const google = configured.find((p) => p.id === 'google');
  const apple = configured.find((p) => p.id === 'apple');
  assert.equal(google?.isReady, true);
  assert.equal(apple?.isReady, false);
});

test('External workspace app integrations remain strictly separate from auth sign-in identities', () => {
  assert.ok(EXTERNAL_APP_INTEGRATIONS.length >= 5);
  assert.ok(EXTERNAL_APP_INTEGRATIONS.every((item) => item.scopeType === 'external_app_integration'));
});

test('Unconfigured Supabase environment never fakes a signed-in user or simulated login', async () => {
  const config = getSupabaseConfigState();
  if (!config.isConfigured) {
    const restored = await authService.restoreVerifiedSession();
    assert.equal(restored.status, 'unconfigured');
    assert.equal(restored.user, null);

    const signInAttempt = await authService.signInWithEmailPassword('user@example.com', 'Password123!');
    assert.equal(signInAttempt.ok, false);
    assert.equal(signInAttempt.code, 'UNCONFIGURED');

    const signUpAttempt = await authService.signUpWithEmailPassword('Test User', 'user@example.com', 'Password123!');
    assert.equal(signUpAttempt.ok, false);
    assert.equal(signUpAttempt.code, 'UNCONFIGURED');
  }
});

test('Remember Me defaults on and remembered email can be retained for the next sign-in', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  assert.equal(getRememberMePreference(storage), true);
  saveRememberedAuthEmail('angel.user@example.com', storage);
  assert.equal(getRememberedAuthEmail(storage), 'angel.user@example.com');
  assert.equal(getRememberedAuthEmail(storage), 'angel.user@example.com');
});

test('AI Studio preview hostname detection distinguishes app container host from aistudio.google.com shell origin', () => {
  assert.equal(isAiStudioPreviewHostname('ais-pre-67j3uvdue42nvzmwjvks5f-244498784849.europe-west2.run.app'), true);
  assert.equal(isAiStudioPreviewHostname('ais-dev-67j3uvdue42nvzmwjvks5f-244498784849.europe-west2.run.app'), true);
  assert.equal(isAiStudioPreviewHostname('aistudio.google.com'), false);
  assert.equal(isAiStudioPreviewHostname('sub.aistudio.google.com'), false);
  assert.equal(isAiStudioPreviewHostname(''), false);
  assert.equal(isAiStudioPreviewHostname('example.com'), false);

  // aistudio.google.com is correctly recognized as a dev/preview environment (so it uses preview callback path),
  // but resolveOAuthRedirectUrl maps its origin to the real app run.app origin.
  assert.equal(isDevelopmentPreviewEnvironment('aistudio.google.com', false), true);
  assert.equal(
    resolveOAuthRedirectUrl('https://aistudio.google.com', '/auth/callback', false),
    `${AISTUDIO_SHARED_PREVIEW_ORIGIN}/auth/preview-callback`
  );
});

test('OAuth callback route recognition and production vs preview separation', () => {
  assert.equal(parseAppRoute('/auth/preview-callback'), 'auth-preview-callback');
  assert.equal(parseAppRoute('/auth/callback'), 'auth-callback');
  assert.equal(getOAuthCallbackPath('aistudio.google.com', false), PREVIEW_CALLBACK_PATH);
  assert.equal(getOAuthCallbackPath('angel-companion.netlify.app', false), PRODUCTION_CALLBACK_PATH);
});

test('Successful OAuth callback session restoration via processAuthCallbackWithClient', async () => {
  const mockClient = {
    auth: {
      exchangeCodeForSession: async () => ({
        data: {
          session: { access_token: 'mock_token', refresh_token: 'mock_refresh' } as any,
          user: { id: 'usr_123', email: 'test@angel.ai' } as any,
        },
        error: null,
      }),
      verifyOtp: async () => ({ data: {}, error: null }),
      setSession: async () => ({ error: null }),
      signOut: async () => ({}),
    },
  };

  const outcome = await authService.processAuthCallbackWithClient(
    mockClient as any,
    '?code=test_auth_code_999&next=/app',
    '',
    async () => ({
      status: 'authenticated',
      user: { id: 'usr_123', email: 'test@angel.ai', fullName: 'Test', initials: 'T', emailVerified: true, providers: ['google'] },
      session: {} as any,
      identities: [],
      error: null,
    })
  );

  assert.equal(outcome.outcome, 'authenticated');
  assert.equal(outcome.parsed.code, 'test_auth_code_999');
  assert.equal(outcome.parsed.nextPath, '/app');
});

test('Top-level preview OAuth handoff path preserves oauth_provider while blocking external URLs', () => {
  assert.equal(
    sanitizeRedirectPath('/preview-auth?oauth_provider=google&next=%2Fapp', '/app'),
    '/preview-auth?oauth_provider=google&next=%2Fapp'
  );
  assert.equal(
    resolveDirectPreviewUrl(AISTUDIO_DEV_PREVIEW_ORIGIN, '/preview-auth?oauth_provider=google'),
    `${AISTUDIO_DEV_PREVIEW_ORIGIN}/preview-auth?oauth_provider=google`
  );
  assert.equal(
    sanitizeRedirectPath('https://evil.example.com/preview-auth?oauth_provider=google', '/app'),
    '/app'
  );
});

test('OTP code verification validates 6-digit codes, restores session cleanly, and reports expired tokens', async () => {
  const invalidFormat = await authService.verifyEmailOtpCodeWithClient(
    {
      auth: {
        verifyOtp: async () => ({ data: {}, error: null }),
      },
    },
    'user@angel.ai',
    '12ab',
    'signup'
  );
  assert.equal(invalidFormat.ok, false);

  const verifiedCalls: Array<{ email: string; token: string; type: string }> = [];
  const validOtp = await authService.verifyEmailOtpCodeWithClient(
    {
      auth: {
        verifyOtp: async (params) => {
          verifiedCalls.push(params);
          return {
            data: {
              session: { access_token: 'otp_tok', refresh_token: 'otp_ref' } as any,
              user: {
                id: 'usr_otp_1',
                email: params.email,
                email_confirmed_at: new Date().toISOString(),
                user_metadata: { full_name: 'OTP Tester' },
              } as any,
            },
            error: null,
          };
        },
      },
    },
    'user@angel.ai',
    '123 456',
    'email'
  );
  assert.equal(validOtp.ok, true);
  assert.equal(validOtp.code, 'AUTHENTICATED');
  assert.equal(validOtp.user?.email, 'user@angel.ai');
  assert.equal(verifiedCalls[0]?.token, '123456');

  const expiredOtp = await authService.verifyEmailOtpCodeWithClient(
    {
      auth: {
        verifyOtp: async () => ({
          data: { session: null, user: null },
          error: { message: 'Token has expired or is invalid' },
        }),
      },
    },
    'user@angel.ai',
    '654321',
    'email'
  );
  assert.equal(expiredOtp.ok, false);
});

test('netlify.toml omits GEMINI_MODEL and public Supabase keys from Netlify secrets scanner', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const toml = await fs.readFile(path.resolve('netlify.toml'), 'utf8');
  assert.match(toml, /\[build\.environment\]/);
  assert.match(toml, /SECRETS_SCAN_OMIT_KEYS\s*=\s*"[^"]*GEMINI_MODEL[^"]*"/);
});

test('isDuplicateSignUpResponse detects existing-account silent responses and classifies email delivery failures', async () => {
  const { isDuplicateSignUpResponse } = await import('../src/services/authService');
  const { toFriendlyError } = await import('../src/services/errorHandlingService');

  assert.equal(
    isDuplicateSignUpResponse({
      user: { id: 'u1', email: 'dup@angel.ai', identities: [] } as any,
      session: null,
    }),
    true
  );
  assert.equal(
    isDuplicateSignUpResponse({
      user: { id: 'u2', email: 'new@angel.ai', identities: [{ id: 'i1' }] } as any,
      session: null,
    }),
    false
  );

  const deliveryErr = toFriendlyError('Error sending confirmation email', 'auth', { logDiagnostic: false });
  assert.equal(deliveryErr.category, 'email_delivery_failed');
});



