import type { ThemeColors, ThemeSpacing, ThemeFontSize, ThemeBorderRadius } from './index';
import { neoExtras } from './neobrutalism';

export const neoDarkColors: ThemeColors = {
  bgPrimary: '#1a1a1a',
  bgSecondary: '#2d2d2d',
  bgTertiary: '#121212',
  bgElevated: '#3a3a3a',
  bgHover: '#444444',
  bgActive: '#555555',
  textPrimary: '#f5f0e8',
  textSecondary: '#c8c0b0',
  textMuted: '#a09888',
  textLink: '#f97316',
  accentPrimary: '#f97316',
  accentHover: '#ea580c',
  accentLight: 'rgba(249, 115, 22, 0.2)',
  online: '#43b581',
  idle: '#faa61a',
  dnd: '#f04747',
  offline: '#747f8d',
  success: '#43b581',
  warning: '#faa61a',
  error: '#f04747',
  info: '#5865f2',
  border: '#f5f0e8',
  borderLight: '#8a8278',
  inputBg: '#2d2d2d',
  inputBorder: '#f5f0e8',
  inputFocus: '#f97316',
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const neoDarkSpacing: ThemeSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const neoDarkFontSize: ThemeFontSize = {
  xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32,
};

export const neoDarkBorderRadius: ThemeBorderRadius = {
  sm: 0, md: 0, lg: 0, xl: 0, full: 0,
};

export { neoExtras as neoDarkExtras };
