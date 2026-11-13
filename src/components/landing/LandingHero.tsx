import React from 'react';
import { ArrowRight, ChevronDown, Compass } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import { AngelCompanion3D } from '../branding/AngelCompanion3D';
import type { AppRoute, ThemeMode } from '../../services/authValidation';

interface LandingHeroProps {
  theme: ThemeMode;
  onNavigate: (route: AppRoute) => void;
  onExplore: () => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  theme,
  onNavigate,
  onExplore,
}) => {
  const isLight = theme === 'light';

  return (
    <section
      id="hero"
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-14 sm:pb-20 flex flex-col items-center text-center"
    >
      {/* Spatial Depth Aura + Animated Emblem & Companion Orb Centerpiece */}
      <div className="relative flex items-center justify-center my-2 sm:my-4">
        {/* Outer Orbital Depth Rings */}
        <div
          className={`w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full border pointer-events-none animate-spin-slow ${
            isLight ? 'border-sky-500/25' : 'border-cyan-400/20'
          }`}
        />
        <div
          className={`absolute w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full border pointer-events-none ${
            isLight ? 'border-indigo-400/30' : 'border-purple-400/25'
          }`}
          style={{ animation: 'spinSlow 28s linear infinite reverse' }}
        />

        {/* Ambient Spectral Halo */}
        <div
          className={`absolute w-40 h-40 sm:w-56 sm:h-56 rounded-full blur-3xl pointer-events-none animate-pulse-glow ${
            isLight
              ? 'bg-gradient-to-tr from-sky-300/50 via-blue-200/40 to-violet-300/45'
              : 'bg-gradient-to-tr from-cyan-500/30 via-indigo-500/20 to-purple-500/30'
          }`}
        />

        {/* Primary Animated 3D Chrome Trefoil Emblem */}
        <div className="absolute z-10 flex items-center justify-center">
          <div className="hidden sm:block">
            <AngelEmblem3D size={184} rotationSpeed={22} pointerTracking={true} />
          </div>
          <div className="sm:hidden">
            <AngelEmblem3D size={136} rotationSpeed={20} tiltOnHover={true} />
          </div>
        </div>

        {/* Orbiting Companion Orb Node (desktop & tablet framing) */}
        <div className="hidden sm:block absolute -right-12 md:-right-20 -bottom-2 z-20 animate-float">
          <AngelCompanion3D size={102} state="idle" showControls={false} />
        </div>
      </div>

      {/* Headline & Supporting Message */}
      <div className="max-w-3xl mx-auto space-y-4 mt-2 sm:mt-4 relative z-10">
        <p
          className={`text-xs font-bold uppercase tracking-[0.26em] font-heading ${
            isLight ? 'text-indigo-700' : 'text-cyan-300'
          }`}
        >
          Universal Personal AI Companion
        </p>

        <h1
          className={`text-3xl sm:text-5xl lg:text-6xl font-bold font-heading tracking-tight leading-[1.12] ${
            isLight ? 'text-slate-900' : 'text-white drop-shadow-[0_4px_24px_rgba(56,189,248,0.2)]'
          }`}
        >
          More Than AI.{' '}
          <span className="gradient-text-angel">Your Personal Companion.</span>
        </h1>

        <p
          className={`text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl mx-auto ${
            isLight ? 'text-slate-700' : 'text-slate-300'
          }`}
        >
          Angel brings intelligent conversation, adaptive workspaces, specialized studios, project files,
          and knowledge organization together inside one unified digital environment designed to move with your work.
        </p>

        {/* Primary Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-3">
          <button
            type="button"
            onClick={() => onNavigate('signup')}
            className="w-full sm:w-auto min-w-[180px] min-h-[50px] px-7 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-[0_10px_30px_rgba(79,70,229,0.45)] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onExplore}
            className={`w-full sm:w-auto min-w-[180px] min-h-[50px] px-7 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border ${
              isLight
                ? 'bg-white/85 hover:bg-white text-slate-900 border-slate-300 shadow-sm'
                : 'glass-panel hover:bg-white/10 text-slate-100 border-indigo-400/30'
            }`}
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Explore Angel</span>
          </button>
        </div>

        {/* Animated Explore Indicator */}
        <div className="pt-8 flex justify-center">
          <button
            type="button"
            onClick={onExplore}
            aria-label="Scroll to explore Angel capabilities"
            className={`inline-flex flex-col items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase cursor-pointer transition-opacity opacity-80 hover:opacity-100 ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            <span>Enter Angel&apos;s Environment</span>
            <ChevronDown className="w-4 h-4 animate-bounce text-cyan-400" />
          </button>
        </div>
      </div>
    </section>
  );
};
