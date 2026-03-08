import type { ThemeColors, ThemeSpacing, ThemeFontSize, ThemeBorderRadius } from './index';

export const darkColors: ThemeColors = {
  bgPrimary: '#1a1a2e',
  bgSecondary: '#16162a',
  bgTertiary: '#0f0f1e',
  bgElevated: '#222244',
  bgHover: '#2a2a4e',
  bgActive: '#333366',
  textPrimary: '#e8e8f0',
  textSecondary: '#9898b8',
  textMuted: '#6a6a8e',
  textLink: '#7c7cff',
  accentPrimary: '#6c63ff',
  accentHover: '#5a52e0',
  accentLight: 'rgba(108, 99, 255, 0.15)',
  online: '#43b581',
  idle: '#faa61a',
  dnd: '#f04747',
  offline: '#747f8d',
  success: '#43b581',
  warning: '#faa61a',
  error: '#f04747',
  info: '#5865f2',
  border: '#2a2a4e',
  borderLight: '#333366',
  inputBg: '#0f0f1e',
  inputBorder: '#2a2a4e',
  inputFocus: '#6c63ff',
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const darkSpacing: ThemeSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const darkFontSize: ThemeFontSize = {
  xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32,
};

export const darkBorderRadius: ThemeBorderRadius = {
  sm: 4, md: 8, lg: 12, xl: 16, full: 9999,
};
