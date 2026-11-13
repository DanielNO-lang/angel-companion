import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Smartphone } from 'lucide-react';
import type { ThemeMode } from '../../services/authValidation';

interface MobileScreenItem {
  id: string;
  label: string;
  title: string;
  description: string;
  src: string;
  alt: string;
}

const MOBILE_SCREENS: MobileScreenItem[] = [
  {
    id: 'mobile-home',
    label: 'Home',
    title: 'Mobile Home Command Center',
    description: 'Immediate access to the animated 3D emblem, quick action chips, universal composer, and activity panels.',
    src: '/assets/showcase/mobile-home.png',
    alt: 'Angel mobile home dashboard screenshot',
  },
  {
    id: 'mobile-conversation',
    label: 'Conversation',
    title: 'Full-Viewport Mobile Conversation',
    description: 'Focused mobile chat surface with voice playback, copy, retry, attachment controls, and speech input.',
    src: '/assets/showcase/mobile-conversation.png',
    alt: 'Angel mobile conversation screen screenshot',
  },
  {
    id: 'mobile-navigation',
    label: 'Navigation',
    title: 'Swipeable Cosmic Drawer',
    description: 'Purpose-built slide-out drawer holding Home, Conversation, Adaptive Workspace, Agents, Studios, and More.',
    src: '/assets/showcase/mobile-navigation.png',
    alt: 'Angel mobile slide-out navigation drawer screenshot',
  },
  {
    id: 'mobile-adaptive',
    label: 'Adaptive',
    title: 'Adaptive Workbench on Mobile',
    description: 'Switch seamlessly between Research, Development, Writing, and Creative Design on compact screens.',
    src: '/assets/showcase/mobile-adaptive-workspace.png',
    alt: 'Angel mobile adaptive workspace screenshot',
  },
  {
    id: 'mobile-studios',
    label: 'Studios',
    title: 'Mobile Studios Environment',
    description: 'Access all 8 specialized Studios and domain-scoped tools cleanly in a two-column mobile grid.',
    src: '/assets/showcase/mobile-studios.png',
    alt: 'Angel mobile studios screenshot',
  },
  {
    id: 'mobile-account',
    label: 'Account',
    title: 'Mobile Account & Session Controls',
    description: 'Quick access to account profile details, Settings, System Status, Help documentation, and Sign Out.',
    src: '/assets/showcase/mobile-account.png',
    alt: 'Angel mobile account popover menu screenshot',
  },
];

interface MobileProductShowcaseProps {
  theme: ThemeMode;
}

export const MobileProductShowcase: React.FC<MobileProductShowcaseProps> = ({ theme }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    MOBILE_SCREENS.forEach((screen) => {
      const img = new window.Image();
      img.src = screen.src;
    });
  }, []);

  const current = MOBILE_SCREENS[selectedIndex];
  const prevIndex = (selectedIndex - 1 + MOBILE_SCREENS.length) % MOBILE_SCREENS.length;
  const nextIndex = (selectedIndex + 1) % MOBILE_SCREENS.length;
  const prevScreen = MOBILE_SCREENS[prevIndex];
  const nextScreen = MOBILE_SCREENS[nextIndex];

  const goPrev = () => setSelectedIndex(prevIndex);
  const goNext = () => setSelectedIndex(nextIndex);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    swipeStartXRef.current = touch.clientX;
    swipeStartYRef.current = touch.clientY;
    setDragOffsetX(0);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (swipeStartXRef.current === null || swipeStartYRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStartXRef.current;
    const dy = touch.clientY - swipeStartYRef.current;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDragOffsetX(Math.max(-56, Math.min(56, dx * 0.45)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (swipeStartXRef.current === null) return;
    const touch = e.changedTouches[0];
    if (touch) {
      const dx = touch.clientX - swipeStartXRef.current;
      if (dx <= -42) {
        goNext();
      } else if (dx >= 42) {
        goPrev();
      }
    }
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    setDragOffsetX(0);
  };

  return (
    <section
      id="experience"
      aria-labelledby="mobile-showcase-heading"
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-8 lg:gap-12 items-center">
        {/* Left: Copy + Touch-Friendly Mobile View Selector */}
        <div className="space-y-5 text-center lg:text-left">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${
              isLight
                ? 'border-sky-300 bg-sky-100/80 text-blue-700'
                : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Responsive Across Every Screen</span>
          </div>

          <h2
            id="mobile-showcase-heading"
            className={`text-2xl sm:text-4xl font-bold font-heading tracking-tight ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            Built for Mobile From the Inside Out
          </h2>

          <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Angel is not a shrunken desktop interface. Its mobile navigation drawer, studios grid, adaptive workbench,
            and full-height composer adapt cleanly for portrait and landscape touch screens.
          </p>

          {/* Interactive Screen Tabs with Comfortable Touch Targets */}
          <div className="flex flex-wrap justify-center lg:justify-start gap-2 pt-1">
            {MOBILE_SCREENS.map((screen, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={screen.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  aria-pressed={active}
                  className={`min-h-[40px] px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-[0_8px_22px_rgba(79,70,229,0.4)] -translate-y-0.5'
                      : isLight
                        ? 'bg-white/75 hover:bg-white text-slate-700 border border-slate-200/90 hover:border-blue-300'
                        : 'landing-glass-card text-slate-300 hover:text-white'
                  }`}
                >
                  {screen.label}
                </button>
              );
            })}
          </div>

          <div
            key={current.id + '-card'}
            className={`animate-landing-reveal landing-glass-card p-4 sm:p-5 rounded-2xl text-left ${
              isLight ? 'text-slate-800' : 'text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold font-heading">{current.title}</h3>
              <span className={`text-[11px] font-mono ${isLight ? 'text-indigo-700' : 'text-cyan-300'}`}>
                {selectedIndex + 1} / {MOBILE_SCREENS.length}
              </span>
            </div>
            <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              {current.description}
            </p>
          </div>
        </div>

        {/* Right: Swipeable Multi-Phone 3D Perspective Stage */}
        <div className="relative flex flex-col items-center justify-center py-2 sm:py-4">
          {/* Ambient glow behind centerpiece device */}
          <div
            className={`absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full blur-3xl pointer-events-none ${
              isLight
                ? 'bg-gradient-to-tr from-sky-300/45 via-indigo-200/40 to-purple-300/40'
                : 'bg-gradient-to-tr from-cyan-500/25 via-indigo-600/20 to-purple-500/25'
            }`}
          />

          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ perspective: '1100px' }}
            className="relative flex items-center justify-center touch-pan-y select-none w-full"
          >
            {/* Left Flanking Phone (Tablet/Desktop only so narrow mobile stays clean & dominant) */}
            <button
              type="button"
              onClick={goPrev}
              aria-label={`View ${prevScreen.title}`}
              className="hidden sm:block relative -mr-8 z-0 opacity-65 hover:opacity-95 transition-all duration-300 -rotate-6 scale-90 hover:-translate-y-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 rounded-[34px]"
            >
              <div className="w-[175px] md:w-[185px] rounded-[32px] p-2 bg-slate-900 border border-slate-700/80 shadow-2xl">
                <div className="rounded-[24px] overflow-hidden aspect-[9/19.5] bg-[#050714]">
                  <img src={prevScreen.src} alt={prevScreen.alt} className="w-full h-full object-cover object-top" loading="lazy" />
                </div>
              </div>
            </button>

            {/* Center Hero Realistic Phone Frame */}
            <div
              style={{
                transform: dragOffsetX !== 0 ? `translateX(${dragOffsetX}px) rotate(${dragOffsetX * 0.06}deg)` : undefined,
                transition: dragOffsetX === 0 ? 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
              }}
              className="relative z-10 w-[238px] sm:w-[272px] rounded-[40px] sm:rounded-[42px] p-2.5 bg-gradient-to-b from-slate-700 via-slate-900 to-slate-800 border border-slate-400/40 shadow-[0_28px_70px_rgba(0,0,0,0.62)] animate-companion-sway"
            >
              {/* Hardware top notch/speaker */}
              <div className="w-20 h-4 bg-black rounded-full mx-auto mb-1.5 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-slate-800 border border-slate-700" />
              </div>
              <div className="relative rounded-[30px] sm:rounded-[32px] overflow-hidden aspect-[9/19.5] bg-[#050714] border border-slate-800">
                {MOBILE_SCREENS.map((screen, idx) => {
                  const isActive = idx === selectedIndex;
                  return (
                    <img
                      key={screen.id}
                      src={screen.src}
                      alt={screen.alt}
                      draggable={false}
                      aria-hidden={!isActive}
                      className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-300 ${
                        isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Right Flanking Phone (Tablet/Desktop only) */}
            <button
              type="button"
              onClick={goNext}
              aria-label={`View ${nextScreen.title}`}
              className="hidden sm:block relative -ml-8 z-0 opacity-65 hover:opacity-95 transition-all duration-300 rotate-6 scale-90 hover:-translate-y-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 rounded-[34px]"
            >
              <div className="w-[175px] md:w-[185px] rounded-[32px] p-2 bg-slate-900 border border-slate-700/80 shadow-2xl">
                <div className="rounded-[24px] overflow-hidden aspect-[9/19.5] bg-[#050714]">
                  <img src={nextScreen.src} alt={nextScreen.alt} className="w-full h-full object-cover object-top" loading="lazy" />
                </div>
              </div>
            </button>
          </div>

          {/* Touch Swipe Pagination Controls */}
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous mobile screen"
              className={`min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center border transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                isLight
                  ? 'bg-white/80 hover:bg-white border-slate-300 text-slate-800'
                  : 'landing-glass-card text-slate-200 hover:text-cyan-300'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5" role="tablist" aria-label="Mobile screens pagination">
              {MOBILE_SCREENS.map((screen, idx) => {
                const active = idx === selectedIndex;
                return (
                  <button
                    key={screen.id + '-dot'}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`Show ${screen.title}`}
                    onClick={() => setSelectedIndex(idx)}
                    className={`h-2 rounded-full transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                      active
                        ? 'w-7 bg-gradient-to-r from-cyan-400 to-indigo-500'
                        : isLight
                          ? 'w-2 bg-slate-300 hover:bg-slate-400'
                          : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={goNext}
              aria-label="Next mobile screen"
              className={`min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center border transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 ${
                isLight
                  ? 'bg-white/80 hover:bg-white border-slate-300 text-slate-800'
                  : 'landing-glass-card text-slate-200 hover:text-cyan-300'
              }`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
