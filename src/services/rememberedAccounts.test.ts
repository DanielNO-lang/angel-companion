import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearRememberedAccounts,
  clearSupabaseAuthTokensFromStorage,
  formatLastSignedInLabel,
  formatProviderBadgeLabel,
  getRememberedAccounts,
  hasSupabaseSessionTokenInStorage,
  MAX_REMEMBERED_ACCOUNTS,
  REMEMBERED_ACCOUNTS_STORAGE_KEY,
  removeRememberedAccount,
  resolveQuickSignInPlan,
  sanitizeRememberedAccount,
  saveRememberedAccount,
} from './rememberedAccounts';
import { buildOAuthSignInOptions } from './authService';
import {
  getAuthFlowOrigin,
  peekPreviousSafeRoute,
  pushSafeRoute,
  resetNavigationStateOnSignOut,
  restoreSafeWorkflowDraft,
  saveSafeWorkflowDraft,
  setAuthFlowOrigin,
} from './recoveryNavigationService';

function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
}

test('sanitizeRememberedAccount strips passwords/tokens and rejects invalid emails or unsafe avatars', () => {
  assert.equal(sanitizeRememberedAccount({ email: 'not-an-email' }), null);

  const sanitized = sanitizeRememberedAccount({
    id: 'usr_123',
    email: 'Ada.Lovelace@Example.com',
    fullName: 'Ada Lovelace',
    avatarUrl: 'javascript:alert(1)',
    primaryProvider: 'Google',
    providers: ['google', 'email'],
    password: 'super-secret-password',
    accessToken: 'jwt-secret-token',
    refreshToken: 'refresh-secret',
  } as unknown as Record<string, unknown>);

  assert.ok(sanitized);
  assert.equal(sanitized.email, 'Ada.Lovelace@Example.com');
  assert.equal(sanitized.initials, 'AL');
  assert.equal(sanitized.primaryProvider, 'google');
  assert.equal(sanitized.avatarUrl, undefined);
  assert.equal('password' in sanitized, false);
  assert.equal('accessToken' in sanitized, false);
  assert.equal('refreshToken' in sanitized, false);
});

test('saveRememberedAccount deduplicates by email, merges providers, sorts newest first, and caps size', () => {
  const storage = createMemoryStorage();

  for (let i = 1; i <= MAX_REMEMBERED_ACCOUNTS + 2; i += 1) {
    saveRememberedAccount(
      {
        id: `usr_${i}`,
        email: `user${i}@example.com`,
        fullName: `User ${i}`,
        primaryProvider: i % 2 === 0 ? 'google' : 'email',
        providers: [i % 2 === 0 ? 'google' : 'email'],
        lastAuthenticatedAt: new Date(1700000000000 + i * 60000).toISOString(),
      },
      storage
    );
  }

  const list = getRememberedAccounts(storage);
  assert.equal(list.length, MAX_REMEMBERED_ACCOUNTS);
  assert.equal(list[0].email, `user${MAX_REMEMBERED_ACCOUNTS + 2}@example.com`);

  // Updating an existing user deduplicates case-insensitively and merges providers
  const updated = saveRememberedAccount(
    {
      id: 'usr_6',
      email: 'USER6@example.com',
      fullName: 'User Six Updated',
      primaryProvider: 'github',
      providers: ['github'],
      lastAuthenticatedAt: new Date(1800000000000).toISOString(),
    },
    storage
  );

  assert.equal(updated[0].email, 'USER6@example.com');
  assert.equal(updated[0].fullName, 'User Six Updated');
  assert.equal(updated.filter((item) => item.email.toLowerCase() === 'user6@example.com').length, 1);
  assert.equal(updated[0].providers.includes('google'), true);
  assert.equal(updated[0].providers.includes('github'), true);

  const afterRemove = removeRememberedAccount('user6@example.com', storage);
  assert.equal(afterRemove.some((item) => item.email.toLowerCase() === 'user6@example.com'), false);

  clearRememberedAccounts(storage);
  assert.equal(getRememberedAccounts(storage).length, 0);
});

test('clearSupabaseAuthTokensFromStorage scrubs session tokens while preserving remembered accounts and theme', () => {
  const localStore = createMemoryStorage();
  const sessionStore = createMemoryStorage();

  localStore.setItem('sb-qltiogotxbxwzwmnypwu-auth-token', '{"access_token":"secret"}');
  localStore.setItem('sb-qltiogotxbxwzwmnypwu-auth-token-code-verifier', 'verifier123');
  localStore.setItem(REMEMBERED_ACCOUNTS_STORAGE_KEY, '[{"email":"ada@example.com"}]');
  localStore.setItem('angel_theme_mode_v1', 'dark');

  sessionStore.setItem('sb-qltiogotxbxwzwmnypwu-auth-token', '{"access_token":"session_secret"}');
  sessionStore.setItem('supabase.auth.token', 'legacy');

  const removed = clearSupabaseAuthTokensFromStorage(localStore, sessionStore);
  assert.equal(removed, 4);

  assert.equal(localStore.getItem('sb-qltiogotxbxwzwmnypwu-auth-token'), null);
  assert.equal(localStore.getItem('sb-qltiogotxbxwzwmnypwu-auth-token-code-verifier'), null);
  assert.equal(sessionStore.getItem('sb-qltiogotxbxwzwmnypwu-auth-token'), null);
  assert.equal(sessionStore.getItem('supabase.auth.token'), null);

  assert.equal(localStore.getItem(REMEMBERED_ACCOUNTS_STORAGE_KEY), '[{"email":"ada@example.com"}]');
  assert.equal(localStore.getItem('angel_theme_mode_v1'), 'dark');
});

test('hasSupabaseSessionTokenInStorage detects active session tokens and ignores PKCE code-verifier keys', () => {
  const localStore = createMemoryStorage();
  const sessionStore = createMemoryStorage();

  assert.equal(hasSupabaseSessionTokenInStorage(localStore, sessionStore), false);

  localStore.setItem('sb-qltiogotxbxwzwmnypwu-auth-token-code-verifier', 'pkce-only');
  assert.equal(hasSupabaseSessionTokenInStorage(localStore, sessionStore), false);

  localStore.setItem('sb-qltiogotxbxwzwmnypwu-auth-token', '{"access_token":"valid"}');
  assert.equal(hasSupabaseSessionTokenInStorage(localStore, sessionStore), true);
});

test('resolveQuickSignInPlan prioritizes ready OAuth providers with loginHint and falls back to email_quick', () => {
  const googlePlan = resolveQuickSignInPlan(
    { email: 'ada@gmail.com', primaryProvider: 'google', providers: ['google', 'email'] },
    ['google', 'github']
  );
  assert.deepEqual(googlePlan, {
    mode: 'oauth',
    providerId: 'google',
    loginHint: 'ada@gmail.com',
  });

  const secondaryGooglePlan = resolveQuickSignInPlan(
    { email: 'grace@gmail.com', primaryProvider: 'email', providers: ['email', 'google'] },
    ['google']
  );
  assert.deepEqual(secondaryGooglePlan, {
    mode: 'oauth',
    providerId: 'google',
    loginHint: 'grace@gmail.com',
  });

  const emailPlan = resolveQuickSignInPlan(
    { email: 'linus@example.com', primaryProvider: 'email', providers: ['email'] },
    ['google']
  );
  assert.deepEqual(emailPlan, {
    mode: 'email_quick',
    email: 'linus@example.com',
  });

  assert.equal(formatProviderBadgeLabel('azure'), 'Microsoft');
  assert.equal(formatProviderBadgeLabel('email'), 'Email');
  assert.equal(formatLastSignedInLabel('2026-11-20T03:35:00.000Z', Date.parse('2026-11-20T03:36:00.000Z')), 'Just now');
  assert.equal(formatLastSignedInLabel('2026-11-18T03:36:00.000Z', Date.parse('2026-11-20T03:36:00.000Z')), '2d ago');
});

test('buildOAuthSignInOptions passes login_hint for Google and Microsoft quick sign-in without breaking default select_account', () => {
  const defaultGoogle = buildOAuthSignInOptions('google', 'https://app.example/auth/callback', 'openid email profile');
  assert.deepEqual(defaultGoogle.queryParams, { prompt: 'select_account' });

  const hintedGoogle = buildOAuthSignInOptions(
    'google',
    'https://app.example/auth/callback',
    'openid email profile',
    'ada@gmail.com'
  );
  assert.deepEqual(hintedGoogle.queryParams, { login_hint: 'ada@gmail.com' });

  const hintedAzure = buildOAuthSignInOptions('azure', 'https://app.example/auth/callback', undefined, 'ada@outlook.com');
  assert.deepEqual(hintedAzure.queryParams, { login_hint: 'ada@outlook.com' });
});

test('resetNavigationStateOnSignOut wipes safe route stack, workflow drafts, and auth origin', () => {
  pushSafeRoute('landing');
  pushSafeRoute('app');
  setAuthFlowOrigin('signup');
  saveSafeWorkflowDraft({ authEmail: 'ada@example.com', activeTab: 'workspace' });

  resetNavigationStateOnSignOut();

  assert.equal(peekPreviousSafeRoute('signin', 'landing'), 'landing');
  assert.equal(getAuthFlowOrigin(), 'signin');
  assert.equal(restoreSafeWorkflowDraft(), null);
});

test('Logout flow resets application state, clears tokens, redirects to signin, and SignInPage exposes saved accounts', () => {
  const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.ok(appSource.includes('await authService.signOut()'));
  assert.ok(appSource.includes('cloudSyncCoordinator.resetAllEnginesOnSignOut()'));
  assert.ok(appSource.includes('resetStateOnSignOut()'));
  assert.ok(appSource.includes('resetNavigationStateOnSignOut()'));
  assert.ok(appSource.includes("navigateRoute('signin', { replace: true })"));
  assert.equal(appSource.includes("navigateRoute('landing', { replace: true });\n    } catch"), false);

  const authServiceSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/authService.ts'), 'utf8');
  assert.ok(authServiceSource.includes('clearSupabaseAuthTokensFromStorage()'));
  assert.ok(authServiceSource.includes('saveRememberedAccount('));

  const signInSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/auth/SignInPage.tsx'), 'utf8');
  assert.ok(signInSource.includes('Previously authenticated accounts'));
  assert.ok(signInSource.includes('Quick Sign-In'));
  assert.ok(signInSource.includes('Use another account'));
  assert.ok(signInSource.includes('handleQuickAccountSignIn'));
  assert.ok(signInSource.includes('handleRemoveSavedAccount'));
});

test('OAuth opens directly in a new tab without duplicate buttons, fallback boxes, or window.open, and syncs callback into /app', () => {
  const providerSectionSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/auth/ProviderAuthSection.tsx'), 'utf8');
  const signInSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/auth/SignInPage.tsx'), 'utf8');
  const authServiceSource = fs.readFileSync(path.resolve(process.cwd(), 'src/services/authService.ts'), 'utf8');
  const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  for (const source of [providerSectionSource, signInSource, authServiceSource]) {
    assert.equal(source.includes('topWindowFallback'), false);
    assert.equal(source.includes('quickTopWindowFallback'), false);
    assert.equal(source.includes('requiresTopWindowLink'), false);
    assert.equal(source.includes('Embedded previews restrict'), false);
    assert.equal(source.includes('window.open'), false);
  }

  assert.ok(authServiceSource.includes("link.target = '_blank'"));
  assert.ok(authServiceSource.includes("link.rel = 'noopener noreferrer'"));
  assert.ok(authServiceSource.includes("broadcastCrossTabAuthEvent('authenticated')"));
  assert.ok(appSource.includes('subscribeToCrossTabAuthSync'));
  assert.ok(appSource.includes("const targetRoute: AppRoute = parsedTarget === 'landing' ? 'app' : parsedTarget;"));
});
