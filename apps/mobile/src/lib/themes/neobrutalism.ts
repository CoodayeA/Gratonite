import type { ThemeColors, ThemeSpacing, ThemeFontSize, ThemeBorderRadius, NeoExtras } from './index';

export const neoColors: ThemeColors = {
  bgPrimary: '#f5f0e8',
  bgSecondary: '#ffe8a3',
  bgTertiary: '#f0e8d8',
  bgElevated: '#ffffff',
  bgHover: '#fff3cc',
  bgActive: '#ffe08a',
  textPrimary: '#000000',
  textSecondary: '#333333',
  textMuted: '#555555',
  textLink: '#f97316',
  accentPrimary: '#f97316',
  accentHover: '#ea580c',
  accentLight: 'rgba(249, 115, 22, 0.15)',
  online: '#43b581',
  idle: '#faa61a',
  dnd: '#f04747',
  offline: '#747f8d',
  success: '#43b581',
  warning: '#faa61a',
  error: '#f04747',
  info: '#5865f2',
  border: '#000000',
  borderLight: '#333333',
  inputBg: '#ffffff',
  inputBorder: '#000000',
  inputFocus: '#f97316',
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const neoSpacing: ThemeSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const neoFontSize: ThemeFontSize = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32,
};

export const neoBorderRadius: ThemeBorderRadius = {
  sm: 0, md: 0, lg: 0, xl: 0, full: 0,
};

export const neoExtras: NeoExtras = {
  borderWidth: 3,
  shadowOffset: { width: 4, height: 4 },
  shadowColor: '#000000',
  shadowOpacity: 1,
  shadowRadius: 0,
  palette: {
    coral: '#ff6b6b',
    mint: '#a8e6cf',
    butter: '#ffe8a3',
    lavender: '#c4b5fd',
    sky: '#7dd3fc',
    peach: '#ffcba4',
  },
};
