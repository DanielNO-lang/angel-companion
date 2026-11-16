import React, { useEffect, useRef, useState } from 'react';

interface ProgressiveSectionProps {
  id: string;
  minHeightClass?: string;
  forceLoaded?: boolean;
  eager?: boolean;
  rootMargin?: string;
  children: React.ReactNode;
}

/**
 * Progressively activates below-the-fold sections when approaching the viewport
 * or when explicitly requested via sticky header navigation.
 * Keeps the semantic anchor element mounted immediately so anchor jumps and
 * IntersectionObserver scroll highlighting always resolve cleanly, and retains
 * loaded content once activated.
 */
export const ProgressiveSection: React.FC<ProgressiveSectionProps> = ({
  id,
  minHeightClass = 'min-h-[420px]',
  forceLoaded = false,
  eager = false,
  rootMargin = '420px 0px',
  children,
}) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [hasActivated, setHasActivated] = useState<boolean>(Boolean(eager || forceLoaded));

  useEffect(() => {
    if (forceLoaded || eager) {
      setHasActivated(true);
    }
  }, [forceLoaded, eager]);

  useEffect(() => {
    if (hasActivated) return;
    if (typeof IntersectionObserver === 'undefined') {
      setHasActivated(true);
      return;
    }

    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setHasActivated(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasActivated, rootMargin]);

  return (
    <div id={id} ref={sentinelRef} className="scroll-mt-24 sm:scroll-mt-20">
      {hasActivated ? (
        children
      ) : (
        <section
          aria-label={`Loading ${id} section`}
          className={`w-full py-14 sm:py-20 ${minHeightClass} flex items-center justify-center`}
        >
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="landing-glass-card angel-blurred-surface rounded-[32px] p-8 sm:p-12 space-y-5">
              <div className="h-3 w-36 mx-auto rounded-full skeleton-shimmer" />
              <div className="h-8 w-3/4 max-w-md mx-auto rounded-2xl skeleton-shimmer" />
              <div className="h-56 sm:h-72 w-full rounded-3xl skeleton-shimmer" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
