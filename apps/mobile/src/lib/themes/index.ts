export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  bgHover: string;
  bgActive: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textLink: string;
  accentPrimary: string;
  accentHover: string;
  accentLight: string;
  online: string;
  idle: string;
  dnd: string;
  offline: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  borderLight: string;
  inputBg: string;
  inputBorder: string;
  inputFocus: string;
  white: string;
  black: string;
  transparent: string;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
}

export interface ThemeFontSize {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
}

export interface ThemeBorderRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface NeoExtras {
  borderWidth: number;
  shadowOffset: { width: number; height: number };
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  palette: {
    coral: string;
    mint: string;
    butter: string;
    lavender: string;
    sky: string;
    peach: string;
  };
}

export interface GlassExtras {
  blurIntensity: number;
  blurTint: 'light' | 'dark' | 'default';
  glassBackground: string;
  glassBorder: string;
  glassHighlight: string;
  frostedOpacity: number;
}

export type ThemeName = 'dark' | 'light' | 'neobrutalism' | 'neobrutalism-dark' | 'glassmorphism' | 'glassmorphism-dark';

export interface ThemeDefinition {
  colors: ThemeColors;
  spacing: ThemeSpacing;
  fontSize: ThemeFontSize;
  borderRadius: ThemeBorderRadius;
  isDark: boolean;
  neo: NeoExtras | null;
  glass: GlassExtras | null;
}

import { darkColors, darkSpacing, darkFontSize, darkBorderRadius } from './dark';
import { lightColors, lightSpacing, lightFontSize, lightBorderRadius } from './light';
import { neoColors, neoSpacing, neoFontSize, neoBorderRadius, neoExtras } from './neobrutalism';
import { neoDarkColors, neoDarkSpacing, neoDarkFontSize, neoDarkBorderRadius, neoDarkExtras } from './neobrutalism-dark';
import { glassColors, glassSpacing, glassFontSize, glassBorderRadius, glassExtras } from './glassmorphism';
import { glassDarkColors, glassDarkSpacing, glassDarkFontSize, glassDarkBorderRadius, glassDarkExtras } from './glassmorphism-dark';

export const themes: Record<ThemeName, ThemeDefinition> = {
  dark: {
    colors: darkColors,
    spacing: darkSpacing,
    fontSize: darkFontSize,
    borderRadius: darkBorderRadius,
    isDark: true,
    neo: null,
    glass: null,
  },
  light: {
    colors: lightColors,
    spacing: lightSpacing,
    fontSize: lightFontSize,
    borderRadius: lightBorderRadius,
    isDark: false,
    neo: null,
    glass: null,
  },
  neobrutalism: {
    colors: neoColors,
    spacing: neoSpacing,
    fontSize: neoFontSize,
    borderRadius: neoBorderRadius,
    isDark: false,
    neo: neoExtras,
    glass: null,
  },
  'neobrutalism-dark': {
    colors: neoDarkColors,
    spacing: neoDarkSpacing,
    fontSize: neoDarkFontSize,
    borderRadius: neoDarkBorderRadius,
    isDark: true,
    neo: neoDarkExtras,
    glass: null,
  },
  glassmorphism: {
    colors: glassColors,
    spacing: glassSpacing,
    fontSize: glassFontSize,
    borderRadius: glassBorderRadius,
    isDark: false,
    glass: glassExtras,
    neo: null,
  },
  'glassmorphism-dark': {
    colors: glassDarkColors,
    spacing: glassDarkSpacing,
    fontSize: glassDarkFontSize,
    borderRadius: glassDarkBorderRadius,
    isDark: true,
    glass: glassDarkExtras,
    neo: null,
  },
};
