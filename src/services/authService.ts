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
  type ParsedAuthCallback,
} from './authValidation';

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

export interface AuthActionResult {
  ok: boolean;
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

  private ensureAuthListener() {
    if (this.authSubscriptionInitialized) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    this.authSubscriptionInitialized = true;

    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!session || !session.user) {
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
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
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

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        // Stale or revoked session token — sign out locally to clear corrupted session
        await supabase.auth.signOut({ scope: 'local' });
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

      this.snapshot = {
        status: 'authenticated',
        user: mapSupabaseUser(userData.user),
        session: sessionData.session,
        identities,
        error: null,
      };
      this.emit();
      return this.snapshot;
    } catch (err) {
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
        message: 'Supabase authentication is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
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
        message: 'Supabase authentication is not configured yet. Registration requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
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

  public async signInWithOAuthProvider(provider: AuthProviderId, scopes?: string): Promise<AuthActionResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        ok: false,
        code: 'UNCONFIGURED',
        message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before signing in.',
      };
    }

    this.ensureAuthListener();

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as Parameters<typeof supabase.auth.signInWithOAuth>[0]['provider'],
        options: {
          redirectTo: getCallbackUrl('/auth/callback'),
          scopes,
        },
      });

      if (error) {
        const detail = error.message || `Failed to initiate ${provider} sign-in.`;
        const providerName = provider === 'azure'
          ? 'Microsoft'
          : provider.charAt(0).toUpperCase() + provider.slice(1);
        const message = /provider.*(not enabled|unsupported)|unsupported provider/i.test(detail)
          ? `${providerName} sign-in is not enabled in Supabase yet. Enable it under Authentication → Providers and add the provider's OAuth Client ID and Client Secret.`
          : detail;
        return { ok: false, code: 'ERROR', message };
      }

      if (data?.url && typeof window !== 'undefined') {
        window.location.assign(data.url);
      } else {
        return {
          ok: false,
          code: 'ERROR',
          message: `Supabase did not return an authorization URL for ${provider}.`,
        };
      }

      return {
        ok: true,
        code: 'OAUTH_REDIRECT',
        message: `Redirecting to ${provider}...`,
      };
    } catch (error) {
      return {
        ok: false,
        code: 'ERROR',
        message: error instanceof Error ? error.message : `Unable to start ${provider} sign-in.`,
      };
    }
  }

  public async processAuthCallback(search: string, hash: string): Promise<{
    outcome: 'authenticated' | 'recovery' | 'verified' | 'error';
    parsed: ParsedAuthCallback;
    message: string;
  }> {
    const parsed = parseAuthCallbackParams(search, hash);
    const supabase = getSupabaseClient();

    if (!supabase) {
      return {
        outcome: 'error',
        parsed,
        message: 'Supabase is not configured in this environment.',
      };
    }

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

    this.ensureAuthListener();

    try {
      if (parsed.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(parsed.code);
        if (error) {
          return {
            outcome: 'error',
            parsed,
            message: error.message || 'OAuth state verification failed or code expired.',
          };
        }
        if (parsed.type === 'recovery') {
          return {
            outcome: 'recovery',
            parsed,
            message: 'Recovery session verified. Set your new password below.',
          };
        }
        if (data.session && data.user) {
          await this.restoreVerifiedSession();
          return {
            outcome: 'authenticated',
            parsed,
            message: 'Authentication verified.',
          };
        }
      }

      if (parsed.tokenHash && parsed.type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: parsed.tokenHash,
          type: parsed.type as 'signup' | 'recovery' | 'magiclink' | 'email_change' | 'invite',
        });
        if (error) {
          return {
            outcome: 'error',
            parsed,
            message: error.message || 'Verification link expired or invalid.',
          };
        }
        if (parsed.type === 'recovery') {
          return {
            outcome: 'recovery',
            parsed,
            message: 'Recovery token verified. Choose a new password.',
          };
        }
        await this.restoreVerifiedSession();
        return {
          outcome: 'verified',
          parsed,
          message: 'Email verified successfully.',
        };
      }

      if (parsed.accessToken && parsed.refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (error) {
          return {
            outcome: 'error',
            parsed,
            message: error.message || 'Session callback expired.',
          };
        }
        if (parsed.type === 'recovery') {
          return {
            outcome: 'recovery',
            parsed,
            message: 'Recovery session active. Choose your new password.',
          };
        }
        await this.restoreVerifiedSession();
        return {
          outcome: 'authenticated',
          parsed,
          message: 'Signed in successfully.',
        };
      }

      const restored = await this.restoreVerifiedSession();
      if (restored.status === 'authenticated') {
        return {
          outcome: parsed.type === 'recovery' ? 'recovery' : 'authenticated',
          parsed,
          message: 'Session verified.',
        };
      }

      return {
        outcome: 'error',
        parsed,
        message: 'No valid verification code or session found in callback URL.',
      };
    } catch (err) {
      return {
        outcome: 'error',
        parsed,
        message: err instanceof Error ? err.message : 'Callback verification failed.',
      };
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
      window.location.assign(data.url);
    }

    return {
      ok: true,
      code: 'OAUTH_REDIRECT',
      message: `Redirecting to link ${provider}...`,
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
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        await supabase.auth.signOut({ scope: 'local' });
      }
    }
    this.snapshot = {
      status: getSupabaseConfigState().isConfigured ? 'unauthenticated' : 'unconfigured',
      user: null,
      session: null,
      identities: [],
      error: null,
    };
    this.emit();
  }
}

export const authService = new AuthService();
