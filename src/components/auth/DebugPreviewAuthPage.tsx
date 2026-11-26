import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import {
  authService,
  getOAuthCallbackUrl,
  isEmbeddedPreviewFrame,
  openTopLevelPreviewTab,
  type AuthStateSnapshot,
} from '../../services/authService';
import {
  PRODUCTION_APP_ORIGIN,
  DEBUG_PREVIEW_AUTH_PATH,
  getOAuthCallbackPath,
  isDevelopmentPreviewEnvironment,
  resolveDirectPreviewUrl,
  resolveOAuthRedirectUrl,
  type AppRoute,
  type ThemeMode,
} from '../../services/authValidation';
import { getSupabaseConfigState, probeSupabaseAuthSettings, type SupabaseLiveHealthProbe } from '../../services/supabaseClient';
import { setAuthFlowOrigin } from '../../services/recoveryNavigationService';
import { toFriendlyError } from '../../services/errorHandlingService';

interface DebugPreviewAuthPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute, options?: { notice?: string | null; replace?: boolean }) => void;
  authSnapshot: AuthStateSnapshot;
  onSignOut: () => Promise<void>;
}

interface IsolationCheckResult {
  passed: boolean;
  prodUrl: string;
  previewUrl: string;
  checkedAt: string;
}

export const DebugPreviewAuthPage: React.FC<DebugPreviewAuthPageProps> = ({
  theme,
  onToggleTheme,
  onNavigate,
  authSnapshot,
  onSignOut,
}) => {
  const isLight = theme === 'light';
  const [probe, setProbe] = useState<SupabaseLiveHealthProbe | null>(null);
  const [probing, setProbing] = useState(false);
  const [startingGoogle, setStartingGoogle] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isolationCheck, setIsolationCheck] = useState<IsolationCheckResult | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isViteDev = Boolean(import.meta.env.DEV);
  const isDevPreview = isDevelopmentPreviewEnvironment(hostname, isViteDev);
  const inIframe = isEmbeddedPreviewFrame();
  const activeCallbackPath = getOAuthCallbackPath(hostname, isViteDev);
  const activeCallbackUrl = getOAuthCallbackUrl();
  const directDebugUrl = resolveDirectPreviewUrl(origin, DEBUG_PREVIEW_AUTH_PATH);
  const supabaseConfigured = getSupabaseConfigState().isConfigured;

  const runProbe = async () => {
    if (!supabaseConfigured) {
      setProbe(null);
      return;
    }
    setProbing(true);
    try {
      const result = await probeSupabaseAuthSettings();
      setProbe(result);
    } finally {
      setProbing(false);
    }
  };

  useEffect(() => {
    void runProbe();
  }, [supabaseConfigured]);

  const handleTestGoogleSignIn = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setAuthFlowOrigin('signin');
    setStartingGoogle(true);
    try {
      const result = await authService.signInWithOAuthProvider('google', 'email profile', {
        nextPath: DEBUG_PREVIEW_AUTH_PATH,
        forcePreviewCallback: true,
      });
      if (!result.ok) {
        setErrorMessage(toFriendlyError(result.message, 'google_oauth').userMessage);
        return;
      }
      setStatusMessage(
        inIframe
          ? 'Opened Google OAuth in a top-level browser tab targeting /auth/preview-callback. Complete sign-in there; this embedded frame will sync automatically.'
          : 'Redirecting to Google OAuth targeting /auth/preview-callback...'
      );
    } catch (err) {
      setErrorMessage(toFriendlyError(err, 'google_oauth').userMessage);
    } finally {
      setTimeout(() => setStartingGoogle(false), 600);
    }
  };

  const handleVerifyIsolation = () => {
    const prodUrl = resolveOAuthRedirectUrl(PRODUCTION_APP_ORIGIN, '/auth/preview-callback', false);
    const previewUrl = resolveOAuthRedirectUrl(origin || 'http://localhost:3000', '/auth/callback', isViteDev);
    const passed =
      prodUrl === `${PRODUCTION_APP_ORIGIN}/auth/callback` &&
      previewUrl.endsWith('/auth/preview-callback');
    setIsolationCheck({
      passed,
      prodUrl,
      previewUrl,
      checkedAt: new Date().toLocaleTimeString(),
    });
  };

  const handleTestSignOut = async () => {
    setSigningOut(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await onSignOut();
      setStatusMessage('Signed out cleanly. Ready for another preview OAuth test.');
    } catch {
      setErrorMessage('Could not finish test sign-out.');
    } finally {
      setSigningOut(false);
    }
  };

  const cardSurface = isLight
    ? 'bg-slate-50/90 border border-slate-200/80 text-slate-800'
    : 'bg-white/[0.04] border border-white/10 text-slate-200';

  const isAuthenticated = authSnapshot.status === 'authenticated' && Boolean(authSnapshot.user);
  const googleReady = Boolean(probe?.reachable && probe?.externalProviders?.google);

  return (
    <AuthLayout
      title="Preview OAuth Debug Harness"
      subtitle="Development & AI Studio preview-only route for testing Google sign-in via /auth/preview-callback without relaxing production security."
      visualHeading="Isolated Preview Auth Diagnostic"
      visualDescription="Production continues using strict /auth/callback verification while AI Studio embedded preview and local development test cleanly through /auth/preview-callback."
      theme={theme}
      onToggleTheme={onToggleTheme}
      onNavigate={onNavigate}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold ${
              isLight ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/20 text-amber-200'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Debug-Only Route (Disabled on Production)
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold ${
              isDevPreview
                ? isLight
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-emerald-500/20 text-emerald-200'
                : isLight
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-rose-500/20 text-rose-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {inIframe ? 'Embedded Preview Frame' : 'Top-Level Preview Tab'}
          </span>
        </div>

        {/* Route & Callback Summary */}
        <div className={`p-3.5 rounded-2xl text-xs space-y-2 ${cardSurface}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Active Callback Route</span>
            <code className="font-mono text-[11px] px-2 py-0.5 rounded-lg bg-black/15">
              {activeCallbackPath}
            </code>
          </div>
          <div>
            <span className="font-semibold block mb-0.5">Full OAuth Redirect URL</span>
            <code className="font-mono text-[11px] break-all opacity-90 block">{activeCallbackUrl}</code>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
            <span className="font-semibold">Supabase Google OAuth</span>
            <span className="inline-flex items-center gap-1.5">
              {probing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Checking...
                </>
              ) : googleReady ? (
                <span className="text-emerald-400 font-semibold">Enabled & Reachable</span>
              ) : (
                <span className="text-amber-400 font-semibold">
                  {supabaseConfigured ? 'Probe Pending / Disabled' : 'Supabase Unconfigured'}
                </span>
              )}
              <button
                type="button"
                onClick={runProbe}
                aria-label="Refresh provider check"
                className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </span>
          </div>
        </div>

        {/* Live Session Status */}
        <div className={`p-3.5 rounded-2xl text-xs space-y-2 ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Current Auth State</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-lg text-[11px] ${
                isAuthenticated
                  ? isLight
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-emerald-500/20 text-emerald-300'
                  : isLight
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-white/10 text-slate-300'
              }`}
            >
              {authSnapshot.status}
            </span>
          </div>

          {isAuthenticated && authSnapshot.user ? (
            <div className="space-y-1.5 pt-1">
              <p>
                Signed in as <span className="font-semibold">{authSnapshot.user.email}</span>
              </p>
              <p className="opacity-80">
                Providers: {authSnapshot.user.providers.join(', ') || 'email'}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('app')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-semibold cursor-pointer"
                >
                  <span>Enter Angel Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleTestSignOut}
                  disabled={signingOut}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold cursor-pointer disabled:opacity-60"
                >
                  {signingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="opacity-80">
              No active session yet. Use the button below to test Google sign-in via{' '}
              <code className="font-mono">/auth/preview-callback</code>.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleTestGoogleSignIn}
            disabled={startingGoogle || !supabaseConfigured}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-900 shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            {startingGoogle ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <ExternalLink className="w-4 h-4 text-indigo-600" />}
            <span>Test Google Sign-In via /auth/preview-callback</span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => openTopLevelPreviewTab(directDebugUrl)}
              className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                isLight
                  ? 'bg-sky-100 hover:bg-sky-200 text-sky-900'
                  : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Normal Tab</span>
            </button>

            <button
              type="button"
              onClick={handleVerifyIsolation}
              className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                isLight
                  ? 'bg-slate-200/80 hover:bg-slate-300/80 text-slate-800'
                  : 'bg-white/[0.08] hover:bg-white/[0.14] text-slate-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Check Callback Isolation</span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div
            role="status"
            className={`p-3 rounded-2xl text-xs leading-relaxed flex items-start gap-2 ${
              isLight ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-emerald-950/50 text-emerald-200 border border-emerald-500/30'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            <span>{statusMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            role="alert"
            className={`p-3 rounded-2xl text-xs leading-relaxed flex items-start gap-2 ${
              isLight ? 'bg-rose-50 text-rose-900 border border-rose-200' : 'bg-rose-950/50 text-rose-200 border border-rose-500/30'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isolationCheck && (
          <div className={`p-3 rounded-2xl text-[11px] space-y-1 ${cardSurface}`}>
            <p className="font-semibold">
              Isolation Check ({isolationCheck.checkedAt}):{' '}
              <span className={isolationCheck.passed ? 'text-emerald-400' : 'text-rose-400'}>
                {isolationCheck.passed ? 'PASS' : 'FAIL'}
              </span>
            </p>
            <p className="font-mono break-all opacity-80">Prod locked: {isolationCheck.prodUrl}</p>
            <p className="font-mono break-all opacity-80">Preview isolated: {isolationCheck.previewUrl}</p>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => onNavigate('signin')}
            className={`font-semibold underline underline-offset-4 cursor-pointer ${
              isLight ? 'text-indigo-700 hover:text-indigo-900' : 'text-cyan-300 hover:text-cyan-200'
            }`}
          >
            Return to standard Sign In
          </button>
          <span className="opacity-70">Supabase Redirect Allowlist: {activeCallbackUrl}</span>
        </div>
      </div>
    </AuthLayout>
  );
};
