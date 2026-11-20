import React, { useEffect, useState } from 'react';
import { Moon, Sun, ArrowRight } from 'lucide-react';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import type { AppRoute, ThemeMode } from '../../services/authValidation';

interface LandingNavProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
  onScrollToSection: (sectionId: string) => void;
}

export const LANDING_NAV_LINKS = [
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
    const sectionIds = LANDING_NAV_LINKS.map((l) => l.id);
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
      { rootMargin: '-22% 0px -55% 0px', threshold: [0.05, 0.25, 0.5] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleAnchor = (id: string) => {
    setActiveSection(id);
    onScrollToSection(id);
  };

  const handleCategoryKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    scopeSelector: string
  ) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const delta = e.key === 'ArrowRight' ? 1 : -1;
    const nextIdx = (index + delta + LANDING_NAV_LINKS.length) % LANDING_NAV_LINKS.length;
    const nextId = LANDING_NAV_LINKS[nextIdx].id;
    handleAnchor(nextId);
    const nextBtn = document.querySelector<HTMLButtonElement>(
      `${scopeSelector} [data-nav-target="${nextId}"]`
    );
    nextBtn?.focus();
  };

  return (
    <header className="sticky top-0 z-40 w-full px-2.5 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-2 transition-all duration-300 backdrop-blur-xl bg-gradient-to-b from-[rgba(7,11,32,0.92)] via-[rgba(7,11,32,0.72)] to-transparent">
      <nav
        aria-label="Primary Public Navigation"
        className={`max-w-7xl mx-auto px-2 sm:px-5 py-2.5 rounded-2xl angel-blurred-surface flex items-center justify-between gap-1 sm:gap-3 transition-all duration-300 backdrop-blur-2xl ${
          isLight
            ? scrolled
              ? 'bg-white/85 text-slate-900 shadow-[0_14px_38px_-12px_rgba(30,64,175,0.16)]'
              : 'bg-white/65 text-slate-900 shadow-[0_10px_30px_-10px_rgba(30,64,175,0.09)]'
            : scrolled
              ? 'bg-[#070b20]/85 text-slate-100 shadow-[0_14px_40px_-12px_rgba(6,182,212,0.18)]'
              : 'bg-[#080c20]/50 text-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.24)]'
        }`}
      >
        {/* Brand with Canonical Continuous 3D Motion Emblem */}
        <button
          type="button"
          onClick={() => handleAnchor('hero')}
          className="flex items-center gap-1 sm:gap-2.5 cursor-pointer group shrink-0 rounded-xl px-0.5 sm:px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
          aria-label="Angel Companion Home"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0 transition-[scale] duration-300 group-hover:scale-110">
            <AngelEmblem3D size={34} seed="landing-hero" renderMode="3d" rotationSpeed={18} tiltOnHover={true} />
          </div>
          <span className="text-xs sm:text-base font-bold tracking-[0.12em] sm:tracking-[0.2em] font-heading">
            ANGEL
          </span>
        </button>

        {/* Single-Row Inline 5 Category Links Across All Screen Widths */}
        <div
          data-nav-strip="true"
          className="flex-1 min-w-0 flex items-center justify-start md:justify-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar pl-0.5 pr-4 md:px-1 [mask-image:linear-gradient(to_right,black_0%,black_calc(100%-18px),transparent_100%)] md:[mask-image:none]"
          role="navigation"
          aria-label="Landing Sections"
        >
          {LANDING_NAV_LINKS.map((link, idx) => {
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                type="button"
                data-nav-target={link.id}
                onClick={() => handleAnchor(link.id)}
                onKeyDown={(e) => handleCategoryKeyDown(e, idx, '[data-nav-strip="true"]')}
                aria-current={isActive ? 'location' : undefined}
                className={`relative shrink-0 px-1.5 sm:px-3.5 py-1 sm:py-2 rounded-xl text-[10px] sm:text-xs font-semibold transition-all duration-300 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                  isActive
                    ? isLight
                      ? 'text-blue-700 bg-sky-100/90 shadow-xs'
                      : 'text-cyan-200 bg-indigo-500/25 shadow-[0_0_18px_rgba(56,189,248,0.2)]'
                    : isLight
                      ? 'text-slate-700 hover:text-blue-700 hover:bg-white/80'
                      : 'text-slate-300 hover:text-cyan-300 hover:bg-white/10'
                }`}
              >
                <span>{link.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Controls: Install App (when eligible), Theme Toggle, Sign In, Get Started */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <PWAInstallButton compact theme={theme} />
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${isLight ? 'dark cosmic' : 'cloudy light'} mode`}
            title={`Switch to ${isLight ? 'Cosmic Dark' : 'Cloudy Day'} mode`}
            className={`min-w-[28px] min-h-[28px] sm:min-w-[38px] sm:min-h-[38px] p-1 sm:p-2 rounded-xl transition-all duration-300 cursor-pointer active:scale-95 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
              isLight
                ? 'bg-white/85 hover:bg-white text-slate-700 shadow-xs'
                : 'bg-slate-900/65 hover:bg-slate-800 text-slate-200 shadow-md'
            }`}
          >
            {isLight ? (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 transition-transform duration-300 hover:-rotate-12" />
            ) : (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 transition-transform duration-300 hover:rotate-45" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate('signin')}
            className={`inline-flex items-center min-h-[28px] sm:min-h-[38px] px-1.5 sm:px-3.5 py-1 sm:py-2 rounded-xl text-[10px] sm:text-xs font-semibold transition-all duration-300 cursor-pointer active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
              isLight
                ? 'text-slate-800 bg-white/75 hover:bg-white shadow-xs'
                : 'text-slate-200 hover:text-white bg-white/5 hover:bg-white/15'
            }`}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => onNavigate('signup')}
            className="inline-flex items-center gap-1 min-h-[28px] sm:min-h-[38px] px-2 sm:px-4 py-1 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-[10px] sm:text-xs font-semibold shadow-[0_6px_22px_rgba(79,70,229,0.4)] hover:shadow-[0_8px_26px_rgba(56,189,248,0.42)] active:scale-[0.98] transition-all duration-300 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <span>Get Started</span>
            <ArrowRight className="hidden sm:inline w-3.5 h-3.5" />
          </button>
        </div>
      </nav>
    </header>
  );
};
