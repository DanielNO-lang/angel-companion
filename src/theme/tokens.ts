/**
 * ANGEL DESIGN SYSTEM TOKENS
 * Extracted directly from the authoritative locked Home screen reference: ANGEL_HOME_APPROVED_REFERENCE.png
 */

export const ANGEL_TOKENS = {
  colors: {
    bg: {
      deepVoid: '#070815',
      cosmicSecondary: '#0b0d21',
      glassPanelDark: 'rgba(14, 18, 42, 0.55)',
      glassPanelLight: 'rgba(255, 255, 255, 0.85)',
      cardHoverDark: 'rgba(24, 30, 68, 0.65)',
    },
    borders: {
      glassSubtle: 'rgba(110, 130, 255, 0.18)',
      glassGlow: 'rgba(138, 110, 255, 0.38)',
      activePill: 'rgba(99, 102, 241, 0.6)',
    },
    brand: {
      angelCyan: '#38bdf8',
      angelIndigo: '#6366f1',
      angelPurple: '#a855f7',
      angelViolet: '#8b5cf6',
      statusGreen: '#22c55e',
      notificationRed: '#ef4444',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      muted: '#64748b',
      accentGlow: '#e0e7ff',
    },
  },
  typography: {
    fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
    headingFont: "'Space Grotesk', -apple-system, sans-serif",
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
    },
  },
  motion: {
    easing: {
      standard: 'cubic-bezier(0.16, 1, 0.3, 1)',
      smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },
    durations: {
      fast: '150ms',
      normal: '250ms',
      slow: '400ms',
      ambientOrb: '6000ms',
    },
  },
  radii: {
    sm: '0.375rem',   // 6px
    md: '0.5rem',      // 8px
    lg: '0.75rem',     // 12px
    xl: '1rem',        // 16px
    '2xl': '1.5rem',   // 24px
    full: '9999px',
  },
  shadows: {
    glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    glowCyan: '0 0 25px rgba(56, 189, 248, 0.25)',
    glowPurple: '0 0 30px rgba(168, 85, 247, 0.3)',
    glowBlue: '0 0 30px rgba(99, 102, 241, 0.35)',
  },
};
