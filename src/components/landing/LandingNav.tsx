import React, { useEffect, useState } from 'react';
import { Menu, X, Moon, Sun, ArrowRight } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import type { AppRoute, ThemeMode } from '../../services/authValidation';

interface LandingNavProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
  onScrollToSection: (sectionId: string) => void;
}

const NAV_LINKS = [
  { id: 'hero', label: 'Home' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'experience', label: 'Experience' },
  { id: 'about', label: 'About Angel' },
  { id: 'privacy', label: 'Privacy' },
];

export const LandingNav: React.FC<LandingNavProps> = ({
  theme,
  onToggleTheme,
  onNavigate,
  onScrollToSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('hero');
  const isLight = theme === 'light';

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sectionIds = NAV_LINKS.map((l) => l.id);
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const handleAnchor = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    onScrollToSection(id);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full px-3 sm:px-6 lg:px-8 pt-3 pb-2 transition-all duration-300">
        <nav
          aria-label="Primary Public Navigation"
          className={`max-w-7xl mx-auto px-3.5 sm:px-5 py-2.5 rounded-2xl flex items-center justify-between gap-3 transition-all duration-300 backdrop-blur-2xl ${
            isLight
              ? scrolled
                ? 'bg-white/80 border border-sky-200/90 text-slate-900 shadow-[0_14px_38px_-12px_rgba(30,64,175,0.18)]'
                : 'bg-white/65 border border-white/85 text-slate-900 shadow-[0_10px_30px_-10px_rgba(30,64,175,0.12)]'
              : scrolled
                ? 'bg-[#070b20]/75 border border-indigo-400/25 text-slate-100 shadow-[0_14px_40px_-12px_rgba(6,182,212,0.18)]'
                : 'bg-[#080c20]/45 border border-indigo-500/20 text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.35)]'
          }`}
        >
          {/* Zone 1: Brand with Animated 3D Emblem */}
          <button
            type="button"
            onClick={() => handleAnchor('hero')}
            className="flex items-center gap-2.5 cursor-pointer group shrink-0 rounded-xl px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            aria-label="Angel Companion Home"
          >
            <div
              className={`w-8 h-8 flex items-center justify-center shrink-0 rounded-xl transition-transform duration-300 group-hover:scale-105 ${
                isLight
                  ? 'bg-gradient-to-br from-slate-900 to-indigo-950 ring-1 ring-indigo-300/70 shadow-sm'
                  : ''
              }`}
            >
              <AngelEmblem3D size={isLight ? 26 : 32} rotationSpeed={14} tiltOnHover={true} />
            </div>
            <span className="text-sm sm:text-base font-bold tracking-[0.2em] font-heading">
              ANGEL
            </span>
          </button>

          {/* Zone 2: Desktop Section Navigation with Active Pill Highlight */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleAnchor(link.id)}
                  aria-current={isActive ? 'location' : undefined}
                  className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                    isActive
                      ? isLight
                        ? 'text-blue-700 bg-sky-100/80 border border-sky-300/70 shadow-xs'
                        : 'text-cyan-200 bg-indigo-500/20 border border-cyan-400/30 shadow-[0_0_16px_rgba(56,189,248,0.14)]'
                      : isLight
                        ? 'text-slate-700 hover:text-blue-700 hover:bg-white/70 border border-transparent'
                        : 'text-slate-300 hover:text-cyan-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          {/* Zone 3: Theme + Sign In + Get Started + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${isLight ? 'dark cosmic' : 'cloudy light'} mode`}
              title={`Switch to ${isLight ? 'Cosmic Dark' : 'Cloudy Day'} mode`}
              className={`min-w-[40px] min-h-[40px] p-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                isLight
                  ? 'bg-white/85 hover:bg-white text-slate-700 border border-slate-200/90 shadow-xs'
                  : 'bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 border border-indigo-400/20 hover:border-cyan-400/40'
              }`}
            >
              {isLight ? (
                <Moon className="w-4 h-4 text-indigo-600 transition-transform duration-300 hover:-rotate-12" />
              ) : (
                <Sun className="w-4 h-4 text-amber-300 transition-transform duration-300 hover:rotate-45" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('signin')}
              className={`hidden sm:inline-flex items-center min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                isLight
                  ? 'text-slate-800 bg-white/60 hover:bg-white border border-slate-300/80'
                  : 'text-slate-200 hover:text-white hover:bg-white/10 border border-indigo-400/25 hover:border-cyan-400/40'
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => onNavigate('signup')}
              className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold shadow-[0_6px_22px_rgba(79,70,229,0.4)] hover:shadow-[0_8px_26px_rgba(56,189,248,0.42)] active:scale-[0.98] transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open mobile navigation menu"
              aria-expanded={mobileMenuOpen}
              className={`lg:hidden p-2 rounded-xl transition-all duration-200 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                isLight
                  ? 'bg-white/85 text-slate-800 border border-slate-200'
                  : 'bg-slate-900/65 text-slate-200 border border-indigo-400/25'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* Smooth Slide-Over Mobile Navigation Drawer */}
      <div
        aria-hidden={!mobileMenuOpen}
        className={`fixed inset-0 z-50 lg:hidden flex justify-end transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          className={`relative z-10 w-80 max-w-[85vw] h-full p-5 flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          } ${
            isLight
              ? 'bg-white/95 text-slate-900 border-l border-sky-200 backdrop-blur-2xl'
              : 'bg-[#07091b]/95 text-slate-100 border-l border-indigo-500/25 backdrop-blur-2xl'
          }`}
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-500/20">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 flex items-center justify-center rounded-xl ${
                    isLight ? 'bg-gradient-to-br from-slate-900 to-indigo-950 ring-1 ring-indigo-300/60' : ''
                  }`}
                >
                  <AngelEmblem3D size={isLight ? 26 : 32} rotationSpeed={14} />
                </div>
                <span className="text-base font-bold tracking-[0.2em] font-heading">ANGEL</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close mobile menu"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-500/15 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              {NAV_LINKS.map((link) => {
                const isActive = activeSection === link.id;
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => handleAnchor(link.id)}
                    className={`w-full min-h-[48px] px-4 rounded-2xl text-left text-sm font-semibold transition-all cursor-pointer flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                      isActive
                        ? isLight
                          ? 'bg-sky-100 text-blue-700 border border-sky-300'
                          : 'bg-indigo-500/20 text-cyan-200 border border-cyan-400/35'
                        : isLight
                          ? 'text-slate-700 hover:bg-sky-50 hover:text-blue-700'
                          : 'text-slate-200 hover:bg-white/5 hover:text-cyan-300'
                    }`}
                  >
                    <span>{link.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-500/20">
              <button
                type="button"
                onClick={onToggleTheme}
                className={`w-full min-h-[48px] px-4 rounded-2xl flex items-center justify-between text-xs font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                  isLight ? 'bg-sky-50 text-slate-800 border border-sky-200' : 'bg-slate-900/90 text-slate-200 border border-indigo-500/20'
                }`}
              >
                <span>Appearance</span>
                <span className="inline-flex items-center gap-1.5">
                  {isLight ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-cyan-300" />}
                  <span>{isLight ? 'Cloudy Day' : 'Cosmic Dark'}</span>
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-slate-500/20">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('signin');
              }}
              className={`w-full min-h-[48px] rounded-2xl text-sm font-semibold cursor-pointer border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50'
                  : 'bg-slate-900/80 border-slate-700 text-white hover:bg-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('signup');
              }}
              className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
