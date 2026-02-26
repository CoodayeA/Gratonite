import { DEFAULT_THEME_V2, TOKEN_KEY_WHITELIST, type ThemeTokensV2, type ThemeV2 } from '@/theme/tokens-v2';

export type ThemeManifestV2 = {
  version: string;
  name: string;
  overrides: ThemeTokensV2;
};

type ResolvedThemeResult = {
  theme: ThemeV2;
  warnings: string[];
};

const LEGACY_VAR_MAP: Record<string, string> = {
  'semantic/surface/base': '--bg',
  'semantic/surface/raised': '--bg-elevated',
  'semantic/surface/soft': '--bg-soft',
  'semantic/surface/float': '--bg-float',
  'semantic/surface/input': '--bg-input',
  'semantic/text/primary': '--text',
  'semantic/text/muted': '--text-muted',
  'semantic/text/faint': '--text-faint',
  'semantic/border/default': '--stroke',
  'semantic/border/strong': '--stroke-strong',
  'semantic/action/accent': '--accent',
  'semantic/action/accent-2': '--accent-2',
  'semantic/action/accent-3': '--accent-3',
  'semantic/status/danger': '--danger',
  'semantic/status/danger-bg': '--danger-bg',
  'semantic/gradient/primary': '--gradient-primary',
  'semantic/gradient/accent': '--gradient-accent',
};

function toCssVarName(tokenKey: string): string {
  return `--${tokenKey.replace(/\//g, '-')}`;
}

export function resolveThemeV2(manifest?: ThemeManifestV2): ResolvedThemeResult {
  if (!manifest) {
    return { theme: DEFAULT_THEME_V2, warnings: [] };
  }

  const warnings: string[] = [];
  const safeOverrides: ThemeTokensV2 = {};

  for (const [tokenKey, tokenValue] of Object.entries(manifest.overrides ?? {})) {
    if (!TOKEN_KEY_WHITELIST.has(tokenKey)) {
      warnings.push(`Unsupported token override ignored: ${tokenKey}`);
      continue;
    }
    safeOverrides[tokenKey] = tokenValue;
  }

  return {
    theme: {
      ...DEFAULT_THEME_V2,
      version: manifest.version || DEFAULT_THEME_V2.version,
      name: manifest.name || DEFAULT_THEME_V2.name,
      tokens: {
        ...DEFAULT_THEME_V2.tokens,
        ...safeOverrides,
      },
    },
    warnings,
  };
}

// Tokens to skip in light mode — let the CSS light theme handle surfaces/text
const SKIP_IN_LIGHT_MODE = new Set([
  'semantic/surface/base',
  'semantic/surface/raised',
  'semantic/surface/soft',
  'semantic/surface/float',
  'semantic/surface/input',
  'semantic/text/primary',
  'semantic/text/muted',
  'semantic/text/faint',
  'semantic/border/default',
  'semantic/border/strong',
  'semantic/status/danger',
  'semantic/status/danger-bg',
  'semantic/gradient/primary',
]);

export function applyThemeV2(theme: ThemeV2) {
  const root = document.documentElement;
  root.dataset['themeV2'] = 'true';
  const isLight = root.dataset['colorMode'] === 'light';

  for (const [tokenKey, tokenValue] of Object.entries(theme.tokens)) {
    // In light mode, skip dark-specific surface/text tokens so CSS handles them
    if (isLight && SKIP_IN_LIGHT_MODE.has(tokenKey)) continue;

    root.style.setProperty(toCssVarName(tokenKey), tokenValue);
    const legacyVar = LEGACY_VAR_MAP[tokenKey];
    if (legacyVar) {
      root.style.setProperty(legacyVar, tokenValue);
    }
  }

  root.dataset['themeDensity'] = theme.settings.density;
  root.dataset['themeMotion'] = theme.settings.motion;
  root.dataset['themeCorner'] = theme.settings.cornerStyle;
}
