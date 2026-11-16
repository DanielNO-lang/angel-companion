import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { ThemeMode } from '../../services/authValidation';
import { SmartImage } from '../ui/SmartImage';
import { AngelEmblem3D } from '../branding/AngelEmblem3D';
import {
  getCircularCardOffset,
  getFanSlot,
  MOBILE_AUTO_ADVANCE_MS,
  MOBILE_INTERACTION_COOLDOWN_MS,
  nextCardIndex,
  prevCardIndex,
  resolveHorizontalSwipeDirection,
  shouldAutoAdvanceCarousel,
  type FanSlot,
} from '../../utils/mobileCardFan';

export type SmartphoneChassisVariant =
  | 'capsule-island'
  | 'razor-pinhole'
  | 'horizon-visor'
  | 'arch-teardrop'
  | 'chamfer-slate'
  | 'sculpted-glass';

export interface MobileShowcaseExperience {
  id: string;
  chassis: SmartphoneChassisVariant;
  experienceName: string;
  title: string;
  description: string;
  highlights: string[];
  src: string;
  alt: string;
}

export const MOBILE_EXPERIENCES: MobileShowcaseExperience[] = [
  {
    id: 'mobile-home',
    chassis: 'capsule-island',
    experienceName: 'Home',
    title: 'Instant Access to Your Companion',
    description:
      'Launch conversations, jump straight into quick actions, or trigger specialized Studios from a touch-first cosmic home.',
    highlights: ['Touch-optimized Universal Composer', 'Continuous 3D Angel Emblem', 'Zero desktop clutter'],
    src: '/assets/showcase/mobile-home.png',
    alt: 'Angel Companion mobile Home experience preview',
  },
  {
    id: 'mobile-conversation',
    chassis: 'razor-pinhole',
    experienceName: 'Conversation',
    title: 'Voice, Context & Reasoning on the Move',
    description:
      'Focused thread view tailored for handheld screens with one-tap dictation, spoken replies, attachments, and Think Mode.',
    highlights: ['Multi-turn context resolution', 'Voice dictation & playback', 'File & link preview cards'],
    src: '/assets/showcase/mobile-conversation.png',
    alt: 'Angel Companion mobile Conversation experience preview',
  },
  {
    id: 'mobile-navigation',
    chassis: 'horizon-visor',
    experienceName: 'Navigation',
    title: 'Fluid Slide-Over Workspace Switching',
    description:
      'Switch effortlessly across General Conversations, Adaptive Workspace, Agents, Studios, and Knowledge Library with thumb-friendly controls.',
    highlights: ['Thumb-reachable drawer layout', 'Instant recent-thread resume', 'Clear active route indicator'],
    src: '/assets/showcase/mobile-navigation.png',
    alt: 'Angel Companion mobile Navigation drawer experience preview',
  },
  {
    id: 'mobile-adaptive-workspace',
    chassis: 'arch-teardrop',
    experienceName: 'Adaptive Workspace',
    title: 'Task-Shaped Workbenches in One Hand',
    description:
      'Inspect and refine research syntheses, drafts, plans, and code documents directly on mobile without losing workspace context.',
    highlights: ['4 adaptive workbench modes', 'Live working canvas panel', 'Direct project & library saving'],
    src: '/assets/showcase/mobile-adaptive-workspace.png',
    alt: 'Angel Companion mobile Adaptive Workspace experience preview',
  },
  {
    id: 'mobile-studios',
    chassis: 'chamfer-slate',
    experienceName: 'Studios',
    title: 'All Eight Studios Inside Your Pocket',
    description:
      'Move cleanly between Research, Development, Creative, and domain-scoped Studios while preserving strict workspace boundaries.',
    highlights: ['8 isolated domain Studios', 'Dedicated Studio tools', 'Project-linked resource panel'],
    src: '/assets/showcase/mobile-studios.png',
    alt: 'Angel Companion mobile Studios experience preview',
  },
  {
    id: 'mobile-account',
    chassis: 'sculpted-glass',
    experienceName: 'Account',
    title: 'Verified Identity & Session Clarity',
    description:
      'Manage verified sign-in identities, security sessions, theme preferences, and connected workspace controls transparently.',
    highlights: ['Verified identity session controls', 'Unlink lockout safeguards', 'Consistent Cloudy Day & Cosmic Dark themes'],
    src: '/assets/showcase/mobile-account.png',
    alt: 'Angel Companion mobile Account experience preview',
  },
];

interface ChassisGeometryStyle {
  outerRadius: string;
  innerRadius: string;
  frameGradient: string;
  sideButtons: 'standard-pill' | 'right-cluster' | 'dual-rocker' | 'flush-titanium' | 'chamfer-action' | 'symmetric-edge';
  cameraSilhouette: React.ReactNode;
}

function getChassisGeometry(variant: SmartphoneChassisVariant): ChassisGeometryStyle {
  switch (variant) {
    case 'capsule-island':
      return {
        outerRadius: 'rounded-[40px]',
        innerRadius: 'rounded-[32px]',
        frameGradient: 'bg-gradient-to-b from-zinc-500 via-zinc-900 to-zinc-800 p-[8px]',
        sideButtons: 'standard-pill',
        cameraSilhouette: (
          <div
            aria-hidden="true"
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-[64px] h-[16px] rounded-full bg-black flex items-center justify-end px-2 shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-sky-950 ring-1 ring-slate-700/70" />
          </div>
        ),
      };
    case 'razor-pinhole':
      return {
        outerRadius: 'rounded-[18px]',
        innerRadius: 'rounded-[12px]',
        frameGradient: 'bg-gradient-to-b from-slate-500 via-slate-900 to-zinc-900 p-[6px]',
        sideButtons: 'right-cluster',
        cameraSilhouette: (
          <div
            aria-hidden="true"
            className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 w-2.5 h-2.5 rounded-full bg-black ring-1 ring-slate-600/70"
          />
        ),
      };
    case 'horizon-visor':
      return {
        outerRadius: 'rounded-[30px]',
        innerRadius: 'rounded-[23px]',
        frameGradient: 'bg-gradient-to-b from-stone-600 via-neutral-900 to-slate-800 p-[8px]',
        sideButtons: 'dual-rocker',
        cameraSilhouette: (
          <div
            aria-hidden="true"
            className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-[52px] h-[11px] rounded-full bg-black/95 flex items-center justify-between px-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-950" />
            <span className="w-4 h-[2px] rounded-full bg-slate-700/70" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
          </div>
        ),
      };
    case 'arch-teardrop':
      return {
        outerRadius: 'rounded-[34px]',
        innerRadius: 'rounded-[27px]',
        frameGradient: 'bg-gradient-to-b from-slate-400 via-slate-800 to-slate-900 p-[7px]',
        sideButtons: 'flush-titanium',
        cameraSilhouette: (
          <div
            aria-hidden="true"
            className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-9 h-4 rounded-b-xl bg-black flex items-center justify-center"
          >
            <span className="w-2 h-2 rounded-full bg-indigo-950 ring-1 ring-slate-600/60" />
          </div>
        ),
      };
    case 'chamfer-slate':
      return {
        outerRadius: 'rounded-[24px]',
        innerRadius: 'rounded-[18px]',
        frameGradient: 'bg-gradient-to-br from-slate-600 via-zinc-900 to-indigo-950 p-[8px]',
        sideButtons: 'chamfer-action',
        cameraSilhouette: (
          <div
            aria-hidden="true"
            className="absolute top-2.5 right-4 z-20 w-6 h-2.5 rounded-full bg-black flex items-center justify-around px-1"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="w-1.5 h-1.5 rounded-full bg-sky-900" />
          </div>
        ),
      };
    case 'sculpted-glass':
    default:
      return {
        outerRadius: 'rounded-[38px]',
        innerRadius: 'rounded-[31px]',
        frameGradient: 'bg-gradient-to-b from-indigo-400/70 via-slate-900 to-slate-800 p-[8px]',
        sideButtons: 'symmetric-edge',
        cameraSilhouette: (
          <div
            aria-hidden="true"
            className="absolute top-2.5 left-4 z-20 flex items-center gap-1.5 bg-black/90 px-1.5 py-0.5 rounded-full"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-950 ring-1 ring-slate-600/70" />
          </div>
        ),
      };
  }
}

interface PhoneHardwareFrameProps {
  card: MobileShowcaseExperience;
  slot: FanSlot;
  shouldRenderMedia: boolean;
  isActive: boolean;
  onSelect: () => void;
  isLight: boolean;
}

const PhoneHardwareFrame: React.FC<PhoneHardwareFrameProps> = ({
  card,
  slot,
  shouldRenderMedia,
  isActive,
  onSelect,
  isLight,
}) => {
  const geom = getChassisGeometry(card.chassis);

  let slotTransformClass = '';
  if (slot === 'center') {
    slotTransformClass =
      'z-30 translate-x-0 translate-y-0 rotate-0 scale-100 opacity-100 pointer-events-auto';
  } else if (slot === 'left') {
    slotTransformClass =
      'z-20 -translate-x-[38%] sm:-translate-x-[58%] translate-y-3 sm:translate-y-4 -rotate-[10deg] scale-[0.82] sm:scale-[0.85] opacity-85 hover:opacity-95 hover:-translate-y-1 cursor-pointer pointer-events-auto';
  } else if (slot === 'right') {
    slotTransformClass =
      'z-20 translate-x-[38%] sm:translate-x-[58%] translate-y-3 sm:translate-y-4 rotate-[10deg] scale-[0.82] sm:scale-[0.85] opacity-85 hover:opacity-95 hover:-translate-y-1 cursor-pointer pointer-events-auto';
  } else if (slot === 'hidden-left') {
    slotTransformClass =
      'z-10 -translate-x-[72%] translate-y-8 -rotate-[18deg] scale-[0.68] opacity-0 pointer-events-none';
  } else {
    slotTransformClass =
      'z-10 translate-x-[72%] translate-y-8 rotate-[18deg] scale-[0.68] opacity-0 pointer-events-none';
  }

  return (
    <div
      data-phone-chassis={card.chassis}
      data-fan-slot={slot}
      aria-current={isActive ? 'true' : undefined}
      aria-hidden={slot === 'hidden-left' || slot === 'hidden-right'}
      className={`mobile-fan-card absolute w-[184px] sm:w-[224px] select-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${geom.outerRadius} ${slotTransformClass}`}
    >
      {!isActive && (slot === 'left' || slot === 'right') && (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Focus ${card.experienceName} mobile experience`}
          className={`absolute inset-0 z-40 w-full h-full bg-transparent border-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${geom.outerRadius}`}
        />
      )}

      {/* Subtle depth aura under foreground phone */}
      {isActive && (
        <div
          aria-hidden="true"
          className={`absolute -inset-6 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
            isLight
              ? 'bg-gradient-to-tr from-sky-400/35 via-indigo-300/25 to-purple-400/30'
              : 'bg-gradient-to-tr from-cyan-400/30 via-indigo-500/25 to-purple-500/30'
          }`}
        />
      )}

      {/* Distinct Smartphone Hardware Body */}
      <div
        className={`relative ${geom.outerRadius} ${geom.frameGradient} ${
          isActive
            ? 'shadow-[0_28px_72px_-12px_rgba(2,6,23,0.78),0_0_32px_rgba(56,189,248,0.22)]'
            : 'shadow-[0_20px_50px_-14px_rgba(2,6,23,0.65)]'
        }`}
      >
        {/* Distinct Side Button Silhouettes per Device */}
        {geom.sideButtons === 'right-cluster' ? (
          <>
            <span aria-hidden="true" className="absolute -right-[2px] top-16 w-[2px] h-12 rounded-r bg-slate-400/60" />
            <span aria-hidden="true" className="absolute -right-[2px] top-32 w-[2px] h-7 rounded-r bg-slate-400/60" />
          </>
        ) : geom.sideButtons === 'dual-rocker' ? (
          <>
            <span aria-hidden="true" className="absolute -left-[2px] top-20 w-[2px] h-8 rounded-l bg-amber-300/40" />
            <span aria-hidden="true" className="absolute -right-[2px] top-24 w-[2px] h-11 rounded-r bg-slate-400/60" />
          </>
        ) : geom.sideButtons === 'chamfer-action' ? (
          <>
            <span aria-hidden="true" className="absolute -left-[2px] top-16 w-[2px] h-4 rounded-l bg-cyan-400/50" />
            <span aria-hidden="true" className="absolute -left-[2px] top-24 w-[2px] h-10 rounded-l bg-slate-400/55" />
            <span aria-hidden="true" className="absolute -right-[2px] top-28 w-[2px] h-10 rounded-r bg-slate-400/55" />
          </>
        ) : (
          <>
            <span aria-hidden="true" className="absolute -right-[2px] top-24 w-[2px] h-10 rounded-r bg-slate-500/60" />
            <span aria-hidden="true" className="absolute -left-[2px] top-20 w-[2px] h-7 rounded-l bg-slate-500/55" />
          </>
        )}

        {/* Screen Cavity */}
        <div className={`relative ${geom.innerRadius} overflow-hidden aspect-[9/19.5] bg-[#040714]`}>
          {geom.cameraSilhouette}

          {shouldRenderMedia ? (
            <SmartImage
              src={card.src}
              alt={card.alt}
              priority={isActive ? 'high' : 'normal'}
              aspectRatioClass="w-full h-full"
              imgClassName={`object-cover object-top transition-transform duration-500 ${
                isActive ? 'scale-100' : 'scale-[0.98]'
              }`}
              placeholderLabel={`Loading ${card.experienceName}...`}
            />
          ) : (
            <div className="w-full h-full bg-[#06091c]" aria-hidden="true" />
          )}

          {/* Subtle bottom gesture bar indicator inside screen */}
          <div
            aria-hidden="true"
            className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 w-16 h-1 rounded-full bg-white/35"
          />
        </div>
      </div>

      {/* Screen experience label below foreground device — no manufacturer names */}
      <div className="mt-2.5 text-center pointer-events-none">
        <span
          className={`text-[11px] font-semibold tracking-wide transition-opacity duration-300 ${
            isActive
              ? isLight
                ? 'text-indigo-700 opacity-100'
                : 'text-cyan-300 opacity-100'
              : 'opacity-0'
          }`}
        >
          {card.experienceName}
        </span>
      </div>
    </div>
  );
};

interface MobileProductShowcaseProps {
  theme: ThemeMode;
}

export const MobileProductShowcase: React.FC<MobileProductShowcaseProps> = ({ theme }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedSet, setLoadedSet] = useState<Set<number>>(() => new Set([0, 1, MOBILE_EXPERIENCES.length - 1]));
  const [isInViewport, setIsInViewport] = useState(false);
  const [isPausedHoverFocus, setIsPausedHoverFocus] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const suppressNextClickRef = useRef<boolean>(false);
  const pauseUntilRef = useRef<number>(0);

  const isLight = theme === 'light';
  const activeCard = MOBILE_EXPERIENCES[activeIndex] || MOBILE_EXPERIENCES[0];

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  // Progressively mark current + immediate neighbor phone images as eligible to load
  useEffect(() => {
    setLoadedSet((prev) => {
      const next = new Set(prev);
      next.add(activeIndex);
      next.add(nextCardIndex(activeIndex, MOBILE_EXPERIENCES.length));
      next.add(prevCardIndex(activeIndex, MOBILE_EXPERIENCES.length));
      return next.size === prev.size ? prev : next;
    });
  }, [activeIndex]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setIsInViewport(Boolean(entries[0]?.isIntersecting));
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const markManualInteraction = useCallback(() => {
    pauseUntilRef.current = Date.now() + MOBILE_INTERACTION_COOLDOWN_MS;
  }, []);

  const handleNext = useCallback(
    (manual = true) => {
      if (manual) markManualInteraction();
      setActiveIndex((prev) => nextCardIndex(prev, MOBILE_EXPERIENCES.length));
    },
    [markManualInteraction]
  );

  const handlePrev = useCallback(
    (manual = true) => {
      if (manual) markManualInteraction();
      setActiveIndex((prev) => prevCardIndex(prev, MOBILE_EXPERIENCES.length));
    },
    [markManualInteraction]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      const okToAdvance = shouldAutoAdvanceCarousel({
        isInViewport,
        isDocumentHidden: typeof document !== 'undefined' ? document.hidden : false,
        isDragging: Boolean(pointerStartRef.current),
        isPausedByHoverOrFocus: isPausedHoverFocus,
        prefersReducedMotion,
        nowMs: Date.now(),
        pauseUntilMs: pauseUntilRef.current,
      });
      if (okToAdvance) {
        setActiveIndex((prev) => nextCardIndex(prev, MOBILE_EXPERIENCES.length));
      }
    }, MOBILE_AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [isInViewport, isPausedHoverFocus, prefersReducedMotion]);

  const handleSectionPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    suppressNextClickRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  const handleSectionPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dir = resolveHorizontalSwipeDirection(dx, dy, 38);
    if (dir === 'next') {
      suppressNextClickRef.current = true;
      handleNext(true);
    } else if (dir === 'prev') {
      suppressNextClickRef.current = true;
      handlePrev(true);
    }
  };

  const handleSectionClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (suppressNextClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressNextClickRef.current = false;
    }
  };

  const handleDeckKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext(true);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev(true);
    }
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby="mobile-showcase-heading"
      onPointerDown={handleSectionPointerDown}
      onPointerUp={handleSectionPointerUp}
      onPointerCancel={() => {
        pointerStartRef.current = null;
      }}
      onClickCapture={handleSectionClickCapture}
      style={{ touchAction: 'pan-y' }}
      className="landing-section-mobile relative w-full py-16 sm:py-24 overflow-hidden select-none"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10 sm:mb-14">
          <div className="inline-flex items-center justify-center gap-2">
            <AngelEmblem3D size={22} seed="landing-mobile-mark" renderMode="svg" rotationSpeed={14} />
            <p
              className={`text-xs font-bold uppercase tracking-[0.24em] font-heading ${
                isLight ? 'text-indigo-700' : 'text-cyan-300'
              }`}
            >
              Mobile Native Architecture
            </p>
          </div>

          <h2
            id="mobile-showcase-heading"
            className={`text-2xl sm:text-4xl font-bold font-heading tracking-tight ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            Built for mobile from the inside out!
          </h2>

          <p className={`text-sm sm:text-base leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Swipe anywhere across the showcase to explore Home, Conversation, Navigation, Adaptive Workspace, Studios, and Account.
          </p>
        </div>

        {/* 3-Card Visible Playing-Card Fan Window Cycling Through All 6 Experiences */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 xl:gap-16 items-center max-w-6xl mx-auto">
          {/* Playing-Card Fan Stage */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div
              role="region"
              aria-roledescription="carousel"
              aria-label="Mobile experience showcase across six Angel views"
              tabIndex={0}
              onKeyDown={handleDeckKeyDown}
              onFocus={() => setIsPausedHoverFocus(true)}
              onBlur={() => setIsPausedHoverFocus(false)}
              className="relative w-full max-w-[540px] h-[445px] sm:h-[520px] mx-auto flex items-center justify-center cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80 rounded-3xl"
            >
              {MOBILE_EXPERIENCES.map((card, idx) => {
                const slot = getFanSlot(idx, activeIndex, MOBILE_EXPERIENCES.length);
                const circularDist = Math.abs(
                  getCircularCardOffset(idx, activeIndex, MOBILE_EXPERIENCES.length)
                );
                const shouldRenderMedia = circularDist <= 1 || loadedSet.has(idx);
                return (
                  <PhoneHardwareFrame
                    key={card.id}
                    card={card}
                    slot={slot}
                    shouldRenderMedia={shouldRenderMedia}
                    isActive={idx === activeIndex}
                    onSelect={() => {
                      markManualInteraction();
                      setActiveIndex(idx);
                    }}
                    isLight={isLight}
                  />
                );
              })}
            </div>

            {/* Clean Pagination Indicators (Automatic Cycling + Touch Swipe / Side Card Tap) */}
            <div className="mt-4 flex items-center justify-center">
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Select mobile showcase screen">
                {MOBILE_EXPERIENCES.map((card, idx) => {
                  const isSelected = idx === activeIndex;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      aria-label={`Experience ${idx + 1}: ${card.experienceName}`}
                      onClick={() => {
                        markManualInteraction();
                        setActiveIndex(idx);
                      }}
                      className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                        isSelected
                          ? 'w-7 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 shadow-[0_0_12px_rgba(56,189,248,0.6)]'
                          : isLight
                            ? 'w-2.5 bg-slate-400/50 hover:bg-slate-600/70'
                            : 'w-2.5 bg-slate-600/70 hover:bg-cyan-400/60'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Experience Atmospheric Detail Panel */}
          <div className="lg:col-span-5">
            <div
              key={activeCard.id}
              className={`landing-glass-card angel-blurred-surface rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 space-y-5 animate-landing-reveal select-text ${
                isLight ? 'text-slate-900' : 'text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      isLight
                        ? 'bg-sky-100/90 text-indigo-600'
                        : 'bg-cyan-500/15 text-cyan-300 shadow-[0_0_18px_rgba(56,189,248,0.22)]'
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p
                      className={`text-[11px] font-bold uppercase tracking-[0.2em] ${
                        isLight ? 'text-indigo-700' : 'text-cyan-300'
                      }`}
                    >
                      Mobile View • {activeCard.experienceName}
                    </p>
                    <h3 className="text-lg sm:text-xl font-bold font-heading mt-0.5">
                      {activeCard.title}
                    </h3>
                  </div>
                </div>
              </div>

              <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                {activeCard.description}
              </p>

              <ul className="space-y-2.5 pt-1">
                {activeCard.highlights.map((item) => (
                  <li
                    key={item}
                    className={`flex items-center gap-2.5 text-xs font-medium ${
                      isLight ? 'text-slate-700' : 'text-slate-200'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.85)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-2 flex items-center justify-between text-xs font-semibold opacity-80">
                <span>
                  Experience {activeIndex + 1} of {MOBILE_EXPERIENCES.length}
                </span>
                <span className={isLight ? 'text-indigo-600' : 'text-cyan-300'}>
                  Swipe anywhere or tap side phones
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
