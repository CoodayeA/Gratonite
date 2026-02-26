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
  name: 'Gratonite Gold',
  settings: {
    density: 'comfortable',
    motion: 'normal',
    cornerStyle: 'rounded',
    glassIntensity: 0.72,
  },
  tokens: {
    'semantic/surface/base': '#2c2c3e',
    'semantic/surface/raised': '#353348',
    'semantic/surface/soft': '#413d58',
    'semantic/surface/float': '#25243a',
    'semantic/surface/input': '#25243a',
    'semantic/text/primary': '#e8e4e0',
    'semantic/text/muted': '#a8a4b8',
    'semantic/text/faint': '#6e6a80',
    'semantic/border/default': '#4a4660',
    'semantic/border/strong': 'rgba(74, 70, 96, 0.5)',
    'semantic/action/accent': '#d4af37',
    'semantic/action/accent-2': '#e8c547',
    'semantic/action/accent-3': '#6aea8a',
    'semantic/status/danger': '#e85a6e',
    'semantic/status/danger-bg': 'rgba(232, 90, 110, 0.14)',
    'semantic/gradient/primary':
      'linear-gradient(120deg, rgba(212, 175, 55, 0.28), rgba(90, 74, 122, 0.22))',
    'semantic/gradient/accent': 'linear-gradient(135deg, #d4af37, #e8c547 60%, #5a4a7a)',
  },
};

export const TOKEN_KEY_WHITELIST = new Set(Object.keys(DEFAULT_THEME_V2.tokens));
