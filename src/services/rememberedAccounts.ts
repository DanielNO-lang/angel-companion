import { deriveUserInitials, validateEmail } from './authValidation';

export const REMEMBERED_ACCOUNTS_STORAGE_KEY = 'angel_remembered_accounts_v1';
export const MAX_REMEMBERED_ACCOUNTS = 6;

const SUPABASE_KEY_PATTERN = /^sb-[a-z0-9_-]+-(auth-token|code-verifier)/i;

export interface RememberedAccount {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  avatarUrl?: string;
  primaryProvider: string;
  providers: string[];
  lastAuthenticatedAt: string;
}

export interface RememberedAccountInput {
  id?: string;
  email: string;
  fullName?: string | null;
  initials?: string | null;
  avatarUrl?: string | null;
  primaryProvider?: string | null;
  providers?: string[] | null;
  lastAuthenticatedAt?: string;
}

export type QuickSignInPlan =
  | {
      mode: 'oauth';
      providerId: string;
      loginHint: string;
    }
  | {
      mode: 'email_quick';
      email: string;
    };

function normalizeProvider(provider?: string | null): string {
  const clean = (provider || '').trim().toLowerCase();
  if (!clean || clean === 'magiclink' || clean === 'otp') return 'email';
  return clean;
}

function sanitizeAvatarUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return undefined;
}

export function sanitizeRememberedAccount(
  raw: RememberedAccountInput | Record<string, unknown> | null | undefined
): RememberedAccount | null {
  if (!raw || typeof raw !== 'object') return null;

  const rawEmail = typeof raw.email === 'string' ? raw.email.trim() : '';
  if (!rawEmail || !validateEmail(rawEmail)) return null;

  const cleanEmail = rawEmail.toLowerCase();
  const rawName = typeof raw.fullName === 'string' ? raw.fullName.trim() : '';
  const fullName = rawName || cleanEmail.split('@')[0] || 'Angel User';
  const rawInitials = typeof raw.initials === 'string' ? raw.initials.trim().toUpperCase() : '';
  const initials = rawInitials.slice(0, 2) || deriveUserInitials(fullName, cleanEmail);

  const rawProviders = Array.isArray(raw.providers)
    ? raw.providers.filter((p): p is string => typeof p === 'string').map(normalizeProvider)
    : [];
  const primaryProvider = normalizeProvider(
    typeof raw.primaryProvider === 'string' ? raw.primaryProvider : rawProviders[0] || 'email'
  );
  const providers = Array.from(new Set([primaryProvider, ...rawProviders].filter(Boolean)));

  const rawId = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : cleanEmail;
  const rawTimestamp =
    typeof raw.lastAuthenticatedAt === 'string' && !Number.isNaN(Date.parse(raw.lastAuthenticatedAt))
      ? raw.lastAuthenticatedAt
      : new Date().toISOString();

  const avatarUrl = sanitizeAvatarUrl(typeof raw.avatarUrl === 'string' ? raw.avatarUrl : undefined);

  // Strictly construct a plain object containing only non-sensitive identity metadata.
  // Passwords, access tokens, refresh tokens, and session objects are never stored.
  const account: RememberedAccount = {
    id: rawId,
    email: rawEmail,
    fullName,
    initials,
    primaryProvider,
    providers,
    lastAuthenticatedAt: rawTimestamp,
    ...(avatarUrl ? { avatarUrl } : {}),
  };

  return account;
}

function resolveReadStorage(storage?: Pick<Storage, 'getItem'>): Pick<Storage, 'getItem'> | undefined {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

function resolveWriteStorage(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return undefined;
}

export function getRememberedAccounts(storage?: Pick<Storage, 'getItem'>): RememberedAccount[] {
  try {
    const target = resolveReadStorage(storage);
    const raw = target?.getItem(REMEMBERED_ACCOUNTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const deduped = new Map<string, RememberedAccount>();
    for (const entry of parsed) {
      const sanitized = sanitizeRememberedAccount(entry);
      if (!sanitized) continue;
      const key = sanitized.email.toLowerCase();
      const existing = deduped.get(key);
      if (!existing || sanitized.lastAuthenticatedAt > existing.lastAuthenticatedAt) {
        deduped.set(key, sanitized);
      }
    }

    return Array.from(deduped.values())
      .sort((a, b) => b.lastAuthenticatedAt.localeCompare(a.lastAuthenticatedAt))
      .slice(0, MAX_REMEMBERED_ACCOUNTS);
  } catch {
    return [];
  }
}

export function saveRememberedAccount(
  input: RememberedAccountInput,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): RememberedAccount[] {
  const sanitized = sanitizeRememberedAccount({
    ...input,
    lastAuthenticatedAt: input.lastAuthenticatedAt || new Date().toISOString(),
  });
  if (!sanitized) {
    return getRememberedAccounts(storage);
  }

  const target = resolveWriteStorage(storage);
  const existing = getRememberedAccounts(target);
  const key = sanitized.email.toLowerCase();
  const previous = existing.find((item) => item.email.toLowerCase() === key);

  const mergedProviders = Array.from(
    new Set([...(sanitized.providers || []), ...(previous?.providers || [])])
  );

  const nextEntry: RememberedAccount = {
    ...previous,
    ...sanitized,
    providers: mergedProviders,
  };

  const nextList = [
    nextEntry,
    ...existing.filter((item) => item.email.toLowerCase() !== key),
  ].slice(0, MAX_REMEMBERED_ACCOUNTS);

  try {
    target?.setItem(REMEMBERED_ACCOUNTS_STORAGE_KEY, JSON.stringify(nextList));
  } catch {
    // Ignore storage quota errors
  }

  return nextList;
}

export function removeRememberedAccount(
  emailOrId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): RememberedAccount[] {
  const needle = (emailOrId || '').trim().toLowerCase();
  const target = resolveWriteStorage(storage);
  const current = getRememberedAccounts(target);
  const nextList = current.filter(
    (item) => item.email.toLowerCase() !== needle && item.id.toLowerCase() !== needle
  );

  try {
    if (nextList.length === 0) {
      target?.removeItem(REMEMBERED_ACCOUNTS_STORAGE_KEY);
    } else {
      target?.setItem(REMEMBERED_ACCOUNTS_STORAGE_KEY, JSON.stringify(nextList));
    }
  } catch {
    // Ignore storage errors
  }

  return nextList;
}

export function clearRememberedAccounts(storage?: Pick<Storage, 'removeItem'>): void {
  try {
    const target =
      storage || (typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined);
    target?.removeItem(REMEMBERED_ACCOUNTS_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export interface StorageKeyStore {
  length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

function isSupabaseSessionStorageKey(key: string): boolean {
  return (
    SUPABASE_KEY_PATTERN.test(key) ||
    key === 'supabase.auth.token' ||
    key.startsWith('sb-') && (key.includes('auth-token') || key.includes('code-verifier'))
  );
}

/**
 * Scrubs all active Supabase session tokens and PKCE verifiers from both localStorage
 * and sessionStorage without erasing user theme or remembered account metadata.
 */
export function clearSupabaseAuthTokensFromStorage(
  localStore?: StorageKeyStore | null,
  sessionStore?: StorageKeyStore | null
): number {
  const stores: StorageKeyStore[] = [];
  if (localStore) {
    stores.push(localStore);
  } else if (typeof window !== 'undefined' && window.localStorage) {
    stores.push(window.localStorage);
  }

  if (sessionStore) {
    stores.push(sessionStore);
  } else if (typeof window !== 'undefined' && window.sessionStorage) {
    stores.push(window.sessionStorage);
  }

  let removedCount = 0;

  for (const store of stores) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && isSupabaseSessionStorageKey(key)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        store.removeItem(key);
        removedCount += 1;
      }
    } catch {
      // Ignore storage access restrictions
    }
  }

  return removedCount;
}

export function hasSupabaseSessionTokenInStorage(
  localStore?: StorageKeyStore | null,
  sessionStore?: StorageKeyStore | null
): boolean {
  const stores: StorageKeyStore[] = [];
  if (localStore) {
    stores.push(localStore);
  } else if (typeof window !== 'undefined' && window.localStorage) {
    stores.push(window.localStorage);
  }

  if (sessionStore) {
    stores.push(sessionStore);
  } else if (typeof window !== 'undefined' && window.sessionStorage) {
    stores.push(window.sessionStorage);
  }

  for (const store of stores) {
    try {
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (key && (key === 'supabase.auth.token' || (key.startsWith('sb-') && key.includes('auth-token') && !key.includes('code-verifier')))) {
          return true;
        }
      }
    } catch {
      // Ignore storage access restrictions
    }
  }
  return false;
}

/**
 * Determines the fastest credential-free sign-in path for a previously authenticated account.
 */
export function resolveQuickSignInPlan(
  account: Pick<RememberedAccount, 'email' | 'primaryProvider' | 'providers'>,
  readyOAuthProviderIds: string[]
): QuickSignInPlan {
  const readySet = new Set(readyOAuthProviderIds.map((p) => p.toLowerCase()));
  const primary = normalizeProvider(account.primaryProvider);

  if (primary !== 'email' && readySet.has(primary)) {
    return {
      mode: 'oauth',
      providerId: primary,
      loginHint: account.email,
    };
  }

  const normalizedProviders = (account.providers || []).map(normalizeProvider);
  if (normalizedProviders.includes('google') && readySet.has('google')) {
    return {
      mode: 'oauth',
      providerId: 'google',
      loginHint: account.email,
    };
  }

  const matchedOAuth = normalizedProviders.find((p) => p !== 'email' && readySet.has(p));
  if (matchedOAuth) {
    return {
      mode: 'oauth',
      providerId: matchedOAuth,
      loginHint: account.email,
    };
  }

  return {
    mode: 'email_quick',
    email: account.email,
  };
}

export function formatProviderBadgeLabel(providerId: string): string {
  switch (normalizeProvider(providerId)) {
    case 'google':
      return 'Google';
    case 'azure':
      return 'Microsoft';
    case 'apple':
      return 'Apple';
    case 'github':
      return 'GitHub';
    case 'discord':
      return 'Discord';
    case 'facebook':
      return 'Facebook';
    case 'gitlab':
      return 'GitLab';
    case 'linkedin_oidc':
      return 'LinkedIn';
    case 'slack_oidc':
      return 'Slack';
    case 'notion':
      return 'Notion';
    case 'email':
    default:
      return 'Email';
  }
}

export function formatLastSignedInLabel(isoTimestamp: string, nowMs: number = Date.now()): string {
  const parsedMs = Date.parse(isoTimestamp);
  if (Number.isNaN(parsedMs)) return 'Previously used';

  const diffMs = Math.max(0, nowMs - parsedMs);
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 2) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  try {
    return new Date(parsedMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Previously used';
  }
}
