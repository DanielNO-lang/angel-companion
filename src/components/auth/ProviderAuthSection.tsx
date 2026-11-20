import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { getVisibleAuthProviders, type AuthProviderStatus } from '../../services/authProviderRegistry';
import { getSupabaseConfigState, probeSupabaseAuthSettings } from '../../services/supabaseClient';
import { authService } from '../../services/authService';
import { toFriendlyError, logSanitizedDiagnostic } from '../../services/errorHandlingService';
import { setAuthFlowOrigin } from '../../services/recoveryNavigationService';
import type { ThemeMode } from '../../services/authValidation';
import { ProviderLogo } from './ProviderLogo';

interface ProviderAuthSectionProps {
  mode: 'signin' | 'signup';
  theme: ThemeMode;
  onError: (message: string) => void;
  disabled?: boolean;
}

export const ProviderAuthSection: React.FC<ProviderAuthSectionProps> = ({
  mode,
  theme,
  onError,
  disabled = false,
}) => {
  const isLight = theme === 'light';
  const [liveExternalProviders, setLiveExternalProviders] = useState<Record<string, boolean> | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [showSetupInfo, setShowSetupInfo] = useState(false);
  const loadingResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (loadingResetTimerRef.current) {
        clearTimeout(loadingResetTimerRef.current);
      }
    };
  }, [supabaseConfigured]);

  const providers = getVisibleAuthProviders(undefined, supabaseConfigured, liveExternalProviders);

  const handleProviderClick = async (provider: AuthProviderStatus) => {
    const context = provider.id === 'google' ? 'google_oauth' : 'oauth';
    setAuthFlowOrigin(mode);
    if (loadingResetTimerRef.current) {
      clearTimeout(loadingResetTimerRef.current);
      loadingResetTimerRef.current = null;
    }

    if (!provider.isReady) {
      setShowSetupInfo(true);
      const classified = toFriendlyError(
        `${provider.displayName} provider unavailable: ${provider.readinessReason}`,
        context,
        { metadata: { provider: provider.id, reason: provider.readinessReason } }
      );
      onError(classified.userMessage);
      return;
    }

    setLoadingProvider(provider.id);
    try {
      const result = await authService.signInWithOAuthProvider(provider.id, provider.scopes);
      if (!result.ok) {
        setLoadingProvider(null);
        const classified = toFriendlyError(result.message, context, {
          metadata: { provider: provider.id, code: result.code || 'oauth_start_failed' },
        });
        onError(classified.userMessage);
        return;
      }
      // New tab opened cleanly; reset button busy state shortly so the tab never stays locked if the user switches back
      loadingResetTimerRef.current = setTimeout(() => {
        setLoadingProvider(null);
      }, 650);
    } catch (error) {
      setLoadingProvider(null);
      const classified = toFriendlyError(error, context, {
        metadata: { provider: provider.id },
      });
      logSanitizedDiagnostic({
        category: classified.category,
        context,
        rawError: error,
        metadata: { provider: provider.id },
      });
      onError(classified.userMessage);
    }
  };

  const anyUnconfigured = providers.some((p) => !p.isReady);

  return (
    <div className="space-y-3">
      <div className="space-y-2.5" role="group" aria-label={`${mode === 'signup' ? 'Sign up' : 'Sign in'} with identity providers`}>
        {providers.map((provider) => {
          const isGoogle = provider.id === 'google';
          const isBusy = loadingProvider === provider.id;

          let statusChip: string | null = null;
          let chipClass = '';
          if (!provider.isReady) {
            statusChip = 'Setup Required';
            chipClass = isGoogle
              ? isLight
                ? 'bg-amber-100/90 text-amber-800'
                : 'bg-amber-500/20 text-amber-200'
              : isLight
                ? 'bg-slate-100 text-slate-600'
                : 'bg-slate-800/80 text-slate-400';
          } else if (isGoogle) {
            statusChip = 'Recommended';
            chipClass = isLight
              ? 'bg-sky-100 text-sky-800'
              : 'bg-sky-500/15 text-sky-700';
          }

          return (
            <button
              key={provider.id}
              type="button"
              disabled={disabled || Boolean(loadingProvider)}
              aria-label={provider.buttonLabel}
              onClick={() => handleProviderClick(provider)}
              className={`w-full min-h-[46px] px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-between transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed angel-blurred-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                isGoogle
                  ? isLight
                    ? 'bg-white/95 hover:bg-white text-slate-900 shadow-sm'
                    : 'bg-white/95 hover:bg-white text-slate-900 shadow-[0_8px_24px_rgba(56,189,248,0.18)]'
                  : isLight
                    ? 'bg-white/65 hover:bg-white/90 text-slate-800 backdrop-blur-md shadow-xs'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-100 backdrop-blur-md'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0 text-left">
                {isBusy ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-indigo-500" />
                ) : (
                  <ProviderLogo provider={provider.id} className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">
                  {mode === 'signup' && isGoogle
                    ? 'Continue with Google'
                    : provider.buttonLabel}
                </span>
              </span>

              {statusChip && (
                <span className={`shrink-0 whitespace-nowrap text-[10px] font-semibold px-2 py-0.5 rounded-full ${chipClass}`}>
                  {statusChip}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {anyUnconfigured && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowSetupInfo((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer focus-visible:outline-none focus-visible:underline ${
              isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Why is a sign-in option showing setup required?</span>
            {showSetupInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showSetupInfo && (
            <div
              className={`mt-2 p-3 rounded-2xl text-[11px] leading-relaxed backdrop-blur-md angel-blurred-surface ${
                isLight
                  ? 'bg-white/75 text-slate-700'
                  : 'bg-white/[0.05] text-slate-300'
              }`}
            >
              Some sign-in methods require additional provider setup before they can be used. You can use Google or
              continue with your email address below.
            </div>
          )}
        </div>
      )}

      {/* Refined Soft Separator */}
      <div className="relative flex items-center py-2">
        <div className={`flex-grow border-t ${isLight ? 'border-slate-900/10' : 'border-white/10'}`} />
        <span
          className={`shrink-0 px-3 text-xs font-medium ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          Or continue with email
        </span>
        <div className={`flex-grow border-t ${isLight ? 'border-slate-900/10' : 'border-white/10'}`} />
      </div>
    </div>
  );
};
