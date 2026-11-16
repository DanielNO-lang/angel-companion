import React, { useEffect, useState } from 'react';
import { ArrowLeft, Moon, Sun, AlertTriangle } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import {
  getSupabaseConfigState,
  probeSupabaseAuthSettings,
  type SupabaseLiveHealthProbe,
} from '../../services/supabaseClient';
import {
  FRIENDLY_ERROR_MESSAGES,
  logSanitizedDiagnostic,
} from '../../services/errorHandlingService';
import type { AppRoute, ThemeMode } from '../../services/authValidation';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  visualHeading: string;
  visualDescription: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  visualHeading,
  visualDescription,
  theme,
  onToggleTheme,
  onNavigate,
  children,
}) => {
  const isLight = theme === 'light';
  const supabaseConfig = getSupabaseConfigState();
  const [liveProbe, setLiveProbe] = useState<SupabaseLiveHealthProbe | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!supabaseConfig.isConfigured) {
      setLiveProbe(null);
      logSanitizedDiagnostic({
        category: 'missing_config',
        context: 'auth',
        rawError: supabaseConfig.diagnosticDetail,
        metadata: {
          code: supabaseConfig.diagnosticCode,
        },
      });
      return;
    }
    probeSupabaseAuthSettings().then((result) => {
      if (!mounted) return;
      setLiveProbe(result);
      if (!result.reachable) {
        logSanitizedDiagnostic({
          category: result.diagnosticCode === 'auth_rejected' ? 'missing_config' : 'supabase_unreachable',
          context: 'auth',
          rawError: result.message,
          statusCode: result.statusCode ?? undefined,
        });
      }
    });
    return () => {
      mounted = false;
    };
  }, [supabaseConfig.isConfigured, supabaseConfig.supabaseUrl, supabaseConfig.diagnosticCode, supabaseConfig.diagnosticDetail]);

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col">
      {/* Top Bar: Accessible return link & Theme switch */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer min-h-[40px] backdrop-blur-xl angel-blurred-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
            isLight
              ? 'bg-white/75 hover:bg-white/95 text-slate-800 shadow-[0_8px_24px_rgba(30,64,175,0.12)]'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white shadow-[0_8px_28px_rgba(0,0,0,0.3)]'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Angel</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${isLight ? 'dark cosmic' : 'cloudy light'} mode`}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer min-h-[40px] backdrop-blur-xl angel-blurred-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
            isLight
              ? 'bg-white/75 hover:bg-white/95 text-slate-800 shadow-[0_8px_24px_rgba(30,64,175,0.12)]'
              : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 hover:text-white shadow-[0_8px_28px_rgba(0,0,0,0.3)]'
          }`}
        >
          {isLight ? (
            <>
              <Moon className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Cosmic Dark</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Cloudy Day</span>
            </>
          )}
        </button>
      </header>

      {/* Main Split Desktop / Purpose-Built Compact Mobile Composition */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1.08fr_1fr] gap-6 lg:gap-10 items-center">
          {/* DESKTOP VISUAL SIDE */}
          <section
            aria-label="Angel Companion Visual Identity"
            className={`hidden lg:flex flex-col items-center justify-center text-center relative rounded-[32px] p-10 min-h-[580px] overflow-hidden backdrop-blur-2xl angel-blurred-surface ${
              isLight
                ? 'bg-white/45 shadow-[0_0_64px_rgba(30,64,175,0.16)]'
                : 'bg-[#080d22]/45 shadow-[0_0_72px_rgba(56,189,248,0.12)]'
            }`}
          >
            {/* Clean Subtle Atmospheric Glow Behind Canonical Emblem (No Orbital Rings or Companion Orb) */}
            <div className="relative flex items-center justify-center mb-8">
              <div
                aria-hidden="true"
                className={`absolute w-52 h-52 rounded-full blur-3xl pointer-events-none animate-pulse-glow ${
                  isLight
                    ? 'bg-gradient-to-tr from-sky-300/45 via-indigo-200/35 to-purple-300/45'
                    : 'bg-gradient-to-tr from-cyan-500/25 via-indigo-500/20 to-purple-500/25'
                }`}
              />

              <div className="relative z-10">
                <AngelEmblem3D size={196} seed="auth-visual" rotationSpeed={20} pointerTracking={true} />
              </div>
            </div>

            <div className="max-w-md space-y-3 relative z-10 mt-2">
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase ${
                  isLight ? 'bg-sky-500/10 text-indigo-700' : 'bg-cyan-500/10 text-cyan-300'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>Angel Companion Environment</span>
              </div>
              <h2
                className={`text-2xl xl:text-3xl font-bold font-heading tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                {visualHeading}
              </h2>
              <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                {visualDescription}
              </p>
            </div>
          </section>

          {/* AUTHENTICATION FORM SIDE */}
          <section className="w-full max-w-md mx-auto lg:max-w-lg">
            <div
              className={`rounded-[28px] p-5 sm:p-8 relative overflow-hidden backdrop-blur-2xl angel-blurred-surface ${
                isLight
                  ? 'bg-white/70 text-slate-900 shadow-[0_0_64px_rgba(30,64,175,0.16)]'
                  : 'bg-[#080d22]/65 text-slate-100 shadow-[0_0_72px_rgba(56,189,248,0.12)]'
              }`}
            >
              {/* Purpose-Built Compact Mobile Presentation of Angel Branding */}
              <div className="flex lg:hidden items-center gap-3.5 mb-5 pb-4">
                <div className="shrink-0 flex items-center justify-center">
                  <AngelEmblem3D size={50} seed="auth-mobile" rotationSpeed={16} tiltOnHover={true} />
                </div>
                <div className="min-w-0">
                  <span
                    className={`text-xs font-bold tracking-[0.2em] uppercase font-heading ${
                      isLight ? 'text-indigo-700' : 'text-cyan-300'
                    }`}
                  >
                    ANGEL
                  </span>
                  <p className={`text-xs truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Universal Personal AI Companion
                  </p>
                </div>
              </div>

              {/* Desktop subtle canonical emblem mark in form header */}
              <div className="hidden lg:flex items-center gap-2.5 mb-3">
                <AngelEmblem3D size={24} seed="auth-header-desktop" renderMode="svg" rotationSpeed={16} />
                <span
                  className={`text-xs font-bold tracking-[0.22em] uppercase font-heading ${
                    isLight ? 'text-indigo-700' : 'text-cyan-300'
                  }`}
                >
                  ANGEL ACCOUNT
                </span>
              </div>

              <h1
                className={`text-2xl sm:text-3xl font-bold font-heading tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                {title}
              </h1>
              <p className={`text-xs sm:text-sm mt-1.5 mb-5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                {subtitle}
              </p>

              {/* Calm User-Friendly Service Notice (Never Exposing Technical Codes or Env Names) */}
              {!supabaseConfig.isConfigured && (
                <div
                  role="alert"
                  className={`mb-5 p-3.5 rounded-2xl text-xs leading-relaxed flex items-start gap-2.5 angel-blurred-surface ${
                    isLight
                      ? 'bg-amber-50/90 text-amber-900 shadow-sm'
                      : 'bg-amber-950/50 text-amber-100 shadow-md'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold">Sign-in temporarily unavailable</p>
                    <p className="mt-0.5 opacity-95">{FRIENDLY_ERROR_MESSAGES.SERVICE_UNAVAILABLE}</p>
                  </div>
                </div>
              )}

              {supabaseConfig.isConfigured && liveProbe && !liveProbe.reachable && (
                <div
                  role="alert"
                  className={`mb-5 p-3.5 rounded-2xl text-xs leading-relaxed flex items-start gap-2.5 angel-blurred-surface ${
                    isLight
                      ? 'bg-rose-50/90 text-rose-900 shadow-sm'
                      : 'bg-rose-950/50 text-rose-100 shadow-md'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold">Connection interrupted</p>
                    <p className="mt-0.5 opacity-90">{FRIENDLY_ERROR_MESSAGES.NETWORK}</p>
                  </div>
                </div>
              )}

              {children}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
