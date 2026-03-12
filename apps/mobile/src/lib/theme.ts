/**
 * Color palette and spacing for the mobile app.
 * Based on the web prototype's default dark theme.
 */

export const colors = {
  // Backgrounds
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16162a',
  bgTertiary: '#0f0f1e',
  bgElevated: '#222244',
  bgHover: '#2a2a4e',
  bgActive: '#333366',

  // Text
  textPrimary: '#e8e8f0',
  textSecondary: '#9898b8',
  textMuted: '#6a6a8e',
  textLink: '#7c7cff',

  // Accent
  accentPrimary: '#6c63ff',
  accentHover: '#5a52e0',
  accentLight: 'rgba(108, 99, 255, 0.15)',

  // Status
  online: '#43b581',
  idle: '#faa61a',
  dnd: '#f04747',
  offline: '#747f8d',

  // Semantic
  success: '#43b581',
  warning: '#faa61a',
  error: '#f04747',
  info: '#5865f2',

  // Borders
  border: '#2a2a4e',
  borderLight: '#333366',

  // Input
  inputBg: '#0f0f1e',
  inputBorder: '#2a2a4e',
  inputFocus: '#6c63ff',

  // Misc
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export { useTheme, useColors, useNeo, useGlass } from './themeStore';
export { themeStore } from './themeStore';
export type { ThemeName, ThemeDefinition, NeoExtras, GlassExtras } from './themes';
