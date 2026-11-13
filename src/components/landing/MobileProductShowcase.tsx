import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';
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
  const isLight = theme === 'light';

  const current = MOBILE_SCREENS[selectedIndex];
  const prevScreen = MOBILE_SCREENS[(selectedIndex - 1 + MOBILE_SCREENS.length) % MOBILE_SCREENS.length];
  const nextScreen = MOBILE_SCREENS[(selectedIndex + 1) % MOBILE_SCREENS.length];

  return (
    <section
      id="experience"
      aria-labelledby="mobile-showcase-heading"
      className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-10 lg:gap-12 items-center">
        {/* Left: Copy + Mobile View Selector */}
        <div className="space-y-5 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border border-cyan-400/30 bg-cyan-500/10 text-cyan-400">
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

          {/* Interactive Screen Tabs */}
          <div className="flex flex-wrap justify-center lg:justify-start gap-2 pt-1">
            {MOBILE_SCREENS.map((screen, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={screen.id}
                  type="button"
                  onClick={() => setSelectedIndex(idx)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg'
                      : isLight
                        ? 'bg-white/80 hover:bg-white text-slate-700 border border-slate-200'
                        : 'glass-panel hover:bg-white/10 text-slate-300 border border-indigo-500/20'
                  }`}
                >
                  {screen.label}
                </button>
              );
            })}
          </div>

          <div
            className={`p-4 rounded-2xl border text-left transition-all ${
              isLight
                ? 'bg-white/80 border-slate-200 text-slate-800 shadow-sm'
                : 'glass-panel border-indigo-500/20 text-slate-200'
            }`}
          >
            <h3 className="text-sm font-bold font-heading">{current.title}</h3>
            <p className={`text-xs mt-1 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              {current.description}
            </p>
          </div>
        </div>

        {/* Right: Realistic Multi-Phone 3D Perspective Stage */}
        <div className="relative flex items-center justify-center py-4">
          {/* Ambient glow behind centerpiece device */}
          <div
            className={`absolute w-64 h-64 sm:w-80 sm:h-80 rounded-full blur-3xl pointer-events-none ${
              isLight
                ? 'bg-gradient-to-tr from-sky-300/45 via-indigo-200/40 to-purple-300/40'
                : 'bg-gradient-to-tr from-cyan-500/25 via-indigo-600/20 to-purple-500/25'
            }`}
          />

          {/* Left Flanking Phone (Desktop/Tablet) */}
          <button
            type="button"
            onClick={() => setSelectedIndex((selectedIndex - 1 + MOBILE_SCREENS.length) % MOBILE_SCREENS.length)}
            aria-label={`View ${prevScreen.title}`}
            className="hidden sm:block relative -mr-8 z-0 opacity-65 hover:opacity-90 transition-all duration-300 -rotate-6 scale-90 cursor-pointer"
          >
            <div className="w-[180px] rounded-[32px] p-2 bg-slate-900 border border-slate-700/80 shadow-2xl">
              <div className="rounded-[24px] overflow-hidden aspect-[9/19.5] bg-[#050714]">
                <img src={prevScreen.src} alt={prevScreen.alt} className="w-full h-full object-cover object-top" loading="lazy" />
              </div>
            </div>
          </button>

          {/* Center Hero Realistic Phone Frame */}
          <div className="relative z-10 w-[250px] sm:w-[275px] rounded-[42px] p-2.5 bg-gradient-to-b from-slate-700 via-slate-900 to-slate-800 border border-slate-500/50 shadow-[0_28px_70px_rgba(0,0,0,0.65)] animate-companion-sway">
            {/* Hardware side accents */}
            <div className="w-20 h-4 bg-black rounded-full mx-auto mb-1.5 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-slate-800 border border-slate-700" />
            </div>
            <div className="rounded-[32px] overflow-hidden aspect-[9/19.5] bg-[#050714] border border-slate-800">
              <img
                key={current.id}
                src={current.src}
                alt={current.alt}
                className="w-full h-full object-cover object-top transition-opacity duration-300"
              />
            </div>
          </div>

          {/* Right Flanking Phone (Desktop/Tablet) */}
          <button
            type="button"
            onClick={() => setSelectedIndex((selectedIndex + 1) % MOBILE_SCREENS.length)}
            aria-label={`View ${nextScreen.title}`}
            className="hidden sm:block relative -ml-8 z-0 opacity-65 hover:opacity-90 transition-all duration-300 rotate-6 scale-90 cursor-pointer"
          >
            <div className="w-[180px] rounded-[32px] p-2 bg-slate-900 border border-slate-700/80 shadow-2xl">
              <div className="rounded-[24px] overflow-hidden aspect-[9/19.5] bg-[#050714]">
                <img src={nextScreen.src} alt={nextScreen.alt} className="w-full h-full object-cover object-top" loading="lazy" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};
