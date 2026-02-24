export type ThemeDensity = 'compact' | 'comfortable';
export type ThemeMotion = 'reduced' | 'normal';
export type ThemeCornerStyle = 'rounded' | 'soft';

export type ThemeSettingsV2 = {
  density: ThemeDensity;
  motion: ThemeMotion;
  cornerStyle: ThemeCornerStyle;
  glassIntensity: number;
};

export type ThemeTokensV2 = Record<string, string>;

export type ThemeV2 = {
  version: string;
  name: string;
  settings: ThemeSettingsV2;
  tokens: ThemeTokensV2;
};

export const DEFAULT_THEME_V2: ThemeV2 = {
  version: '2.0.0',
  name: 'Aurora Glass',
  settings: {
    density: 'comfortable',
    motion: 'normal',
    cornerStyle: 'rounded',
    glassIntensity: 0.72,
  },
  tokens: {
    'semantic/surface/base': '#10162a',
    'semantic/surface/raised': 'rgba(25, 34, 58, 0.84)',
    'semantic/surface/soft': 'rgba(33, 45, 74, 0.8)',
    'semantic/surface/float': 'rgba(18, 27, 46, 0.9)',
    'semantic/surface/input': 'rgba(20, 30, 50, 0.78)',
    'semantic/text/primary': '#f4f7ff',
    'semantic/text/muted': '#b5c1d7',
    'semantic/text/faint': '#8291ad',
    'semantic/border/default': 'rgba(163, 191, 239, 0.22)',
    'semantic/border/strong': 'rgba(163, 191, 239, 0.34)',
    'semantic/action/accent': '#79dfff',
    'semantic/action/accent-2': '#8a7bff',
    'semantic/action/accent-3': '#9fffd8',
    'semantic/status/danger': '#ff7676',
    'semantic/status/danger-bg': 'rgba(255, 118, 118, 0.14)',
    'semantic/gradient/primary':
      'linear-gradient(120deg, rgba(121, 223, 255, 0.28), rgba(138, 123, 255, 0.22))',
    'semantic/gradient/accent': 'linear-gradient(135deg, #79dfff, #8a7bff 60%, #b98aff)',
  },
};

export const TOKEN_KEY_WHITELIST = new Set(Object.keys(DEFAULT_THEME_V2.tokens));
