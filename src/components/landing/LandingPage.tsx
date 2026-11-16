import React, { useCallback, useState } from 'react';
import { LandingNav } from './LandingNav';
import { LandingHero } from './LandingHero';
import { CapabilitiesShowcase } from './CapabilitiesShowcase';
import { MobileProductShowcase } from './MobileProductShowcase';
import { ArchitectureAndSymbolism } from './ArchitectureAndSymbolism';
import { PrivacyClosingFooter } from './PrivacyClosingFooter';
import { ProgressiveSection } from '../ui/ProgressiveSection';
import type { AppRoute, ThemeMode } from '../../services/authValidation';

interface LandingPageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  theme,
  onToggleTheme,
  onNavigate,
}) => {
  const [forcedSections, setForcedSections] = useState<Record<string, boolean>>({});

  const scrollToSection = useCallback((sectionId: string) => {
    setForcedSections((prev) => (prev[sectionId] ? prev : { ...prev, [sectionId]: true }));

    const performScroll = () => {
      const el = document.getElementById(sectionId);
      if (!el) return;
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    };

    if (typeof window !== 'undefined') {
      requestAnimationFrame(performScroll);
    }
  }, []);

  return (
    <div className="landing-scope relative z-10 min-h-screen w-full overflow-x-clip">
      <LandingNav
        theme={theme}
        onToggleTheme={onToggleTheme}
        onNavigate={onNavigate}
        onScrollToSection={scrollToSection}
      />

      <main>
        <LandingHero
          theme={theme}
          onNavigate={onNavigate}
          onExplore={() => scrollToSection('capabilities')}
        />

        <ProgressiveSection
          id="capabilities"
          eager={true}
          forceLoaded={Boolean(forcedSections.capabilities)}
          minHeightClass="min-h-[540px]"
        >
          <CapabilitiesShowcase theme={theme} />
        </ProgressiveSection>

        <ProgressiveSection
          id="experience"
          forceLoaded={Boolean(forcedSections.experience)}
          minHeightClass="min-h-[620px]"
        >
          <MobileProductShowcase theme={theme} />
        </ProgressiveSection>

        <ProgressiveSection
          id="about"
          forceLoaded={Boolean(forcedSections.about)}
          minHeightClass="min-h-[680px]"
        >
          <ArchitectureAndSymbolism theme={theme} />
        </ProgressiveSection>

        <ProgressiveSection
          id="privacy"
          eager={true}
          forceLoaded={Boolean(forcedSections.privacy)}
          minHeightClass="min-h-[540px]"
        >
          <PrivacyClosingFooter
            theme={theme}
            onNavigate={onNavigate}
            onScrollToSection={scrollToSection}
          />
        </ProgressiveSection>
      </main>
    </div>
  );
};
