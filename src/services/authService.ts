import type {
  AuthChangeEvent,
  Provider,
  Session,
  SignInWithOAuthCredentials,
  User,
  UserIdentity,
} from '@supabase/supabase-js';
import { getSupabaseClient, getSupabaseConfigState } from './supabaseClient';
import type { AuthProviderId } from './authProviderRegistry';
import {
  deriveUserInitials,
  parseAuthCallbackParams,
  saveRememberMePreference,
  saveRememberedAuthEmail,
  clearRememberedAuthEmail,
  type ParsedAuthCallback,
} from './authValidation';
import {
  clearSupabaseAuthTokensFromStorage,
  hasSupabaseSessionTokenInStorage,
  saveRememberedAccount,
} from './rememberedAccounts';

export type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'unconfigured';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  initials: string;
  emailVerified: boolean;
  avatarUrl?: string;
  providers: string[];
  createdAt?: string;
}

export interface AuthIdentityInfo {
  id: string;
  identityId: string;
  provider: string;
  email?: string;
  createdAt?: string;
  rawIdentity?: UserIdentity;
}

export interface AuthStateSnapshot {
  status: AuthStatus;
  user: AuthUser | null;
  session: Session | null;
  identities: AuthIdentityInfo[];
  error: string | null;
}

export type AuthDiagnosticCategory =
  | 'ok'
  | 'unconfigured'
  | 'provider_disabled'
  | 'oauth_incomplete'
  | 'network_unreachable'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'auth_request_failure';

export interface AuthActionResult {
  ok: boolean;
  diagnosticCategory?: AuthDiagnosticCategory;
  code?:
    | 'AUTHENTICATED'
    | 'CONFIRMATION_REQUIRED'
    | 'MAGIC_LINK_SENT'
    | 'RECOVERY_SENT'
    | 'PASSWORD_UPDATED'
    | 'OAUTH_REDIRECT'
    | 'EMAIL_UPDATED'
    | 'UNCONFIGURED'
    | 'ERROR';
  message: string;
  email?: string;
  user?: AuthUser;
  redirectUrl?: string;
}

const AUTH_SYNC_CHANNEL_NAME = 'angel_auth_sync_v1';
const AUTH_SYNC_STORAGE_KEY = 'angel_auth_sync_event_v1';

export function broadcastCrossTabAuthEvent(type: 'authenticated' | 'signed_out'): void {
  if (typeof window === 'undefined') return;
  const payload = { type, ts: Date.now() };
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(AUTH_SYNC_CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel unavailability
  }
  try {
    window.localStorage.setItem(AUTH_SYNC_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function attemptOAuthNavigation(url: string): {
  navigated: boolean;
  openedNewTab: boolean;
  inIframe: boolean;
} {
  if (typeof window === 'undefined') {
    return { navigated: false, openedNewTab: false, inIframe: false };
  }
  const inIframe = Boolean(window.top && window.top !== window.self);

  if (typeof document !== 'undefined' && document.body) {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { navigated: true, openedNewTab: true, inIframe };
    } catch {
      // Fall through to top-window or current-window redirect
    }
  }

  if (inIframe && window.top) {
    try {
      window.top.location.href = url;
      return { navigated: true, openedNewTab: false, inIframe: true };
    } catch {
      // Cross-origin frame restriction fallback
    }
  }

  window.location.assign(url);
  return { navigated: true, openedNewTab: false, inIframe };
}

export function classifySupabaseAuthError(
  rawMessage: string,
  providerLabel?: string
): { category: AuthDiagnosticCategory; message: string } {
  const lower = (rawMessage || '').toLowerCase();
  const providerPrefix = providerLabel ? `${providerLabel} ` : '';

  if (/provider.*(not enabled|disabled|unsupported)|unsupported provider/i.test(lower)) {
    return {
      category: 'provider_disabled',
      message: `${providerPrefix}authentication provider is disabled in Supabase. Enable it in Supabase Authentication → Providers and add its OAuth Client ID and Client Secret.`,
    };
  }
  if (/invalid_client|redirect_uri|oauth.*secret|client_id|missing.*secret|redirect url/i.test(lower)) {
    return {
      category: 'oauth_incomplete',
      message: `${providerPrefix}OAuth configuration is incomplete in Supabase or your identity provider console (${rawMessage}).`,
    };
  }
  if (/failed to fetch|networkerror|network request failed|timed out|abort/i.test(lower)) {
    return {
      category: 'network_unreachable',
      message: 'Could not reach Supabase Auth from the browser. Check network connectivity and VITE_SUPABASE_URL.',
    };
  }
  if (/email not confirmed|confirm your email/i.test(lower)) {
    return {
      category: 'email_not_confirmed',
      message: rawMessage,
    };
  }
  if (/invalid login credentials|invalid email or password/i.test(lower)) {
    return {
      category: 'invalid_credentials',
      message: rawMessage,
    };
  }

  return {
    category: 'auth_request_failure',
    message: rawMessage || 'Authentication request failed.',
  };
}

function mapSupabaseUser(user: User): AuthUser {
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split('@')[0] ||
    'Angel User';

  const providersFromMeta = Array.isArray(user.app_metadata?.providers)
    ? (user.app_metadata.providers as string[])
    : [];
  const providersFromIdentities = Array.isArray(user.identities)
    ? user.identities.map((id) => id.provider).filter(Boolean)
    : [];

  const uniqueProviders = Array.from(new Set([...providersFromMeta, ...providersFromIdentities]));

  return {
    id: user.id,
    email: user.email || '',
    fullName,
    initials: deriveUserInitials(fullName, user.email),
    emailVerified: Boolean(user.email_confirmed_at),
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) || undefined,
    providers: uniqueProviders,
    createdAt: user.created_at,
  };
}

function recordRememberedUserAccount(
  mappedUser: AuthUser,
  rawUser?: User | null,
  preferredProvider?: string
): void {
  if (!mappedUser.email) return;
  const appMetaProvider =
    typeof rawUser?.app_metadata?.provider === 'string'
      ? rawUser.app_metadata.provider
      : undefined;
  const primaryProvider =
    preferredProvider ||
    appMetaProvider ||
    mappedUser.providers[0] ||
    'email';

  saveRememberedAccount({
    id: mappedUser.id,
    email: mappedUser.email,
    fullName: mappedUser.fullName,
    initials: mappedUser.initials,
    avatarUrl: mappedUser.avatarUrl,
    primaryProvider,
    providers: mappedUser.providers.length > 0 ? mappedUser.providers : [primaryProvider],
  });
}

function mapIdentities(user: User | null, explicitList?: UserIdentity[]): AuthIdentityInfo[] {
  const rawList = explicitList || user?.identities || [];
  return rawList.map((item) => ({
    id: item.id,
    identityId: item.identity_id || item.id,
    provider: item.provider,
    email: (item.identity_data?.email as string | undefined) || user?.email,
    createdAt: item.created_at,
    rawIdentity: item,
  }));
}

function getCallbackUrl(path: string = '/auth/callback'): string {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}

export interface BuiltOAuthSignInOptions {
  redirectTo: string;
  scopes?: string;
  queryParams?: Record<string, string>;
}

/**
 * Builds Supabase signInWithOAuth options.
 * Sets `prompt: 'select_account'` exclusively for Google so account selection is always offered
 * without injecting non-standard prompt parameters into Apple, Microsoft, or GitHub flows.
 */
export function buildOAuthSignInOptions(
  provider: AuthProviderId,
  redirectTo: string = getCallbackUrl('/auth/callback'),
  scopes?: string,
  loginHint?: string
): BuiltOAuthSignInOptions {
  const options: BuiltOAuthSignInOptions = {
    redirectTo,
    ...(scopes ? { scopes } : {}),
  };

  const cleanHint = loginHint?.trim();
  if (provider === 'google') {
    options.queryParams = cleanHint
      ? { login_hint: cleanHint }
      : { prompt: 'select_account' };
  } else if (provider === 'azure' && cleanHint) {
    options.queryParams = { login_hint: cleanHint };
  }

  return options;
}

export interface CallbackOutcome {
  outcome: 'authenticated' | 'recovery' | 'verified' | 'error';
  parsed: ParsedAuthCallback;
  message: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  if (timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

class AuthService {
  private listeners = new Set<(snapshot: AuthStateSnapshot) => void>();
  private snapshot: AuthStateSnapshot = {
    status: getSupabaseConfigState().isConfigured ? 'loading' : 'unconfigured',
    user: null,
    session: null,
    identities: [],
    error: null,
  };
  private authSubscriptionInitialized = false;
  private callbackInProgress = false;
  private codeExchangeCache = new Map<string, Promise<CallbackOutcome>>();

  private emit() {
    for (const cb of this.listeners) {
      cb(this.snapshot);
    }
  }

  public getSnapshot(): AuthStateSnapshot {
    return this.snapshot;
  }

  public subscribe(listener: (snapshot: AuthStateSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public resetCallbackDedupeForTests(): void {
    this.codeExchangeCache.clear();
  }

  public subscribeToCrossTabAuthSync(
    onAuthenticated: () => void,
    onSignedOut: () => void
  ): () => void {
    if (typeof window === 'undefined') return () => {};

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(AUTH_SYNC_CHANNEL_NAME);
        channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
          if (event.data?.type === 'authenticated') {
            onAuthenticated();
          } else if (event.data?.type === 'signed_out') {
            onSignedOut();
          }
        };
      }
    } catch {
      channel = null;
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === AUTH_SYNC_STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as { type?: string };
          if (parsed.type === 'authenticated') onAuthenticated();
          else if (parsed.type === 'signed_out') onSignedOut();
        } catch {
          // Ignore malformed payload
        }
        return;
      }
      if (event.key.startsWith('sb-') && event.key.includes('auth-token') && !event.key.includes('code-verifier')) {
        if (event.newValue) {
          onAuthenticated();
        } else {
          onSignedOut();
        }
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (this.snapshot.status === 'unauthenticated' && !this.callbackInProgress && hasSupabaseSessionTokenInStorage()) {
        onAuthenticated();
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleVisibilityOrFocus);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }

    return () => {
      channel?.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
    };
  }

  private ensureAuthListener() {
    if (this.authSubscriptionInitialized) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    this.authSubscriptionInitialized = true;

    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!session || !session.user) {
        if (event === 'SIGNED_OUT') clearRememberedAuthEmail();
        if (this.callbackInProgress && event === 'INITIAL_SESSION') {
          return;
        }
        this.snapshot = {
          status: 'unauthenticated',
          user: null,
          session: null,
          identities: [],
          error: null,
        };
        this.emit();
        return;
      }

      if (event === 'SIGNED_OUT') {
        this.snapshot = {
          status: 'unauthenticated',
          user: null,
          session: null,
          identities: [],
          error: null,
        };
        this.emit();
        return;
      }

      const mapped = mapSupabaseUser(session.user);
      if (session.user.email) saveRememberedAuthEmail(session.user.email);
      recordRememberedUserAccount(mapped, session.user);
      this.snapshot = {
        status: 'authenticated',
        user: mapped,
        session,
        identities: mapIdentities(session.user),
        error: null,
      };
      this.emit();
    });
  }

  /**
   * Verifies both local session existence and server JWT validity via supabase.auth.getUser()
   * before granting access to the private Angel workspace.
   */
  public async restoreVerifiedSession(): Promise<AuthStateSnapshot> {
    const config = getSupabaseConfigState();
    const supabase = getSupabaseClient();

    if (!config.isConfigured || !supabase) {
      this.snapshot = {
        status: 'unconfigured',
        user: null,
        session: null,
        identities: [],
        error: null,
      };
      this.emit();
      return this.snapshot;
    }

    this.ensureAuthListener();

    try {
      const { data: sessionData, error: sessionError } = await withTimeout(
        supabase.auth.getSession(),
        10000,
        'Timed out reading authentication session. Please sign in again.'
      );
      if (sessionError || !sessionData.session) {
        this.snapshot = {
          status: 'unauthenticated',
          user: null,
          session: null,
          identities: [],
          error: sessionError ? sessionError.message : null,
        };
        this.emit();
        return this.snapshot;
      }

      const isOfflineNow = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (isOfflineNow && sessionData.session.user) {
        const mappedOffline = mapSupabaseUser(sessionData.session.user);
        recordRememberedUserAccount(mappedOffline, sessionData.session.user);
        this.snapshot = {
          status: 'authenticated',
          user: mappedOffline,
          session: sessionData.session,
          identities: mapIdentities(sessionData.session.user),
          error: null,
        };
        this.emit();
        return this.snapshot;
      }

      const { data: userData, error: userError } = await withTimeout(
        supabase.auth.getUser(),
        10000,
        'Timed out verifying user identity with Supabase. Please sign in again.'
      );
      if (userError || !userData.user) {
        const rawErrMsg = (userError?.message || '').toLowerCase();
        const errStatus = (userError as { status?: number } | null)?.status;
        const isTransientNetworkFailure =
          sessionData.session.user &&
          errStatus !== 401 &&
          errStatus !== 403 &&
          (/failed to fetch|networkerror|network request failed|timed out|offline/i.test(rawErrMsg) ||
            (typeof navigator !== 'undefined' && navigator.onLine === false));

        if (isTransientNetworkFailure && sessionData.session.user) {
          const mappedCached = mapSupabaseUser(sessionData.session.user);
          recordRememberedUserAccount(mappedCached, sessionData.session.user);
          this.snapshot = {
            status: 'authenticated',
            user: mappedCached,
            session: sessionData.session,
            identities: mapIdentities(sessionData.session.user),
            error: null,
          };
          this.emit();
          return this.snapshot;
        }

        // Stale or revoked session token — sign out locally to clear corrupted session
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          // Ignore local cleanup error
        }
        clearRememberedAuthEmail();
        this.snapshot = {
          status: 'unauthenticated',
          user: null,
          session: null,
          identities: [],
          error: 'Your session expired. Please sign in again.',
        };
        this.emit();
        return this.snapshot;
      }

      let identities = mapIdentities(userData.user);
      try {
        const { data: idData } = await supabase.auth.getUserIdentities();
        if (idData?.identities) {
          identities = mapIdentities(userData.user, idData.identities);
        }
      } catch {
        // Fallback to user.identities if getUserIdentities isn't available
      }

      const mapped = mapSupabaseUser(userData.user);
      if (userData.user.email) saveRememberedAuthEmail(userData.user.email);
      recordRememberedUserAccount(mapped, userData.user);
      this.snapshot = {
        status: 'authenticated',
        user: mapped,
        session: sessionData.session,
        identities,
        error: null,
      };
      this.emit();
      return this.snapshot;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '';
      if (/failed to fetch|networkerror|network request failed|timed out/i.test(errMsg)) {
        try {
          const { data: fallbackSession } = await supabase.auth.getSession();
          if (fallbackSession.session?.user) {
            const mappedCached = mapSupabaseUser(fallbackSession.session.user);
            recordRememberedUserAccount(mappedCached, fallbackSession.session.user);
            this.snapshot = {
              status: 'authenticated',
              user: mappedCached,
              session: fallbackSession.session,
              identities: mapIdentities(fallbackSession.session.user),
              error: null,
            };
            this.emit();
            return this.snapshot;
          }
        } catch {
          // Fall through to unauthenticated snapshot
        }
      }
      this.snapshot = {
        status: 'unauthenticated',
        user: null,
        session: null,
        identities: [],
        error: err instanceof Error ? err.message : 'Unable to verify authentication session.',
      };
      this.emit();
      return this.snapshot;
    }
  }

  public async signInWithEmailPassword(
    email: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase authentication is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
      };
    }

    saveRememberMePreference(rememberMe);
    this.ensureAuthListener();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error.message || 'Invalid email or password.',
      };
    }

    if (!data.session || !data.user) {
      return {
        ok: false,
        code: 'CONFIRMATION_REQUIRED',
        email: email.trim(),
        message: 'Please verify your email address before signing in.',
      };
    }

    const mapped = mapSupabaseUser(data.user);
    recordRememberedUserAccount(mapped, data.user, 'email');
    this.snapshot = {
      status: 'authenticated',
      user: mapped,
      session: data.session,
      identities: mapIdentities(data.user),
      error: null,
    };
    this.emit();
    broadcastCrossTabAuthEvent('authenticated');

    return {
      ok: true,
      code: 'AUTHENTICATED',
      message: 'Signed in successfully.',
      user: mapped,
    };
  }

  public async signUpWithEmailPassword(
    fullName: string,
    email: string,
    password: string
  ): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase authentication is not configured yet. Registration requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
      };
    }

    this.ensureAuthListener();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
        emailRedirectTo: getCallbackUrl('/auth/callback?type=signup'),
      },
    });

    if (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error.message || 'Unable to create your account.',
      };
    }

    if (data.session && data.user) {
      const mapped = mapSupabaseUser(data.user);
      recordRememberedUserAccount(mapped, data.user, 'email');
      this.snapshot = {
        status: 'authenticated',
        user: mapped,
        session: data.session,
        identities: mapIdentities(data.user),
        error: null,
      };
      this.emit();
      return {
        ok: true,
        code: 'AUTHENTICATED',
        message: 'Account created and verified.',
        email: email.trim(),
        user: mapped,
      };
    }

    return {
      ok: true,
      code: 'CONFIRMATION_REQUIRED',
      email: email.trim(),
      message: `Account created. Please check ${email.trim()} to verify your email address before entering Angel.`,
    };
  }

  public async resendVerificationEmail(email: string): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase is not configured. Verification emails cannot be sent yet.',
      };
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: getCallbackUrl('/auth/callback?type=signup'),
      },
    });

    if (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error.message || 'Unable to resend verification email.',
      };
    }

    return {
      ok: true,
      code: 'MAGIC_LINK_SENT',
      email: email.trim(),
      message: `A fresh verification link has been sent to ${email.trim()}.`,
    };
  }

  public async updateAccountEmail(newEmail: string): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase is not configured.',
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return {
        ok: false,
        code: 'ERROR',
        message: 'Email address changes require an active unverified/authenticated Supabase session. If you mistyped your email before confirming, register again with the corrected address.',
      };
    }

    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: getCallbackUrl('/auth/callback?type=email_change') }
    );

    if (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error.message || 'Could not update email address.',
      };
    }

    return {
      ok: true,
      code: 'EMAIL_UPDATED',
      email: newEmail.trim(),
      message: `Confirmation links have been sent to verify ${newEmail.trim()}.`,
    };
  }

  public async requestPasswordReset(email: string): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase authentication is not configured yet.',
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getCallbackUrl('/auth/callback?type=recovery&next=/reset-password'),
    });

    if (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error.message || 'Unable to send password recovery email.',
      };
    }

    return {
      ok: true,
      code: 'RECOVERY_SENT',
      email: email.trim(),
      message: `If an account exists for ${email.trim()}, a password recovery link has been sent.`,
    };
  }

  public async completePasswordReset(newPassword: string): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase is not configured.',
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      return {
        ok: false,
        code: 'ERROR',
        message: 'Your recovery link has expired or was not verified. Request a new password reset email.',
      };
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error.message || 'Failed to update password.',
      };
    }

    if (data.user) {
      this.snapshot = {
        ...this.snapshot,
        status: 'authenticated',
        user: mapSupabaseUser(data.user),
      };
      this.emit();
    }

    return {
      ok: true,
      code: 'PASSWORD_UPDATED',
      message: 'Your password has been updated successfully.',
    };
  }

  public async signInWithMagicLink(email: string): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase is not configured yet.',
      };
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getCallbackUrl('/auth/callback?type=magiclink'),
      },
    });

    if (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error.message || 'Unable to send sign-in link.',
      };
    }

    return {
      ok: true,
      code: 'MAGIC_LINK_SENT',
      email: email.trim(),
      message: `Check ${email.trim()} for your one-time Angel sign-in link.`,
    };
  }

  public async signInWithOAuthProvider(
    provider: AuthProviderId,
    scopes?: string,
    options?: { loginHint?: string }
  ): Promise<AuthActionResult> {
    const config = getSupabaseConfigState();
    const supabase = getSupabaseClient();
    if (!supabase || !config.isConfigured) {
      return { ok: false, diagnosticCategory: 'unconfigured', code: 'UNCONFIGURED', message: config.statusMessage };
    }
    // OAuth sign-ins use persistent storage by default, matching Remember Me.
    saveRememberMePreference(true);
    this.ensureAuthListener();
    const providerName = provider === 'azure' ? 'Microsoft' : provider.charAt(0).toUpperCase() + provider.slice(1);
    try {
      const oauthOptions = buildOAuthSignInOptions(
        provider,
        getCallbackUrl('/auth/callback'),
        scopes,
        options?.loginHint
      );
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as Parameters<typeof supabase.auth.signInWithOAuth>[0]['provider'],
        options: {
          ...oauthOptions,
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        const classified = classifySupabaseAuthError(error.message || 'Failed to initiate ' + providerName + ' sign-in.', providerName);
        return { ok: false, diagnosticCategory: classified.category, code: 'ERROR', message: classified.message };
      }
      if (data?.url && typeof window !== 'undefined') {
        const nav = attemptOAuthNavigation(data.url);
        return {
          ok: nav.navigated,
          diagnosticCategory: 'ok',
          code: 'OAUTH_REDIRECT',
          redirectUrl: data.url,
          message: nav.openedNewTab
            ? `Opened ${providerName} sign-in in a new tab.`
            : `Redirecting to ${providerName}...`,
        };
      }
      return { ok: false, diagnosticCategory: 'oauth_incomplete', code: 'ERROR', message: 'Supabase did not return an authorization URL for ' + providerName + '. Verify OAuth configuration in Supabase Authentication → Providers.' };
    } catch (error) {
      const raw = error instanceof Error ? error.message : 'Unable to start ' + providerName + ' sign-in.';
      const classified = classifySupabaseAuthError(raw, providerName);
      return { ok: false, diagnosticCategory: classified.category, code: 'ERROR', message: classified.message };
    }
  }
  public async processAuthCallbackWithClient(
    client: {
      auth: {
        exchangeCodeForSession: (code: string) => Promise<{ data: { session: Session | null; user: User | null }; error: { message?: string } | null }>;
        verifyOtp: (params: { token_hash: string; type: 'signup' | 'recovery' | 'magiclink' | 'email_change' | 'invite' }) => Promise<{ data?: { session?: Session | null }; error: { message?: string } | null }>;
        setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{ error: { message?: string } | null }>;
        signOut?: (opts?: { scope?: 'local' | 'global' | 'others' }) => Promise<unknown>;
      };
    },
    search: string,
    hash: string,
    restoreSessionFn: () => Promise<AuthStateSnapshot>
  ): Promise<CallbackOutcome> {
    const parsed = parseAuthCallbackParams(search, hash);

    if (parsed.error || parsed.errorDescription || parsed.isExpiredOrInvalid) {
      const detail = parsed.errorDescription
        ? decodeURIComponent(parsed.errorDescription.replace(/\+/g, ' '))
        : parsed.isCancelled
          ? 'Authentication was cancelled at the provider.'
          : 'The verification or OAuth link is invalid or has expired.';
      return {
        outcome: 'error',
        parsed,
        message: detail,
      };
    }

    const executeCodeExchange = async (code: string): Promise<CallbackOutcome> => {
      const { data, error } = await withTimeout(
        client.auth.exchangeCodeForSession(code),
        12000,
        'OAuth verification timed out. Please try signing in again.'
      );
      if (error) {
        return {
          outcome: 'error',
          parsed,
          message: error.message || 'OAuth state verification failed or code expired.',
        };
      }
      if (parsed.type === 'recovery') {
        const restored = await restoreSessionFn();
        if (restored.status !== 'authenticated' || !restored.session) {
          return {
            outcome: 'error',
            parsed,
            message: restored.error || 'Recovery session could not be verified. Request a new password reset link.',
          };
        }
        return {
          outcome: 'recovery',
          parsed,
          message: 'Recovery session verified. Set your new password below.',
        };
      }
      if (!data?.session || !data?.user) {
        return {
          outcome: 'error',
          parsed,
          message: 'OAuth exchange did not produce a valid session.',
        };
      }
      const restored = await restoreSessionFn();
      if (restored.status !== 'authenticated' || !restored.user || !restored.session) {
        try {
          await client.auth.signOut?.({ scope: 'local' });
        } catch {
          // Ignore cleanup error
        }
        return {
          outcome: 'error',
          parsed,
          message: restored.error || 'Authenticated session could not be verified with Supabase.',
        };
      }
      return {
        outcome: 'authenticated',
        parsed,
        message: 'Authentication verified.',
      };
    };

    try {
      if (parsed.code) {
        const existingPromise = this.codeExchangeCache.get(parsed.code);
        if (existingPromise) {
          return await existingPromise;
        }
        const exchangePromise = executeCodeExchange(parsed.code);
        this.codeExchangeCache.set(parsed.code, exchangePromise);
        return await exchangePromise;
      }

      if (parsed.tokenHash && parsed.type) {
        const { data, error } = await withTimeout(
          client.auth.verifyOtp({
            token_hash: parsed.tokenHash,
            type: parsed.type as 'signup' | 'recovery' | 'magiclink' | 'email_change' | 'invite',
          }),
          12000,
          'Verification link check timed out. Please try again.'
        );
        if (error) {
          return {
            outcome: 'error',
            parsed,
            message: error.message || 'Verification link expired or invalid.',
          };
        }
        if (parsed.type === 'recovery') {
          const restored = await restoreSessionFn();
          if (restored.status !== 'authenticated' || !restored.session) {
            return {
              outcome: 'error',
              parsed,
              message: restored.error || 'Recovery token session could not be verified.',
            };
          }
          return {
            outcome: 'recovery',
            parsed,
            message: 'Recovery token verified. Choose a new password.',
          };
        }
        const restored = await restoreSessionFn();
        if (data?.session && (restored.status !== 'authenticated' || !restored.user || !restored.session)) {
          return {
            outcome: 'error',
            parsed,
            message: restored.error || 'Verified token failed session validation.',
          };
        }
        return {
          outcome: restored.status === 'authenticated' && parsed.type === 'magiclink' ? 'authenticated' : 'verified',
          parsed,
          message: 'Email verified successfully.',
        };
      }

      if (parsed.accessToken && parsed.refreshToken) {
        const { error } = await withTimeout(
          client.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          }),
          12000,
          'Session handoff timed out. Please try signing in again.'
        );
        if (error) {
          return {
            outcome: 'error',
            parsed,
            message: error.message || 'Session callback expired.',
          };
        }
        const restored = await restoreSessionFn();
        if (restored.status !== 'authenticated' || !restored.user || !restored.session) {
          try {
            await client.auth.signOut?.({ scope: 'local' });
          } catch {
            // Ignore cleanup error
          }
          return {
            outcome: 'error',
            parsed,
            message: restored.error || 'Callback session could not be verified with Supabase.',
          };
        }
        if (parsed.type === 'recovery') {
          return {
            outcome: 'recovery',
            parsed,
            message: 'Recovery session active. Choose your new password.',
          };
        }
        return {
          outcome: 'authenticated',
          parsed,
          message: 'Signed in successfully.',
        };
      }

      const restored = await restoreSessionFn();
      if (restored.status === 'authenticated' && restored.user && restored.session) {
        return {
          outcome: parsed.type === 'recovery' ? 'recovery' : 'authenticated',
          parsed,
          message: 'Session verified.',
        };
      }

      return {
        outcome: 'error',
        parsed,
        message: restored.error || 'No valid verification code or session found in callback URL.',
      };
    } catch (err) {
      return {
        outcome: 'error',
        parsed,
        message: err instanceof Error ? err.message : 'Callback verification failed.',
      };
    }
  }

  public async processAuthCallback(search: string, hash: string): Promise<CallbackOutcome> {
    const parsed = parseAuthCallbackParams(search, hash);
    const supabase = getSupabaseClient();

    if (!supabase) {
      this.snapshot = {
        status: 'unconfigured',
        user: null,
        session: null,
        identities: [],
        error: 'Supabase is not configured in this environment.',
      };
      this.emit();
      return {
        outcome: 'error',
        parsed,
        message: 'Supabase is not configured in this environment.',
      };
    }

    this.ensureAuthListener();
    this.callbackInProgress = true;
    try {
      const result = await this.processAuthCallbackWithClient(
        supabase,
        search,
        hash,
        () => this.restoreVerifiedSession()
      );
      if (result.outcome === 'authenticated') {
        broadcastCrossTabAuthEvent('authenticated');
      } else if (result.outcome === 'error' && this.snapshot.status === 'loading') {
        this.snapshot = {
          status: 'unauthenticated',
          user: null,
          session: null,
          identities: [],
          error: result.message,
        };
        this.emit();
      }
      return result;
    } finally {
      this.callbackInProgress = false;
    }
  }

  public async refreshIdentities(): Promise<AuthIdentityInfo[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error || !data?.identities) return this.snapshot.identities;

    const currentUser = (await supabase.auth.getUser()).data.user;
    const mapped = mapIdentities(currentUser, data.identities);
    this.snapshot = {
      ...this.snapshot,
      identities: mapped,
    };
    this.emit();
    return mapped;
  }

  public async linkProviderIdentity(provider: AuthProviderId): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase is not configured.',
      };
    }

    const credentials: SignInWithOAuthCredentials = {
      provider: provider as Provider,
      options: {
        redirectTo: getCallbackUrl('/auth/callback?next=/app'),
      },
    };

    const { data, error } = await supabase.auth.linkIdentity(credentials);

    if (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error.message || `Could not link ${provider} identity.`,
      };
    }

    if (data?.url && typeof window !== 'undefined') {
      attemptOAuthNavigation(data.url);
    }

    return {
      ok: true,
      code: 'OAUTH_REDIRECT',
      message: `Opening ${provider} linking in a new tab...`,
    };
  }

  public async unlinkProviderIdentity(identity: AuthIdentityInfo): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase is not configured.',
      };
    }

    if (this.snapshot.identities.length <= 1) {
      return {
        ok: false,
        code: 'ERROR',
        message: 'Cannot disconnect your sole authentication method. Add another sign-in method first.',
      };
    }

    if (!identity.rawIdentity) {
      return {
        ok: false,
        code: 'ERROR',
        message: 'Missing identity record from Supabase.',
      };
    }

    const { error } = await supabase.auth.unlinkIdentity(identity.rawIdentity);
    if (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error.message || `Failed to disconnect ${identity.provider}.`,
      };
    }

    await this.refreshIdentities();
    return {
      ok: true,
      message: `${identity.provider} sign-in identity disconnected.`,
    };
  }

  public async signOut(): Promise<void> {
    const config = getSupabaseConfigState();
    const supabase = getSupabaseClient();

    this.codeExchangeCache.clear();
    this.callbackInProgress = false;

    if (supabase) {
      // Sign out this browser session only. Never revoke every device session as a fallback.
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      clearSupabaseAuthTokensFromStorage();

      if (signOutError) {
        throw new Error(signOutError.message || 'Supabase could not clear the local session.');
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        throw new Error(sessionError.message || 'Could not verify that the session was cleared.');
      }
      if (data.session) {
        throw new Error('The session is still active after sign-out. Please try again.');
      }
    } else if (config.isConfigured) {
      clearSupabaseAuthTokensFromStorage();
      throw new Error('Supabase is unavailable. The current session could not be cleared.');
    } else {
      clearSupabaseAuthTokensFromStorage();
    }

    // Clear the transient legacy email field while preserving the saved-accounts list for quick re-entry.
    clearRememberedAuthEmail();

    if (typeof navigator !== 'undefined' && navigator.credentials?.preventSilentAccess) {
      try {
        await navigator.credentials.preventSilentAccess();
      } catch {
        // Ignore unsupported Credential Management restrictions
      }
    }

    this.snapshot = {
      status: config.isConfigured ? 'unauthenticated' : 'unconfigured',
      user: null,
      session: null,
      identities: [],
      error: null,
    };
    this.emit();
    broadcastCrossTabAuthEvent('signed_out');
  }
}

export const authService = new AuthService();
