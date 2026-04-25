/**
 * Portal Theme System — type definitions, defaults, and merge helpers.
 *
 * Mirrors the server-side Zod schema in apps/api/src/routes/portal-themes.ts.
 * Keep the two in sync.
 */

export type PortalVibe = 'holographic' | 'solar-system' | 'liquid-lava' | 'iso-city';

export type PortalBackgroundStyle =
  | 'deep-space'
  | 'aurora'
  | 'solid'
  | 'animated-grid'
  | 'liquid-blobs'
  | 'custom-image';

export type PortalPlanetStyle = 'green' | 'violet' | 'amber' | 'azure' | 'rose' | 'mono' | 'custom';

export type PortalDensity = 'cozy' | 'comfortable' | 'compact';
export type PortalFontPersonality = 'modern' | 'editorial' | 'builder' | 'playful';
export type PortalAnimations = 'on' | 'subtle' | 'off';

export interface PortalTheme {
  version: 1;
  vibe: PortalVibe;
  accentColor: string;                 // "#00ff88" or "gradient:#a,#b"
  backgroundStyle: PortalBackgroundStyle;
  customBackgroundUrl?: string | null;
  planetStyle: PortalPlanetStyle;
  customPlanetUrl?: string | null;
  density: PortalDensity;
  fontPersonality: PortalFontPersonality;
  animations: PortalAnimations;
}

export const SYSTEM_DEFAULT_THEME: PortalTheme = {
  version: 1,
  vibe: 'holographic',
  accentColor: '#00ff88',
  backgroundStyle: 'deep-space',
  customBackgroundUrl: null,
  planetStyle: 'green',
  customPlanetUrl: null,
  density: 'comfortable',
  fontPersonality: 'modern',
  animations: 'on',
};

const VIBES: PortalVibe[] = ['holographic', 'solar-system', 'liquid-lava', 'iso-city'];
const BG_STYLES: PortalBackgroundStyle[] = [
  'deep-space',
  'aurora',
  'solid',
  'animated-grid',
  'liquid-blobs',
  'custom-image',
];
const PLANETS: PortalPlanetStyle[] = ['green', 'violet', 'amber', 'azure', 'rose', 'mono', 'custom'];
const DENSITIES: PortalDensity[] = ['cozy', 'comfortable', 'compact'];
const FONTS: PortalFontPersonality[] = ['modern', 'editorial', 'builder', 'playful'];
const ANIMS: PortalAnimations[] = ['on', 'subtle', 'off'];

const ACCENT_RE = /^#[0-9a-fA-F]{6}$|^gradient:#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}$/;

export function normalizeTheme(input: unknown): PortalTheme {
  const t = (input as Partial<PortalTheme>) ?? {};
  const pick = <V extends string>(value: V | undefined, allowed: V[], fallback: V): V =>
    value && allowed.includes(value) ? value : fallback;

  return {
    version: 1,
    vibe: pick(t.vibe as PortalVibe, VIBES, SYSTEM_DEFAULT_THEME.vibe),
    accentColor:
      typeof t.accentColor === 'string' && ACCENT_RE.test(t.accentColor)
        ? t.accentColor
        : SYSTEM_DEFAULT_THEME.accentColor,
    backgroundStyle: pick(
      t.backgroundStyle as PortalBackgroundStyle,
      BG_STYLES,
      SYSTEM_DEFAULT_THEME.backgroundStyle,
    ),
    customBackgroundUrl:
      typeof t.customBackgroundUrl === 'string' ? t.customBackgroundUrl : null,
    planetStyle: pick(t.planetStyle as PortalPlanetStyle, PLANETS, SYSTEM_DEFAULT_THEME.planetStyle),
    customPlanetUrl: typeof t.customPlanetUrl === 'string' ? t.customPlanetUrl : null,
    density: pick(t.density as PortalDensity, DENSITIES, SYSTEM_DEFAULT_THEME.density),
    fontPersonality: pick(
      t.fontPersonality as PortalFontPersonality,
      FONTS,
      SYSTEM_DEFAULT_THEME.fontPersonality,
    ),
    animations: pick(t.animations as PortalAnimations, ANIMS, SYSTEM_DEFAULT_THEME.animations),
  };
}

export function resolveTheme(
  guildDefault: unknown | null,
  memberOverride: unknown | null,
): PortalTheme {
  if (memberOverride) return normalizeTheme(memberOverride);
  if (guildDefault) return normalizeTheme(guildDefault);
  return SYSTEM_DEFAULT_THEME;
}

export function parseAccent(accent: string): { from: string; to: string; isGradient: boolean } {
  if (accent.startsWith('gradient:')) {
    const [from, to] = accent.replace('gradient:', '').split(',');
    return { from, to, isGradient: true };
  }
  return { from: accent, to: accent, isGradient: false };
}

export function hueFromHex(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 140;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  if (hue < 0) hue += 360;
  return Math.round(hue);
}

export const PLANET_HUE: Record<Exclude<PortalPlanetStyle, 'custom'>, number> = {
  green: 145,
  violet: 280,
  amber: 35,
  azure: 200,
  rose: 340,
  mono: 0,
};
