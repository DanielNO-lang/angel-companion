import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  LogIn,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  X,
  UserPlus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { ProviderAuthSection } from './ProviderAuthSection';
import { ProviderLogo } from './ProviderLogo';
import { authService } from '../../services/authService';
import { getVisibleAuthProviders, type AuthProviderId } from '../../services/authProviderRegistry';
import { getSupabaseConfigState, probeSupabaseAuthSettings } from '../../services/supabaseClient';
import { toFriendlyError } from '../../services/errorHandlingService';
import {
  restoreSafeWorkflowDraft,
  saveSafeWorkflowDraft,
  setAuthFlowOrigin,
} from '../../services/recoveryNavigationService';
import {
  getRememberMePreference,
  getRememberedAuthEmail,
  validateEmail,
  validateSignInInput,
  type AppRoute,
  type ThemeMode,
} from '../../services/authValidation';
import {
  formatLastSignedInLabel,
  formatProviderBadgeLabel,
  getRememberedAccounts,
  removeRememberedAccount,
  resolveQuickSignInPlan,
  type RememberedAccount,
} from '../../services/rememberedAccounts';

interface SignInPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute, options?: { email?: string }) => void;
  initialNotice?: string | null;
}

interface PasswordCredentialConstructor {
  new (data: { id: string; password: string; name?: string }): Credential;
}

interface PasswordCredentialLike extends Credential {
  password?: string;
}

async function tryStoreBrowserCredential(email: string, password: string, fullName?: string): Promise<void> {
  if (typeof window === 'undefined' || !navigator.credentials?.store) return;
  const ctor = (window as unknown as { PasswordCredential?: PasswordCredentialConstructor }).PasswordCredential;
  if (typeof ctor !== 'function') return;
  try {
    const cred = new ctor({
      id: email.trim(),
      password,
      name: fullName || email.trim(),
    });
    await navigator.credentials.store(cred);
  } catch {
    // Ignore browser credential storage opt-out or unsupported context
  }
}

async function tryGetBrowserPasswordForEmail(email: string): Promise<string | null> {
  if (typeof window === 'undefined' || !navigator.credentials?.get) return null;
  const targetEmail = email.trim().toLowerCase();
  try {
    const credentialPromise = navigator.credentials.get({
      password: true,
      mediation: 'optional',
    } as CredentialRequestOptions);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));
    const cred = (await Promise.race([credentialPromise, timeoutPromise])) as PasswordCredentialLike | null;
    if (cred && cred.type === 'password' && cred.id.toLowerCase() === targetEmail && typeof cred.password === 'string' && cred.password) {
      return cred.password;
    }
  } catch {
    // Ignore unsupported or dismissed Credential Management prompt
  }
  return null;
}

export const SignInPage: React.FC<SignInPageProps> = ({
  theme,
  onToggleTheme,
  onNavigate,
  initialNotice = null,
}) => {
  const isLight = theme === 'light';
  const [rememberedAccounts, setRememberedAccounts] = useState<RememberedAccount[]>(() => getRememberedAccounts());
  const [showOtherMethods, setShowOtherMethods] = useState<boolean>(() => getRememberedAccounts().length === 0);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const [liveExternalProviders, setLiveExternalProviders] = useState<Record<string, boolean> | null>(null);
  const [offerPasswordFallback, setOfferPasswordFallback] = useState(false);

  const [authMethod, setAuthMethod] = useState<'password' | 'magic-link'>('password');
  const [email, setEmail] = useState(() => getRememberedAuthEmail() || restoreSafeWorkflowDraft()?.authEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(() =>
    initialNotice ? toFriendlyError(initialNotice, 'auth', { logDiagnostic: false }).userMessage : null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const quickResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const supabaseConfigured = getSupabaseConfigState().isConfigured;

  useEffect(() => {
    let active = true;
    if (!supabaseConfigured) {
      setLiveExternalProviders(null);
      return;
    }
    probeSupabaseAuthSettings().then((probe) => {
      if (active && probe.reachable) {
        setLiveExternalProviders(probe.externalProviders);
      }
    });
    return () => {
      active = false;
      if (quickResetTimerRef.current) {
        clearTimeout(quickResetTimerRef.current);
      }
    };
  }, [supabaseConfigured]);

  const visibleProviders = getVisibleAuthProviders(undefined, supabaseConfigured, liveExternalProviders);
  const readyOAuthProviderIds = visibleProviders.filter((p) => p.isReady).map((p) => p.id);

  const handleQuickAccountSignIn = async (account: RememberedAccount) => {
    if (isSubmitting || busyAccountId) return;
    setFormError(null);
    setSuccessMessage(null);
    setOfferPasswordFallback(false);
    setFieldErrors({});
    if (quickResetTimerRef.current) {
      clearTimeout(quickResetTimerRef.current);
      quickResetTimerRef.current = null;
    }

    const plan = resolveQuickSignInPlan(account, readyOAuthProviderIds);
    setBusyAccountId(account.id);

    try {
      if (plan.mode === 'oauth') {
        const providerMeta = visibleProviders.find((p) => p.id === plan.providerId);
        const providerId = plan.providerId as AuthProviderId;
        setAuthFlowOrigin('signin');

        const result = await authService.signInWithOAuthProvider(providerId, providerMeta?.scopes, {
          loginHint: account.email,
        });

        if (!result.ok) {
          setBusyAccountId(null);
          const context = providerId === 'google' ? 'google_oauth' : 'oauth';
          setFormError(toFriendlyError(result.message, context).userMessage);
          return;
        }

        quickResetTimerRef.current = setTimeout(() => {
          setBusyAccountId(null);
        }, 650);
        return;
      }

      // Email / passwordless quick sign-in: try saved browser credential first, else send a one-click sign-in link
      const savedPassword = await tryGetBrowserPasswordForEmail(account.email);
      if (savedPassword) {
        const signInResult = await authService.signInWithEmailPassword(account.email, savedPassword, rememberMe);
        if (signInResult.ok) {
          setBusyAccountId(null);
          onNavigate('app');
          return;
        }
        if (signInResult.code === 'CONFIRMATION_REQUIRED') {
          setBusyAccountId(null);
          onNavigate('verify-email', { email: account.email });
          return;
        }
      }

      setEmail(account.email);
      saveSafeWorkflowDraft({ authEmail: account.email });
      const magicResult = await authService.signInWithMagicLink(account.email);
      setBusyAccountId(null);

      if (!magicResult.ok) {
        setShowOtherMethods(true);
        setAuthMethod('password');
        setFormError(toFriendlyError(magicResult.message, 'auth').userMessage);
        return;
      }

      setSuccessMessage(magicResult.message);
      setOfferPasswordFallback(true);
    } catch (error) {
      setBusyAccountId(null);
      setFormError(toFriendlyError(error, 'network').userMessage);
    }
  };

  const handleRemoveSavedAccount = (account: RememberedAccount) => {
    const updated = removeRememberedAccount(account.email || account.id);
    setRememberedAccounts(updated);
    if (updated.length === 0) {
      setShowOtherMethods(true);
    }
    setFormError(null);
    setSuccessMessage(null);
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    setOfferPasswordFallback(false);

    const validation = validateSignInInput({ email, password });
    setFieldErrors(validation.errors);
    if (!validation.valid) return;

    setIsSubmitting(true);
    try {
      const result = await authService.signInWithEmailPassword(email, password, rememberMe);

      if (!result.ok) {
        if (result.code === 'CONFIRMATION_REQUIRED') {
          onNavigate('verify-email', { email });
          return;
        }
        setFormError(toFriendlyError(result.message, 'auth').userMessage);
        return;
      }

      if (rememberMe) {
        await tryStoreBrowserCredential(email, password, result.user?.fullName);
      }

      onNavigate('app');
    } catch (error) {
      setFormError(toFriendlyError(error, 'network').userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    setOfferPasswordFallback(false);

    if (!email.trim() || !validateEmail(email)) {
      setFieldErrors({ email: 'Please enter a valid email address.' });
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      const result = await authService.signInWithMagicLink(email);
      if (!result.ok) {
        setFormError(toFriendlyError(result.message, 'auth').userMessage);
        return;
      }
      setSuccessMessage(result.message);
    } catch (error) {
      setFormError(toFriendlyError(error, 'network').userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputBaseClass = isLight
    ? 'w-full min-h-[46px] bg-white/80 hover:bg-white/95 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 angel-blurred-surface focus:outline-none focus:ring-2 focus:ring-blue-500/60 transition-all'
    : 'w-full min-h-[46px] bg-white/[0.06] hover:bg-white/[0.09] rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 angel-blurred-surface focus:outline-none focus:ring-2 focus:ring-cyan-400/60 transition-all';

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to enter your private Angel companion workspace."
      visualHeading="Your Unified Companion Awaits"
      visualDescription="Return to your conversations, Adaptive Workspace, specialized Studios, Knowledge Library, and connected workflows inside Angel."
      theme={theme}
      onToggleTheme={onToggleTheme}
      onNavigate={(r) => onNavigate(r)}
    >
      {formError && (
        <div
          role="alert"
          className={`mb-4 p-3 rounded-2xl border text-xs font-medium flex items-start gap-2 ${
            isLight
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span>{formError}</span>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className={`mb-4 p-3 rounded-2xl border text-xs font-medium space-y-2 ${
            isLight
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <span>{successMessage}</span>
          </div>
          {offerPasswordFallback && (
            <button
              type="button"
              onClick={() => {
                setOfferPasswordFallback(false);
                setShowOtherMethods(true);
                setAuthMethod('password');
                setTimeout(() => passwordInputRef.current?.focus(), 50);
              }}
              className={`inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2 cursor-pointer ${
                isLight ? 'text-emerald-900 hover:text-emerald-700' : 'text-emerald-200 hover:text-white'
              }`}
            >
              Enter password instead
            </button>
          )}
        </div>
      )}

      {/* Previously Authenticated Accounts Quick Sign-In */}
      {rememberedAccounts.length > 0 && (
        <section
          aria-label="Previously authenticated accounts"
          className="mb-5 space-y-3"
        >
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <h2 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-cyan-200/90'}`}>
                Quick Sign-In
              </h2>
              <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Choose an account from this device to sign back in without re-entering credentials.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {rememberedAccounts.map((account) => {
              const plan = resolveQuickSignInPlan(account, readyOAuthProviderIds);
              const isBusy = busyAccountId === account.id;
              const badgeProvider = plan.mode === 'oauth' ? plan.providerId : account.primaryProvider;
              const badgeLabel = formatProviderBadgeLabel(badgeProvider);
              const showAvatar = Boolean(account.avatarUrl && !failedAvatars[account.id]);

              return (
                <div
                  key={account.id}
                  className={`flex items-center gap-2 rounded-2xl p-1.5 transition-all angel-blurred-surface ${
                    isLight
                      ? 'bg-white/85 hover:bg-white shadow-sm'
                      : 'bg-white/[0.06] hover:bg-white/[0.11]'
                  }`}
                >
                  <button
                    type="button"
                    disabled={isSubmitting || Boolean(busyAccountId)}
                    onClick={() => handleQuickAccountSignIn(account)}
                    aria-label={`Continue as ${account.fullName} (${account.email}) via ${badgeLabel}`}
                    className="flex-1 min-w-0 flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-left cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden shadow-sm">
                        {showAvatar ? (
                          <img
                            src={account.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={() => setFailedAvatars((prev) => ({ ...prev, [account.id]: true }))}
                          />
                        ) : (
                          <span>{account.initials}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          {account.fullName}
                        </div>
                        <div className={`text-xs truncate ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                          {account.email}
                        </div>
                        <div className={`text-[10px] mt-0.5 flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          <ProviderLogo provider={badgeProvider === 'email' ? 'email' : badgeProvider} className="w-3 h-3 shrink-0" />
                          <span>{badgeLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatLastSignedInLabel(account.lastAuthenticatedAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold ${isLight ? 'text-blue-600' : 'text-cyan-300'}`}>
                      {isBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span className="hidden sm:inline">Continue</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isSubmitting || Boolean(busyAccountId)}
                    onClick={() => handleRemoveSavedAccount(account)}
                    aria-label={`Remove ${account.email} from saved accounts`}
                    title="Remove saved account from this device"
                    className={`shrink-0 p-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${
                      isLight
                        ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        : 'text-slate-400 hover:text-rose-300 hover:bg-rose-950/60'
                    }`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowOtherMethods((prev) => !prev)}
            aria-expanded={showOtherMethods}
            className={`w-full min-h-[42px] px-4 py-2 rounded-2xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer angel-blurred-surface ${
              isLight
                ? 'bg-white/55 hover:bg-white/85 text-slate-700'
                : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-200'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Use another account</span>
            </span>
            {showOtherMethods ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </section>
      )}

      {showOtherMethods && (
        <>
          <ProviderAuthSection
            mode="signin"
            theme={theme}
            disabled={isSubmitting || Boolean(busyAccountId)}
            onError={(msg) => setFormError(msg)}
          />

          {/* Mode selector between Password and Passwordless Magic Link */}
          <div
            className={`grid grid-cols-2 p-1 rounded-2xl mb-4 text-xs font-semibold backdrop-blur-md ${
              isLight ? 'bg-slate-900/5 text-slate-600' : 'bg-white/[0.05] text-slate-400'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setAuthMethod('password');
                setFieldErrors({});
                setFormError(null);
              }}
              className={`py-2 rounded-xl transition-all cursor-pointer ${
                authMethod === 'password'
                  ? isLight
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'bg-indigo-600 text-white shadow-md'
                  : ''
              }`}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('magic-link');
                setFieldErrors({});
                setFormError(null);
              }}
              className={`py-2 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 ${
                authMethod === 'magic-link'
                  ? isLight
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'bg-indigo-600 text-white shadow-md'
                  : ''
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Email Magic Link</span>
            </button>
          </div>

          <form onSubmit={authMethod === 'password' ? handlePasswordSignIn : handleMagicLink} className="space-y-4" noValidate>
            <div>
              <label
                htmlFor="signin-email"
                className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
              >
                Email address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                <input
                  id="signin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    saveSafeWorkflowDraft({ authEmail: e.target.value });
                  }}
                  placeholder="name@example.com"
                  className={inputBaseClass}
                  aria-invalid={Boolean(fieldErrors.email)}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            {authMethod === 'password' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="signin-password"
                      className={`block text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => onNavigate('forgot-password')}
                      className={`text-xs font-semibold cursor-pointer ${
                        isLight ? 'text-blue-600 hover:text-blue-800' : 'text-cyan-300 hover:text-cyan-200'
                      }`}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
                    <input
                      ref={passwordInputRef}
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={`${inputBaseClass} pr-11`}
                      aria-invalid={Boolean(fieldErrors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 p-2 rounded-xl text-slate-400 hover:text-cyan-400 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                    />
                    <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      Remember me on this device
                    </span>
                  </label>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isSubmitting || Boolean(busyAccountId)}
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-[0_8px_28px_rgba(79,70,229,0.45)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>
                {isSubmitting
                  ? 'Verifying...'
                  : authMethod === 'password'
                    ? 'Sign In to Angel'
                    : 'Send Sign-In Link'}
              </span>
            </button>
          </form>
        </>
      )}

      <div
        className={`mt-6 pt-4 border-t text-center text-xs ${
          isLight ? 'border-slate-900/10 text-slate-600' : 'border-white/10 text-slate-400'
        }`}
      >
        New to Angel Companion?{' '}
        <button
          type="button"
          onClick={() => onNavigate('signup')}
          className={`font-semibold cursor-pointer hover:underline ${
            isLight ? 'text-blue-600' : 'text-cyan-300'
          }`}
        >
          Create an account
        </button>
      </div>
    </AuthLayout>
  );
};
