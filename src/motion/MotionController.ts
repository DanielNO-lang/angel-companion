/**
 * ANGEL COORDINATED MOTION ENGINE
 * Defines precise timing, easing curves, and interaction states for interface transitions.
 * Keeps motion state decoupled from business logic.
 */

export const MOTION_TIMINGS = {
  buttonInteractionMs: 180,
  hoverFocusMs: 220,
  cardElevationMs: 300,
  popupTransitionMs: 250,
  pageTransitionMs: 400,
  emblemRotationSeconds: 24,
  orbFloatCycleSeconds: 6,
};

export const MOTION_EASINGS = {
  standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

export const INTERACTION_CLASSES = {
  buttonBase: 'transition-all duration-200 active:scale-95 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-400/50',
  cardBase: 'transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:border-indigo-400/50',
  popupEntrance: 'animate-in fade-in zoom-in-95 duration-200',
  pageEntrance: 'animate-in fade-in duration-300',
  drawerEntrance: 'animate-in slide-in-from-right duration-250',
};
