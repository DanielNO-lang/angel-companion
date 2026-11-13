import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { getVisibleAuthProviders, type AuthProviderStatus } from '../../services/authProviderRegistry';
import { authService } from '../../services/authService';
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
  const providers = getVisibleAuthProviders();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [showSetupInfo, setShowSetupInfo] = useState(false);

  const handleProviderClick = async (provider: AuthProviderStatus) => {
    if (!provider.isReady) {
      setShowSetupInfo(true);
      onError(
        `${provider.displayName} sign-in is not yet active: ${
          !provider.supabaseConfigured
            ? 'Supabase project environment variables are not configured.'
            : provider.setupSummary
        }`
      );
      return;
    }

    setLoadingProvider(provider.id);
    try {
      const result = await authService.signInWithOAuthProvider(provider.id, provider.scopes);
      if (!result.ok) {
        setLoadingProvider(null);
        onError(result.message);
      }
    } catch (error) {
      setLoadingProvider(null);
      onError(error instanceof Error ? error.message : 'Could not start provider sign-in. Please try again.');
    }
  };

  const anyUnconfigured = providers.some((p) => !p.isReady);

  return (
    <div className="space-y-3">
      <div className="space-y-2.5" role="group" aria-label={`${mode === 'signup' ? 'Sign up' : 'Sign in'} with identity providers`}>
        {providers.map((provider, idx) => {
          const isGoogle = provider.id === 'google';
          const isBusy = loadingProvider === provider.id;

          return (
            <button
              key={provider.id}
              type="button"
              disabled={disabled || Boolean(loadingProvider)}
              aria-label={provider.buttonLabel}
              onClick={() => handleProviderClick(provider)}
              className={`w-full min-h-[46px] px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-between transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                isGoogle
                  ? isLight
                    ? 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 shadow-sm'
                    : 'bg-white/95 hover:bg-white text-slate-900 border border-white/20 shadow-[0_6px_22px_rgba(56,189,248,0.18)]'
                  : isLight
                    ? 'bg-white/75 hover:bg-white text-slate-800 border border-slate-200'
                    : 'bg-slate-900/75 hover:bg-slate-800/90 text-slate-100 border border-slate-700/80'
              } ${idx === 0 ? 'ring-1 ring-cyan-400/20' : ''}`}
            >
              <span className="flex items-center gap-3">
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                ) : (
                  <ProviderLogo provider={provider.id} className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {mode === 'signup' && isGoogle
                    ? 'Continue with Google'
                    : provider.buttonLabel}
                </span>
              </span>

              {!provider.isReady ? (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isGoogle
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : isLight
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  Setup Required
                </span>
              ) : isGoogle ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                  Recommended
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {anyUnconfigured && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowSetupInfo((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer ${
              isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Why do social providers show Setup Required?</span>
            {showSetupInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showSetupInfo && (
            <div
              className={`mt-2 p-3 rounded-2xl text-[11px] leading-relaxed border ${
                isLight
                  ? 'bg-slate-50/90 border-slate-200 text-slate-700'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300'
              }`}
            >
              OAuth buttons connect exclusively to real Supabase Auth flows—never simulated logins. Enable each provider
              in Supabase Auth with their provider credentials. Google is attempted directly through Supabase when the project client is configured; additional providers may also be allow-listed in{' '}
              <code className="font-mono text-cyan-400">VITE_SUPABASE_ENABLED_PROVIDERS</code>.
            </div>
          )}
        </div>
      )}

      {/* Refined Separator */}
      <div className="relative flex items-center py-2">
        <div className={`flex-grow border-t ${isLight ? 'border-slate-300/80' : 'border-slate-700/70'}`} />
        <span
          className={`shrink-0 px-3 text-xs font-medium ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          Or continue with email
        </span>
        <div className={`flex-grow border-t ${isLight ? 'border-slate-300/80' : 'border-slate-700/70'}`} />
      </div>
    </div>
  );
};
