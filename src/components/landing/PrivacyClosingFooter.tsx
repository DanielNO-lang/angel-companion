import React, { useEffect, useState } from 'react';
import { ShieldCheck, Lock, Layers, KeyRound, ArrowRight, X } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import type { AppRoute, ThemeMode } from '../../services/authValidation';

interface PrivacyClosingFooterProps {
  theme: ThemeMode;
  onNavigate: (route: AppRoute) => void;
  onScrollToSection?: (sectionId: string) => void;
}

export const PrivacyClosingFooter: React.FC<PrivacyClosingFooterProps> = ({
  theme,
  onNavigate,
  onScrollToSection: _onScrollToSection,
}) => {
  const [policyModal, setPolicyModal] = useState<'privacy' | 'terms' | null>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    if (!policyModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPolicyModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [policyModal]);

  const trustPillars = [
    {
      icon: Lock,
      title: 'Verified Private Accounts',
      body: 'Workspace access is guarded by verified Supabase authentication sessions.',
    },
    {
      icon: Layers,
      title: 'Scoped Environment Boundaries',
      body: 'General conversations, Studio scopes, and Knowledge Library maintain clean boundaries.',
    },
    {
      icon: ShieldCheck,
      title: 'Sign-In vs. External Apps',
      body: 'Signing in verifies your Angel account identity without exposing third-party tokens.',
    },
    {
      icon: KeyRound,
      title: 'Server-Proxied Model Keys',
      body: 'AI model credentials stay strictly on the Express backend proxy.',
    },
  ];

  return (
    <>
      {/* PRIVACY, TRUST AND SECURITY - No Outlines */}
      <section
        aria-labelledby="privacy-heading"
        className="landing-section-privacy w-full py-14 sm:py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <p className={`text-xs font-bold uppercase tracking-[0.24em] font-heading ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
            Privacy, Trust & Security
          </p>
          <h2
            id="privacy-heading"
            className={`text-2xl sm:text-4xl font-bold font-heading tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}
          >
            Transparent Protection Built Into the Architecture
          </h2>
          <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Every safeguard stated here reflects actual technical controls implemented in Angel.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {trustPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className={`group landing-glass-card angel-blurred-surface rounded-[28px] p-6 space-y-3.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(56,189,248,0.2)] ${
                  isLight ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:shadow-[0_0_16px_rgba(56,189,248,0.6)] ${
                    isLight
                      ? 'bg-sky-100/80 text-indigo-600 shadow-sm'
                      : 'bg-indigo-500/20 text-cyan-400 shadow-[0_0_16px_rgba(56,189,248,0.25)]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold font-heading">{pillar.title}</h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {pillar.body}
                </p>
              </div>
            );
          })}
        </div>
        </div>
      </section>

      {/* CLOSING INVITATION SECTION - No Outlines */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div
          className={`landing-glass-card angel-blurred-surface rounded-[32px] sm:rounded-[40px] p-8 sm:p-12 lg:p-16 text-center flex flex-col items-center space-y-6 relative overflow-hidden ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute w-36 h-36 rounded-full blur-2xl pointer-events-none ${
                isLight ? 'bg-sky-300/50' : 'bg-cyan-500/30 drop-shadow-[0_0_30px_rgba(56,189,248,0.6)]'
              }`}
            />
            <div className="relative z-10 transition-transform duration-300 hover:scale-105">
              <AngelEmblem3D size={128} seed="landing-closing" rotationSpeed={20} tiltOnHover={true} />
            </div>
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold font-heading tracking-tight max-w-3xl">
            Your World. Your Intelligence. <span className="gradient-text-angel">Your Angel.</span>
          </h2>

          <p className={`text-sm sm:text-base max-w-xl leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Create your verified Angel account to step inside the workspace, or sign in to resume where you left off.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto pt-2">
            <button
              type="button"
              onClick={() => onNavigate('signup')}
              className="w-full sm:w-auto min-w-[190px] min-h-[50px] px-7 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-[0_12px_32px_rgba(79,70,229,0.45)] hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('signin')}
              className={`w-full sm:w-auto min-w-[170px] min-h-[50px] px-7 py-3 rounded-2xl font-semibold text-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                isLight
                  ? 'bg-white/90 hover:bg-white text-slate-900 shadow-md hover:shadow-lg'
                  : 'landing-glass-card hover:bg-white/15 text-white shadow-lg'
              }`}
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER - Blurred 4-side edges, Privacy & Terms & Conditions only */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div
          className={`landing-glass-card angel-blurred-surface rounded-[28px] px-6 sm:px-8 py-7 flex flex-col md:flex-row items-center justify-between gap-6 ${
            isLight ? 'text-slate-700' : 'text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <AngelEmblem3D size={32} seed="landing-footer" rotationSpeed={14} />
            </div>
            <div className="text-left">
              <div className={`text-sm font-bold tracking-[0.2em] font-heading ${isLight ? 'text-slate-900' : 'text-white'}`}>
                ANGEL
              </div>
              <div className="text-[11px] opacity-80">Universal Personal AI Companion</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPolicyModal('privacy')}
              className="whitespace-nowrap hover:text-cyan-400 transition-colors cursor-pointer py-1 px-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => setPolicyModal('terms')}
              className="whitespace-nowrap hover:text-cyan-400 transition-colors cursor-pointer py-1 px-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            >
              Terms &amp; Conditions
            </button>
          </div>

          <p className="text-xs opacity-75">
            &copy; {new Date().getFullYear()} Angel Companion. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Truthful Privacy & Terms Summary Dialog */}
      {policyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPolicyModal(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={policyModal === 'privacy' ? 'Angel Privacy Notice' : 'Angel Terms & Conditions'}
            className={`animate-landing-reveal angel-blurred-surface w-full max-w-lg rounded-3xl p-7 space-y-4 ${
              isLight ? 'bg-white/95 text-slate-900 backdrop-blur-2xl' : 'bg-[#090e26]/95 text-slate-100 backdrop-blur-2xl'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-heading">
                {policyModal === 'privacy' ? 'Angel Companion Privacy Notice' : 'Angel Companion Terms & Conditions'}
              </h3>
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                aria-label="Close dialog"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-slate-500/15 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={`text-xs leading-relaxed space-y-2.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              {policyModal === 'privacy' ? (
                <>
                  <p>
                    Account authentication and session verification are handled by Supabase Auth when configured. Angel
                    never exposes OAuth client secrets or Gemini API keys inside browser code.
                  </p>
                  <p>
                    Signing in with Google or another identity provider establishes your Angel account identity only and
                    does not authorize access to external services without explicit consent.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Angel Companion is provided as an interactive AI workspace across conversations, Studios, Adaptive
                    Workspace, Agents, and Workspace Projects.
                  </p>
                  <p>
                    You remain responsible for reviewing generated code and research summaries before production use.
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-colors shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
