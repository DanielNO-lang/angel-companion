import React from 'react';
import { LandingNav } from './LandingNav';
import { LandingHero } from './LandingHero';
import { CapabilitiesShowcase } from './CapabilitiesShowcase';
import { MobileProductShowcase } from './MobileProductShowcase';
import { ArchitectureAndSymbolism } from './ArchitectureAndSymbolism';
import { PrivacyClosingFooter } from './PrivacyClosingFooter';
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
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="relative z-10 min-h-screen w-full overflow-x-hidden">
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
        <CapabilitiesShowcase theme={theme} />
        <MobileProductShowcase theme={theme} />
        <ArchitectureAndSymbolism theme={theme} />
        <PrivacyClosingFooter
          theme={theme}
          onNavigate={onNavigate}
          onScrollToSection={scrollToSection}
        />
      </main>
    </div>
  );
};
