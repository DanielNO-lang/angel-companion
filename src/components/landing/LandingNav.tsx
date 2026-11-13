import React, { useState } from 'react';
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
  const isLight = theme === 'light';

  const handleAnchor = (id: string) => {
    setMobileMenuOpen(false);
    onScrollToSection(id);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full px-3 sm:px-6 lg:px-8 pt-3 pb-2">
        <nav
          aria-label="Primary Public Navigation"
          className={`max-w-7xl mx-auto px-4 sm:px-5 py-2.5 rounded-2xl flex items-center justify-between gap-4 transition-all ${
            isLight
              ? 'glass-panel border border-white/80 text-slate-900'
              : 'glass-panel border border-indigo-500/20 text-slate-100'
          }`}
        >
          {/* Zone 1: Brand with Animated 3D Emblem */}
          <button
            type="button"
            onClick={() => handleAnchor('hero')}
            className="flex items-center gap-2.5 cursor-pointer group shrink-0"
            aria-label="Angel Companion Home"
          >
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <AngelEmblem3D size={32} rotationSpeed={14} tiltOnHover={true} />
            </div>
            <span className="text-base font-bold tracking-[0.2em] font-heading">
              ANGEL
            </span>
          </button>

          {/* Zone 2: Desktop Section Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleAnchor(link.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isLight
                    ? 'text-slate-700 hover:text-blue-700 hover:bg-white/60'
                    : 'text-slate-300 hover:text-cyan-300 hover:bg-white/5'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Zone 3: Theme + Sign In + Get Started + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${isLight ? 'dark cosmic' : 'cloudy light'} mode`}
              title={`Switch to ${isLight ? 'Cosmic Dark' : 'Cloudy Day'} mode`}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200'
                  : 'bg-slate-900/60 hover:bg-slate-800 text-slate-200 border border-slate-700/60'
              }`}
            >
              {isLight ? (
                <Moon className="w-4 h-4 text-indigo-600" />
              ) : (
                <Sun className="w-4 h-4 text-amber-300" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('signin')}
              className={`hidden sm:inline-flex items-center px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                isLight
                  ? 'text-slate-800 hover:bg-white/80 border border-slate-300/80'
                  : 'text-slate-200 hover:text-white hover:bg-white/10 border border-slate-700/70'
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => onNavigate('signup')}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-semibold shadow-[0_6px_20px_rgba(79,70,229,0.4)] transition-all cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open mobile navigation menu"
              className={`lg:hidden p-2 rounded-xl transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center ${
                isLight
                  ? 'bg-white/80 text-slate-800 border border-slate-200'
                  : 'bg-slate-900/60 text-slate-200 border border-slate-700/70'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </nav>
      </header>

      {/* Purpose-Designed Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Mobile Navigation Menu"
            className={`relative z-10 w-80 max-w-[85vw] h-full p-5 flex flex-col justify-between shadow-2xl ${
              isLight
                ? 'bg-white/95 text-slate-900 border-l border-slate-200'
                : 'bg-[#07091b]/95 text-slate-100 border-l border-indigo-500/25 backdrop-blur-2xl'
            }`}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-500/20">
                <div className="flex items-center gap-2.5">
                  <AngelEmblem3D size={32} rotationSpeed={14} />
                  <span className="text-base font-bold tracking-[0.2em] font-heading">ANGEL</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close mobile menu"
                  className="p-2 rounded-xl hover:bg-slate-500/15 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1.5">
                {NAV_LINKS.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => handleAnchor(link.id)}
                    className={`w-full min-h-[46px] px-4 rounded-2xl text-left text-sm font-semibold transition-colors cursor-pointer ${
                      isLight
                        ? 'text-slate-700 hover:bg-sky-50 hover:text-blue-700'
                        : 'text-slate-200 hover:bg-white/5 hover:text-cyan-300'
                    }`}
                  >
                    {link.label}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-500/20">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className={`w-full min-h-[46px] px-4 rounded-2xl flex items-center justify-between text-xs font-semibold cursor-pointer ${
                    isLight ? 'bg-slate-100 text-slate-800' : 'bg-slate-900 text-slate-200'
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
                className={`w-full min-h-[48px] rounded-2xl text-sm font-semibold cursor-pointer border ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-slate-900/80 border-slate-700 text-white'
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
                className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
