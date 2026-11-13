import React, { useEffect, useState } from 'react';
import { ShieldCheck, Lock, Layers, KeyRound, ArrowRight, X } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import type { AppRoute, ThemeMode } from '../../services/authValidation';

interface PrivacyClosingFooterProps {
  theme: ThemeMode;
  onNavigate: (route: AppRoute) => void;
  onScrollToSection: (sectionId: string) => void;
}

export const PrivacyClosingFooter: React.FC<PrivacyClosingFooterProps> = ({
  theme,
  onNavigate,
  onScrollToSection,
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
      body: 'Workspace access is guarded by verified Supabase authentication sessions. Unauthenticated visitors remain in the public entry experience.',
    },
    {
      icon: Layers,
      title: 'Scoped Environment Boundaries',
      body: 'General conversations, Studio scopes, Incognito sessions, and the Knowledge Library maintain clean boundaries inside the application.',
    },
    {
      icon: ShieldCheck,
      title: 'Sign-In vs. External App Consent',
      body: 'Signing in with Google or another OAuth identity only verifies your Angel account. External workspace integrations require separate explicit permission.',
    },
    {
      icon: KeyRound,
      title: 'Server-Proxied Model Keys',
      body: 'AI model credentials (such as GEMINI_API_KEY) stay strictly on the Express backend proxy and are never bundled into frontend client code.',
    },
  ];

  return (
    <>
      {/* PRIVACY, TRUST AND SECURITY */}
      <section
        id="privacy"
        aria-labelledby="privacy-heading"
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
      >
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
            Every safeguard stated here reflects the actual technical controls implemented in Angel today.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {trustPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className={`group landing-glass-card rounded-3xl p-5 sm:p-6 space-y-3 hover:-translate-y-0.5 ${
                  isLight ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl border flex items-center justify-center transition-all duration-300 group-hover:scale-105 ${
                    isLight
                      ? 'bg-sky-50 border-sky-200 text-indigo-600 group-hover:border-blue-400'
                      : 'bg-indigo-500/15 border-indigo-400/30 text-cyan-400 group-hover:border-cyan-400/60 group-hover:shadow-[0_0_16px_rgba(56,189,248,0.28)]'
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
      </section>

      {/* CLOSING INVITATION SECTION */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div
          className={`landing-glass-card rounded-[32px] sm:rounded-[36px] p-8 sm:p-12 lg:p-16 text-center flex flex-col items-center space-y-6 relative overflow-hidden ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <div
              className={`absolute w-36 h-36 rounded-full border pointer-events-none animate-spin-slow ${
                isLight ? 'border-sky-400/40' : 'border-cyan-400/25'
              }`}
            />
            <div
              className={`absolute w-32 h-32 rounded-full blur-2xl pointer-events-none ${
                isLight ? 'bg-sky-300/50' : 'bg-cyan-500/25'
              }`}
            />
            <AngelEmblem3D size={112} rotationSpeed={18} tiltOnHover={true} />
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold font-heading tracking-tight max-w-3xl">
            Your World. Your Intelligence. <span className="gradient-text-angel">Your Angel.</span>
          </h2>

          <p className={`text-sm sm:text-base max-w-xl leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Create your verified Angel account to step inside the workspace, or sign in to resume where you left off.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto pt-2">
            <button
              type="button"
              onClick={() => onNavigate('signup')}
              className="w-full sm:w-auto min-w-[180px] min-h-[48px] px-7 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-sm shadow-[0_10px_30px_rgba(79,70,229,0.42)] hover:-translate-y-0.5 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('signin')}
              className={`w-full sm:w-auto min-w-[160px] min-h-[48px] px-7 py-3 rounded-2xl font-semibold text-sm border hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                isLight
                  ? 'bg-white/85 hover:bg-white text-slate-900 border-slate-300 hover:border-blue-400'
                  : 'glass-panel hover:bg-white/10 text-white border-indigo-400/30 hover:border-cyan-400/50'
              }`}
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <div
          className={`landing-glass-card rounded-3xl px-6 py-7 flex flex-col md:flex-row items-center justify-between gap-6 ${
            isLight ? 'text-slate-700' : 'text-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 flex items-center justify-center rounded-xl shrink-0 ${
                isLight ? 'bg-gradient-to-br from-slate-900 to-indigo-950 ring-1 ring-indigo-300/70 shadow-sm' : ''
              }`}
            >
              <AngelEmblem3D size={isLight ? 28 : 34} rotationSpeed={14} />
            </div>
            <div className="text-left">
              <div className={`text-sm font-bold tracking-[0.2em] font-heading ${isLight ? 'text-slate-900' : 'text-white'}`}>
                ANGEL
              </div>
              <div className="text-[11px] opacity-80">Universal Personal AI Companion</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold">
            <button type="button" onClick={() => onScrollToSection('about')} className="hover:text-cyan-400 transition-colors cursor-pointer py-1 px-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70">
              About Angel
            </button>
            <button type="button" onClick={() => onScrollToSection('capabilities')} className="hover:text-cyan-400 transition-colors cursor-pointer py-1 px-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70">
              Core Capabilities
            </button>
            <button type="button" onClick={() => onScrollToSection('experience')} className="hover:text-cyan-400 transition-colors cursor-pointer py-1 px-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70">
              Experience
            </button>
            <button type="button" onClick={() => setPolicyModal('privacy')} className="hover:text-cyan-400 transition-colors cursor-pointer py-1 px-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70">
              Privacy
            </button>
            <button type="button" onClick={() => setPolicyModal('terms')} className="hover:text-cyan-400 transition-colors cursor-pointer py-1 px-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70">
              Terms
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPolicyModal(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={policyModal === 'privacy' ? 'Angel Privacy Notice' : 'Angel Terms of Use'}
            className={`animate-landing-reveal w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-4 ${
              isLight
                ? 'bg-white/95 text-slate-900 border-sky-200 backdrop-blur-2xl'
                : 'bg-[#090e26]/95 text-slate-100 border-indigo-500/35 backdrop-blur-2xl'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold font-heading">
                {policyModal === 'privacy' ? 'Angel Companion Privacy Notice' : 'Angel Companion Terms of Use'}
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
                    does not authorize access to Google Drive, Gmail, Calendar, or external services without a separate
                    explicit connector flow.
                  </p>
                  <p>
                    Workspace files, Studio contexts, and Library items created during local operation remain scoped
                    inside your browser storage until cloud synchronization tables are enabled on your Supabase project.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Angel Companion is provided as an interactive AI workspace across conversations, Studios, Adaptive
                    Workspace, Agents, Workspace Projects, and Library tools.
                  </p>
                  <p>
                    You remain responsible for reviewing generated code, research summaries, and project documents before
                    production use. External connectors marked Not Connected remain inactive until manually configured.
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
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
