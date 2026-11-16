import React, { useEffect, useState } from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
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
  const [stageTilt, setStageTilt] = useState({ x: 0, y: 0 });
  const [stageHovered, setStageHovered] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 639px)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsMobileViewport(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setStageTilt({
      x: Math.max(-6, Math.min(6, -ny * 5)),
      y: Math.max(-6, Math.min(6, nx * 5)),
    });
  };

  const handleStagePointerLeave = () => {
    setStageHovered(false);
    setStageTilt({ x: 0, y: 0 });
  };

  return (
    <section
      id="hero"
      className="landing-section-hero scroll-mt-28 relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-14 sm:pb-20 flex flex-col items-center text-center"
    >
      {/* Centerpiece Continuous 3D Motion Emblem */}
      <div
        onPointerEnter={() => setStageHovered(true)}
        onPointerMove={handleStagePointerMove}
        onPointerLeave={handleStagePointerLeave}
        style={{ perspective: '1000px' }}
        className="relative flex items-center justify-center my-4 sm:my-6 cursor-pointer group"
      >
        <div
          style={{
            transform: `rotateX(${stageTilt.x}deg) rotateY(${stageTilt.y}deg) scale(${stageHovered ? 1.05 : 1})`,
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative flex items-center justify-center"
        >
          {/* Subtle Luminous Background Glow for Icon */}
          <div
            className={`absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
              stageHovered ? 'opacity-90 scale-110' : 'opacity-60'
            } ${
              isLight
                ? 'bg-gradient-to-tr from-sky-400/35 via-blue-300/30 to-purple-400/35'
                : 'bg-gradient-to-tr from-cyan-400/40 via-indigo-500/30 to-purple-500/35 drop-shadow-[0_0_30px_rgba(56,189,248,0.5)]'
            }`}
          />

          {/* Canonical 3D Chrome Trefoil Emblem */}
          <div className="relative z-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <AngelEmblem3D
              size={isMobileViewport ? 148 : 196}
              seed="landing-hero"
              rotationSpeed={isMobileViewport ? 16 : 18}
              pointerTracking={!isMobileViewport}
              tiltOnHover={true}
            />
          </div>
        </div>
      </div>

      {/* Headline & Supporting Message */}
      <div className="max-w-3xl mx-auto space-y-5 mt-2 sm:mt-4 relative z-10">
        <p
          className={`text-xs font-bold uppercase tracking-[0.28em] font-heading ${
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
          and knowledge organization together inside one unified digital environment.
        </p>

        {/* Primary Actions: Get Started + Explore Angel */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4 pt-3">
          <button
            type="button"
            onClick={() => onNavigate('signup')}
            className="w-full sm:w-auto min-w-[190px] min-h-[52px] px-7 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-[0_12px_32px_rgba(79,70,229,0.45)] hover:shadow-[0_16px_40px_rgba(56,189,248,0.45)] hover:-translate-y-0.5 active:scale-[0.98] flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onExplore}
            className={`w-full sm:w-auto min-w-[190px] min-h-[52px] px-7 py-3 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
              isLight
                ? 'bg-white/75 hover:bg-white text-slate-900 shadow-[0_8px_25px_rgba(30,64,175,0.12)] hover:shadow-[0_12px_30px_rgba(59,130,246,0.2)]'
                : 'landing-glass-card hover:bg-white/10 text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.3)]'
            }`}
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Explore Angel</span>
          </button>
        </div>
      </div>
    </section>
  );
};
