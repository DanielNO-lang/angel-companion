import React, { useState } from 'react';
import { ArrowRight, ChevronDown, Compass } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import { AngelCompanion3D } from '../branding/AngelCompanion3D';
import type { CompanionOrbState } from '../../types/angel';
import type { AppRoute, ThemeMode } from '../../services/authValidation';

interface LandingHeroProps {
  theme: ThemeMode;
  onNavigate: (route: AppRoute) => void;
  onExplore: () => void;
}

const HERO_ORB_CYCLE: CompanionOrbState[] = ['idle', 'listening', 'thinking', 'speaking'];

export const LandingHero: React.FC<LandingHeroProps> = ({
  theme,
  onNavigate,
  onExplore,
}) => {
  const isLight = theme === 'light';
  const [orbState, setOrbState] = useState<CompanionOrbState>('idle');
  const [stageTilt, setStageTilt] = useState({ x: 0, y: 0 });
  const [stageHovered, setStageHovered] = useState(false);

  const cycleOrbState = () => {
    setOrbState((prev) => {
      const idx = HERO_ORB_CYCLE.indexOf(prev);
      return HERO_ORB_CYCLE[(idx + 1) % HERO_ORB_CYCLE.length];
    });
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setStageTilt({
      x: Math.max(-5, Math.min(5, -ny * 4)),
      y: Math.max(-5, Math.min(5, nx * 4)),
    });
  };

  const handleStagePointerLeave = () => {
    setStageHovered(false);
    setStageTilt({ x: 0, y: 0 });
  };

  return (
    <section
      id="hero"
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-8 pb-12 sm:pb-20 flex flex-col items-center text-center"
    >
      {/* Spatial Depth Aura + Animated Emblem & Interactive Companion Orb Centerpiece */}
      <div
        onPointerEnter={() => setStageHovered(true)}
        onPointerMove={handleStagePointerMove}
        onPointerLeave={handleStagePointerLeave}
        style={{
          perspective: '900px',
        }}
        className="relative flex flex-col sm:flex-row items-center justify-center my-2 sm:my-4"
      >
        <div
          style={{
            transform: `rotateX(${stageTilt.x}deg) rotateY(${stageTilt.y}deg) scale(${stageHovered ? 1.02 : 1})`,
            transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative flex items-center justify-center"
        >
          {/* Outer Orbital Depth Ring with Luminous Satellite Node */}
          <div
            className={`relative w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full border pointer-events-none animate-spin-slow transition-colors duration-300 ${
              isLight
                ? stageHovered
                  ? 'border-sky-500/45'
                  : 'border-sky-500/25'
                : stageHovered
                  ? 'border-cyan-400/40'
                  : 'border-cyan-400/20'
            }`}
          >
            <span
              className={`absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${
                isLight ? 'bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.7)]' : 'bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]'
              }`}
            />
          </div>

          {/* Inner Counter-Rotating Orbital Ring */}
          <div
            className={`absolute w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 rounded-full border pointer-events-none transition-colors duration-300 ${
              isLight ? 'border-indigo-400/35' : 'border-purple-400/25'
            }`}
            style={{ animation: 'spinSlow 28s linear infinite reverse' }}
          >
            <span
              className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                isLight ? 'bg-violet-500' : 'bg-purple-300 shadow-[0_0_10px_rgba(192,132,252,0.85)]'
              }`}
            />
          </div>

          {/* Controlled Spectral Halo Responding to Hover & Orb State */}
          <div
            className={`absolute w-40 h-40 sm:w-56 sm:h-56 rounded-full blur-3xl pointer-events-none animate-pulse-glow transition-opacity duration-500 ${
              stageHovered ? 'opacity-90' : 'opacity-65'
            } ${
              isLight
                ? 'bg-gradient-to-tr from-sky-300/50 via-blue-200/40 to-violet-300/45'
                : orbState === 'thinking'
                  ? 'bg-gradient-to-tr from-purple-500/35 via-indigo-500/25 to-cyan-400/30'
                  : orbState === 'speaking'
                    ? 'bg-gradient-to-tr from-pink-500/30 via-purple-500/25 to-cyan-400/30'
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

          {/* Orbiting Companion Orb Node (Interactive State Toggle on Desktop & Tablet) */}
          <button
            type="button"
            onClick={cycleOrbState}
            aria-label={`Angel Companion Orb currently ${orbState}. Click to cycle live companion state.`}
            title="Click to preview Angel Companion Orb state"
            className="hidden sm:block absolute -right-12 md:-right-20 -bottom-2 z-20 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 transition-transform duration-300 hover:scale-105"
          >
            <div className="animate-float">
              <AngelCompanion3D size={102} state={orbState} showControls={false} />
            </div>
          </button>
        </div>

        {/* Compact Mobile Companion Orb Indicator (Visible < sm without crowding emblem rings) */}
        <button
          type="button"
          onClick={cycleOrbState}
          aria-label={`Angel Companion state ${orbState}. Tap to preview state.`}
          className={`sm:hidden mt-3 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer active:scale-95 ${
            isLight
              ? 'bg-white/75 border-sky-200 text-slate-700 shadow-xs'
              : 'bg-[#090e26]/70 border-indigo-400/30 text-slate-200 backdrop-blur-md'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              orbState === 'idle'
                ? 'bg-cyan-400'
                : orbState === 'listening'
                  ? 'bg-blue-400 animate-pulse'
                  : orbState === 'thinking'
                    ? 'bg-purple-400 animate-spin'
                    : 'bg-pink-400 animate-bounce'
            }`}
          />
          <span className="capitalize">Companion: {orbState}</span>
        </button>
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
            className="w-full sm:w-auto min-w-[180px] min-h-[50px] px-7 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-[0_10px_30px_rgba(79,70,229,0.42)] hover:shadow-[0_12px_36px_rgba(56,189,248,0.4)] hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onExplore}
            onMouseEnter={() => {
              if (orbState === 'idle') setOrbState('listening');
            }}
            onMouseLeave={() => {
              if (orbState === 'listening') setOrbState('idle');
            }}
            className={`w-full sm:w-auto min-w-[180px] min-h-[50px] px-7 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
              isLight
                ? 'bg-white/80 hover:bg-white text-slate-900 border-slate-300/80 shadow-sm hover:border-blue-400'
                : 'glass-panel hover:bg-white/10 text-slate-100 border-indigo-400/30 hover:border-cyan-400/50'
            }`}
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Explore Angel</span>
          </button>
        </div>

        {/* Animated Explore Indicator */}
        <div className="pt-6 sm:pt-8 flex justify-center">
          <button
            type="button"
            onClick={onExplore}
            aria-label="Scroll to explore Angel capabilities"
            className={`inline-flex flex-col items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase cursor-pointer transition-opacity opacity-80 hover:opacity-100 rounded-xl px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
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
