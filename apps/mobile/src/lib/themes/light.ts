import type { ThemeColors, ThemeSpacing, ThemeFontSize, ThemeBorderRadius } from './index';

export const lightColors: ThemeColors = {
  bgPrimary: '#f9f9fb',
  bgSecondary: '#f0f0f5',
  bgTertiary: '#e8e8ed',
  bgElevated: '#ffffff',
  bgHover: '#ebebf0',
  bgActive: '#dddde5',
  textPrimary: '#18181b',
  textSecondary: '#52525b',
  textMuted: '#71717a',
  textLink: '#6c63ff',
  accentPrimary: '#6c63ff',
  accentHover: '#5a52e0',
  accentLight: 'rgba(108, 99, 255, 0.1)',
  online: '#43b581',
  idle: '#faa61a',
  dnd: '#f04747',
  offline: '#747f8d',
  success: '#43b581',
  warning: '#faa61a',
  error: '#f04747',
  info: '#5865f2',
  border: 'rgba(0,0,0,0.08)',
  borderLight: 'rgba(0,0,0,0.04)',
  inputBg: '#ffffff',
  inputBorder: 'rgba(0,0,0,0.12)',
  inputFocus: '#6c63ff',
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const lightSpacing: ThemeSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const lightFontSize: ThemeFontSize = {
  xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32,
};

export const lightBorderRadius: ThemeBorderRadius = {
  sm: 4, md: 8, lg: 12, xl: 16, full: 9999,
};
