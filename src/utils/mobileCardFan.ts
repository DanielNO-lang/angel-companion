/**
 * Pure fan-deck state, auto-advance gating, and swipe math helpers
 * for the Mobile Product Showcase across any deck size (e.g., 6 phones).
 */

export type FanSlot = 'left' | 'center' | 'right' | 'hidden-left' | 'hidden-right';

export const MOBILE_AUTO_ADVANCE_MS = 4500;
export const MOBILE_INTERACTION_COOLDOWN_MS = 8000;

export function nextCardIndex(currentIndex: number, totalCards: number): number {
  if (totalCards <= 0) return 0;
  return (((currentIndex + 1) % totalCards) + totalCards) % totalCards;
}

export function prevCardIndex(currentIndex: number, totalCards: number): number {
  if (totalCards <= 0) return 0;
  return (((currentIndex - 1) % totalCards) + totalCards) % totalCards;
}

/**
 * Computes shortest circular offset in [-floor(N/2), +ceil(N/2)-1]
 * and maps cards to the visible 3-card fan window ('left', 'center', 'right')
 * while stacking remaining cards cleanly in 'hidden-left' / 'hidden-right' back slots.
 */
export function getCircularCardOffset(
  cardIndex: number,
  activeIndex: number,
  totalCards: number
): number {
  if (totalCards <= 1) return 0;
  let rel = (((cardIndex - activeIndex) % totalCards) + totalCards) % totalCards;
  if (rel > Math.floor(totalCards / 2)) {
    rel -= totalCards;
  }
  return rel;
}

export function getFanSlot(cardIndex: number, activeIndex: number, totalCards: number = 6): FanSlot {
  if (totalCards <= 1) return 'center';
  const offset = getCircularCardOffset(cardIndex, activeIndex, totalCards);
  if (offset === 0) return 'center';
  if (offset === 1) return 'right';
  if (offset === -1) return 'left';
  return offset < 0 ? 'hidden-left' : 'hidden-right';
}

export function resolveHorizontalSwipeDirection(
  deltaX: number,
  deltaY: number,
  thresholdPx: number = 40
): 'next' | 'prev' | null {
  if (Math.abs(deltaX) < thresholdPx) return null;
  if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.1) return null;
  return deltaX < 0 ? 'next' : 'prev';
}

export interface AutoAdvanceState {
  isInViewport: boolean;
  isDocumentHidden: boolean;
  isDragging: boolean;
  isPausedByHoverOrFocus: boolean;
  prefersReducedMotion: boolean;
  nowMs: number;
  pauseUntilMs: number;
}

export function shouldAutoAdvanceCarousel(state: AutoAdvanceState): boolean {
  if (!state.isInViewport) return false;
  if (state.isDocumentHidden) return false;
  if (state.isDragging) return false;
  if (state.prefersReducedMotion) return false;
  return true;
}
