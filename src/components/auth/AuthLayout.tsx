import React from 'react';
import { ArrowLeft, Moon, Sun, AlertTriangle } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import { AngelCompanion3D } from '../branding/AngelCompanion3D';
import { getSupabaseConfigState } from '../../services/supabaseClient';
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

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col">
      {/* Top Bar: Accessible return link & Theme switch */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
            isLight
              ? 'bg-white/75 hover:bg-white text-slate-800 border border-slate-200/80 shadow-sm'
              : 'glass-panel text-slate-200 hover:text-white border border-indigo-500/20 hover:border-cyan-400/40'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Angel</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${isLight ? 'dark cosmic' : 'cloudy light'} mode`}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer min-h-[40px] ${
            isLight
              ? 'bg-white/75 hover:bg-white text-slate-800 border border-slate-200/80 shadow-sm'
              : 'glass-panel text-slate-200 hover:text-white border border-indigo-500/20'
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
          {/* DESKTOP VISUAL SIDE (Two-part split on lg+, replaced by compact top header on mobile/tablet) */}
          <section
            aria-label="Angel Companion Visual Identity"
            className={`hidden lg:flex flex-col items-center justify-center text-center relative rounded-[32px] p-10 min-h-[600px] overflow-hidden ${
              isLight
                ? 'glass-panel-glow border border-sky-200/80'
                : 'glass-panel-glow border border-indigo-500/20'
            }`}
          >
            {/* Orbital depth rings */}
            <div className="relative flex items-center justify-center mb-8">
              <div
                className={`absolute w-72 h-72 rounded-full border animate-spin-slow pointer-events-none ${
                  isLight ? 'border-sky-400/35' : 'border-cyan-400/25'
                }`}
              />
              <div
                className={`absolute w-56 h-56 rounded-full border pointer-events-none ${
                  isLight ? 'border-violet-400/30' : 'border-purple-400/30'
                }`}
                style={{ animation: 'spinSlow 32s linear infinite reverse' }}
              />
              <div
                className={`absolute w-44 h-44 rounded-full blur-2xl pointer-events-none animate-pulse-glow ${
                  isLight
                    ? 'bg-gradient-to-tr from-sky-300/45 via-indigo-200/35 to-purple-300/45'
                    : 'bg-gradient-to-tr from-cyan-500/25 via-indigo-500/20 to-purple-500/25'
                }`}
              />

              {/* Reused Existing Animated 3D Emblem */}
              <div className="relative z-10">
                <AngelEmblem3D size={190} rotationSpeed={22} pointerTracking={true} />
              </div>

              {/* Softly floating Companion Orb beside the Emblem */}
              <div className="absolute -bottom-5 -right-8 z-20 animate-float">
                <AngelCompanion3D size={108} state="idle" showControls={false} />
              </div>
            </div>

            <div className="max-w-md space-y-3 relative z-10 mt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border border-cyan-400/30 bg-cyan-500/10 text-cyan-400">
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
              className={`rounded-[28px] p-5 sm:p-8 relative overflow-hidden ${
                isLight
                  ? 'glass-panel-glow border border-white/90 text-slate-900'
                  : 'glass-panel-glow border border-indigo-500/25 text-slate-100'
              }`}
            >
              {/* Purpose-Built Compact Mobile Presentation of Angel Branding */}
              <div className="flex lg:hidden items-center gap-3.5 mb-5 pb-4 border-b border-slate-500/20">
                <div className="shrink-0 flex items-center justify-center">
                  <AngelEmblem3D size={54} rotationSpeed={18} tiltOnHover={true} />
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

              {/* Desktop subtle emblem mark in form header */}
              <div className="hidden lg:flex items-center gap-2.5 mb-3">
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

              {/* Honest Supabase Configuration Warning when env vars are missing */}
              {!supabaseConfig.isConfigured && (
                <div
                  role="alert"
                  className={`mb-5 p-3.5 rounded-2xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                    isLight
                      ? 'bg-amber-50/90 border-amber-300 text-amber-900'
                      : 'bg-amber-950/50 border-amber-500/40 text-amber-100'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Supabase authentication not yet configured</p>
                    <p className="mt-0.5 opacity-90">
                      Live sign-in, registration, verification, and OAuth require{' '}
                      <code className="font-mono font-semibold">VITE_SUPABASE_URL</code> and{' '}
                      <code className="font-mono font-semibold">VITE_SUPABASE_ANON_KEY</code>. Workspace access
                      remains protected until a verified Supabase session is established.
                    </p>
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
