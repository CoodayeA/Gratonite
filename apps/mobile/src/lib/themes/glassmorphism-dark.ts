import type { ThemeColors, ThemeSpacing, ThemeFontSize, ThemeBorderRadius, GlassExtras } from './index';

export const glassDarkColors: ThemeColors = {
  bgPrimary: '#070b18',
  bgSecondary: '#0c1225',
  bgTertiary: '#060a14',
  bgElevated: 'rgba(255, 255, 255, 0.09)',
  bgHover: 'rgba(255, 255, 255, 0.08)',
  bgActive: 'rgba(255, 255, 255, 0.12)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#7d8da3',
  textLink: '#38bdf8',
  accentPrimary: '#06b6d4',
  accentHover: '#22d3ee',
  accentLight: 'rgba(6, 182, 212, 0.15)',
  online: '#22c55e',
  idle: '#f59e0b',
  dnd: '#ef4444',
  offline: '#64748b',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  border: 'rgba(255, 255, 255, 0.12)',
  borderLight: 'rgba(255, 255, 255, 0.10)',
  inputBg: 'rgba(255, 255, 255, 0.08)',
  inputBorder: 'rgba(255, 255, 255, 0.1)',
  inputFocus: '#06b6d4',
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

export const glassDarkSpacing: ThemeSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
};

export const glassDarkFontSize: ThemeFontSize = {
  xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32,
};

export const glassDarkBorderRadius: ThemeBorderRadius = {
  sm: 8, md: 14, lg: 20, xl: 28, full: 9999,
};

export const glassDarkExtras: GlassExtras = {
  blurIntensity: 50,
  blurTint: 'dark',
  glassBackground: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  glassHighlight: 'rgba(255, 255, 255, 0.16)',
  frostedOpacity: 0.85,
};
