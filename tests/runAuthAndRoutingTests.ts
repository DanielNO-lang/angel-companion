import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessWorkspace,
  canUnlinkIdentity,
  deriveUserInitials,
  evaluatePasswordStrength,
  getPathForRoute,
  getRememberMePreference,
  getStoredThemeMode,
  parseAppRoute,
  parseAuthCallbackParams,
  sanitizeRedirectPath,
  saveRememberMePreference,
  saveStoredThemeMode,
  validateEmail,
  validatePasswordResetInput,
  validateSignInInput,
  validateSignUpInput,
} from '../src/services/authValidation';
import {
  EXTERNAL_APP_INTEGRATIONS,
  getAuthProviderStatuses,
  getVisibleAuthProviders,
  parseEnabledProvidersList,
} from '../src/services/authProviderRegistry';
import { getSupabaseConfigState } from '../src/services/supabaseClient';
import { authService } from '../src/services/authService';
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
  assert.equal(parseAppRoute('/app'), 'app');
  assert.equal(getPathForRoute('signin'), '/signin');
  assert.equal(getPathForRoute('app'), '/app');
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
