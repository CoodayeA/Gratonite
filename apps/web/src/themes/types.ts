/**
 * Theme system type definitions.
 * Every ThemeDefinition must provide ALL variable keys — missing keys are a compile error.
 */

export type ThemeCategory =
  | 'dark'
  | 'light'
  | 'colorful'
  | 'minimal'
  | 'retro'
  | 'nature'
  | 'developer'
  | 'accessibility';

export interface ThemeVariables {
  // Color scheme
  colorScheme: 'dark' | 'light';

  // Background surfaces
  bgApp: string;
  bgSidebar: string;
  bgChannel: string;
  bgRail: string;
  bgPrimary: string;
  bgElevated: string;
  bgTertiary: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Accent colors
  accentBluelight: string;
  accentBlue: string;
  accentPurple: string;
  accentPink: string;

  // Overlays
  stroke: string;
  strokeLight: string;
  hoverOverlay: string;
  activeOverlay: string;

  // Typography
  fontSans: string;
  fontDisplay: string;

  // Primary accent (HSL decomposed)
  accentPrimaryH: number;
  accentPrimaryS: string;
  accentPrimaryL: string;
  accentPrimary: string;
  accentHover: string;
  accentPrimaryAlpha: string;
  strokeSubtle: string;

  // Structural tokens
  borderStructural: string;
  borderFocused: string;
  shadowPanel: string;
  shadowHover: string;
  panelBlur: string;

  // Semantic
  success: string;
  error: string;
  warning: string;

  // Radii
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  category: ThemeCategory;
  author: string;
  isDark: boolean;
  /** Preview colors for theme cards */
  preview: {
    bg: string;
    sidebar: string;
    accent: string;
    text: string;
  };
  /** Dark mode variables */
  dark: ThemeVariables;
  /** Light mode variables (inverted palette) */
  light: ThemeVariables;
  /** Suggested code syntax highlighting theme */
  suggestedCodeTheme?: string;
}

/** Map from CSS custom property name to ThemeVariables key */
export const CSS_VAR_MAP: Record<keyof ThemeVariables, string> = {
  colorScheme: 'color-scheme',
  bgApp: '--bg-app',
  bgSidebar: '--bg-sidebar',
  bgChannel: '--bg-channel',
  bgRail: '--bg-rail',
  bgPrimary: '--bg-primary',
  bgElevated: '--bg-elevated',
  bgTertiary: '--bg-tertiary',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  accentBluelight: '--accent-bluelight',
  accentBlue: '--accent-blue',
  accentPurple: '--accent-purple',
  accentPink: '--accent-pink',
  stroke: '--stroke',
  strokeLight: '--stroke-light',
  hoverOverlay: '--hover-overlay',
  activeOverlay: '--active-overlay',
  fontSans: '--font-sans',
  fontDisplay: '--font-display',
  accentPrimaryH: '--accent-primary-h',
  accentPrimaryS: '--accent-primary-s',
  accentPrimaryL: '--accent-primary-l',
  accentPrimary: '--accent-primary',
  accentHover: '--accent-hover',
  accentPrimaryAlpha: '--accent-primary-alpha',
  strokeSubtle: '--stroke-subtle',
  borderStructural: '--border-structural',
  borderFocused: '--border-focused',
  shadowPanel: '--shadow-panel',
  shadowHover: '--shadow-hover',
  panelBlur: '--panel-blur',
  success: '--success',
  error: '--error',
  warning: '--warning',
  radiusSm: '--radius-sm',
  radiusMd: '--radius-md',
  radiusLg: '--radius-lg',
  radiusXl: '--radius-xl',
};

/** All CSS variable keys that should be set on the document */
export const THEME_CSS_KEYS = Object.keys(CSS_VAR_MAP).filter(
  (k) => k !== 'colorScheme'
) as (keyof Omit<ThemeVariables, 'colorScheme'>)[];
