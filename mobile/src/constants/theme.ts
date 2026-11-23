const ColorsData = require('./colors');

export interface ThemeTokens {
  brand: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    onPrimary: string;
  };
  surface: {
    background: string;
    card: string;
    border: string;
    muted: string;
    elevated: string;
  };
  content: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  accent: {
    sunshine: string;
    sunshineLight: string;
    sunshineDark: string;
    sunshineForeground: string;
  };
  status: {
    success: string;
    successLight: string;
    warning: string;
    warningLight: string;
    danger: string;
    dangerLight: string;
    info: string;
    infoLight: string;
  };
  tabBar: {
    background: string;
    border: string;
    activeTint: string;
    activeBackground: string;
    inactiveTint: string;
  };
}

/**
 * Centralized Design Tokens for the Enterprise HR Mobile App.
 * Driven directly by `colors.js` — the SINGLE file where all mobile colors are configured!
 */
export const ThemeConfig: ThemeTokens = ColorsData;
export type AppTheme = typeof ThemeConfig;

// Backwards-compatible Colors export for any legacy template references
export const Colors = {
  light: {
    text: ThemeConfig.content.primary,
    background: ThemeConfig.surface.background,
    backgroundElement: ThemeConfig.brand.primaryLight,
    backgroundSelected: ThemeConfig.surface.border,
    textSecondary: ThemeConfig.content.secondary,
  },
  dark: {
    text: '#FFFFFF',
    background: '#0F172A',
    backgroundElement: '#1E293B',
    backgroundSelected: '#334155',
    textSecondary: '#94A3B8',
  },
} as const;
