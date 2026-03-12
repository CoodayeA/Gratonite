import type { ThemeColors, ThemeSpacing, ThemeFontSize, ThemeBorderRadius, GlassExtras } from './index';

export const glassColors: ThemeColors = {
  bgPrimary: '#f0f4ff',
  bgSecondary: '#e8eeff',
  bgTertiary: '#dde5f9',
  bgElevated: 'rgba(255, 255, 255, 0.72)',
  bgHover: 'rgba(255, 255, 255, 0.55)',
  bgActive: 'rgba(255, 255, 255, 0.85)',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  textLink: '#0ea5e9',
  accentPrimary: '#0ea5e9',
  accentHover: '#0284c7',
  accentLight: 'rgba(14, 165, 233, 0.12)',
  online: '#22c55e',
  idle: '#f59e0b',
  dnd: '#ef4444',
  offline: '#94a3b8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  border: 'rgba(255, 255, 255, 0.45)',
  borderLight: 'rgba(255, 255, 255, 0.25)',
  inputBg: 'rgba(255, 255, 255, 0.6)',
  inputBorder: 'rgba(255, 255, 255, 0.5)',
  inputFocus: '#0ea5e9',
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const glassSpacing: ThemeSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const glassFontSize: ThemeFontSize = {
  xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32,
};

export const glassBorderRadius: ThemeBorderRadius = {
  sm: 8, md: 14, lg: 20, xl: 28, full: 9999,
};

export const glassExtras: GlassExtras = {
  blurIntensity: 40,
  blurTint: 'light',
  glassBackground: 'rgba(255, 255, 255, 0.55)',
  glassBorder: 'rgba(255, 255, 255, 0.6)',
  glassHighlight: 'rgba(255, 255, 255, 0.8)',
  frostedOpacity: 0.7,
};
