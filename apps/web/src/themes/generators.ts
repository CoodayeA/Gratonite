/**
 * Theme generators (Items 94-95).
 * - Monochrome theme generator: derives all variables from a single base color
 * - Color palette presets: pre-built starting palettes
 */

import { ThemeVariables } from './types';
import { hexToHsl, hslToHex } from './colorUtils';

// ---------------------------------------------------------------------------
// Item 94: Monochrome theme generator
// ---------------------------------------------------------------------------

/**
 * Generate a complete monochrome ThemeVariables from a single base color.
 * All surface/text/accent colors are HSL shifts of the input.
 *
 * @param baseColor - A hex color string (e.g., "#3b82f6")
 * @returns A full ThemeVariables object using only shades of that color
 */
export function generateMonochromeTheme(baseColor: string): ThemeVariables {
  const hsl = hexToHsl(baseColor);
  if (!hsl) {
    throw new Error(`Invalid hex color: ${baseColor}`);
  }

  const { h, s } = hsl;

  // Desaturate for backgrounds, keep some saturation for accents
  const bgSat = Math.min(s, 15);
  const accentSat = Math.max(s, 50);

  return {
    colorScheme: 'dark',

    // Backgrounds — very dark, low saturation
    bgApp: hslToHex(h, bgSat, 8),
    bgSidebar: hslToHex(h, bgSat, 10),
    bgChannel: hslToHex(h, bgSat, 12),
    bgRail: hslToHex(h, bgSat, 7),
    bgPrimary: hslToHex(h, bgSat, 14),
    bgElevated: hslToHex(h, bgSat, 16),
    bgTertiary: hslToHex(h, bgSat, 20),

    // Text
    textPrimary: hslToHex(h, bgSat, 92),
    textSecondary: hslToHex(h, bgSat, 70),
    textMuted: hslToHex(h, bgSat, 48),

    // Accent colors (various saturations)
    accentBluelight: hslToHex(h, accentSat, 70),
    accentBlue: hslToHex(h, accentSat, 55),
    accentPurple: hslToHex((h + 30) % 360, accentSat * 0.8, 55),
    accentPink: hslToHex((h + 330) % 360, accentSat * 0.8, 55),

    // Overlays
    stroke: `hsla(${h}, ${bgSat}%, 40%, 0.25)`,
    strokeLight: `hsla(${h}, ${bgSat}%, 50%, 0.12)`,
    hoverOverlay: `hsla(${h}, ${bgSat}%, 50%, 0.08)`,
    activeOverlay: `hsla(${h}, ${bgSat}%, 50%, 0.12)`,

    // Typography
    fontSans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontDisplay: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",

    // Primary accent (HSL decomposed)
    accentPrimaryH: h,
    accentPrimaryS: `${accentSat}%`,
    accentPrimaryL: '55%',
    accentPrimary: hslToHex(h, accentSat, 55),
    accentHover: hslToHex(h, accentSat, 48),
    accentPrimaryAlpha: `hsla(${h}, ${accentSat}%, 55%, 0.15)`,
    strokeSubtle: `hsla(${h}, ${bgSat}%, 40%, 0.15)`,

    // Structural tokens
    borderStructural: `hsla(${h}, ${bgSat}%, 40%, 0.2)`,
    borderFocused: hslToHex(h, accentSat, 55),
    shadowPanel: `0 4px 24px hsla(${h}, ${bgSat}%, 4%, 0.5)`,
    shadowHover: `0 8px 32px hsla(${h}, ${bgSat}%, 4%, 0.6)`,
    panelBlur: 'blur(20px)',

    // Semantic
    success: hslToHex(140, 50, 45),
    error: hslToHex(0, 60, 50),
    warning: hslToHex(40, 70, 50),

    // Radii
    radiusSm: '4px',
    radiusMd: '8px',
    radiusLg: '12px',
    radiusXl: '16px',
  };
}

// ---------------------------------------------------------------------------
// Item 95: Color palette presets
// ---------------------------------------------------------------------------

export interface ColorPalette {
  id: string;
  name: string;
  description: string;
  /** Partial theme variable overrides */
  vars: Partial<ThemeVariables>;
  /** Preview swatch colors */
  swatches: string[];
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'warm-sunset',
    name: 'Warm Sunset',
    description: 'Warm oranges and deep reds evoking a golden hour sky',
    swatches: ['#ff6b35', '#f7931e', '#c43e00', '#1a0a00'],
    vars: {
      bgApp: '#1a0a00',
      bgSidebar: '#1f0e02',
      bgChannel: '#241205',
      bgRail: '#150800',
      bgPrimary: '#2a1608',
      bgElevated: '#30190a',
      bgTertiary: '#3a2010',
      textPrimary: '#ffeedd',
      textSecondary: '#d4a880',
      textMuted: '#8a6040',
      accentPrimary: '#ff6b35',
      accentHover: '#e55a28',
      accentBlue: '#f7931e',
      accentBluelight: '#ffb366',
      accentPrimaryH: 20,
      accentPrimaryS: '100%',
      accentPrimaryL: '60%',
    },
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    description: 'Cool blues and teals inspired by tropical waters',
    swatches: ['#00b4d8', '#0077b6', '#023e8a', '#03045e'],
    vars: {
      bgApp: '#03045e',
      bgSidebar: '#040560',
      bgChannel: '#050766',
      bgRail: '#020350',
      bgPrimary: '#06086e',
      bgElevated: '#080a74',
      bgTertiary: '#0e1080',
      textPrimary: '#e0f4ff',
      textSecondary: '#90c8e8',
      textMuted: '#4a7a9a',
      accentPrimary: '#00b4d8',
      accentHover: '#0096b4',
      accentBlue: '#0077b6',
      accentBluelight: '#48cae4',
      accentPrimaryH: 190,
      accentPrimaryS: '100%',
      accentPrimaryL: '42%',
    },
  },
  {
    id: 'forest-canopy',
    name: 'Forest Canopy',
    description: 'Deep greens and earthy browns of an old-growth forest',
    swatches: ['#40916c', '#2d6a4f', '#1b4332', '#0b1e10'],
    vars: {
      bgApp: '#0b1e10',
      bgSidebar: '#0e2414',
      bgChannel: '#112a18',
      bgRail: '#091a0e',
      bgPrimary: '#14301c',
      bgElevated: '#173620',
      bgTertiary: '#1e4228',
      textPrimary: '#d8f3e0',
      textSecondary: '#95c4a4',
      textMuted: '#5a8a68',
      accentPrimary: '#40916c',
      accentHover: '#357a5c',
      accentBlue: '#2d6a4f',
      accentBluelight: '#74c69d',
      accentPrimaryH: 150,
      accentPrimaryS: '40%',
      accentPrimaryL: '41%',
    },
  },
  {
    id: 'northern-lights',
    name: 'Northern Lights',
    description: 'Ethereal purples and greens of the aurora borealis',
    swatches: ['#7b2ff7', '#2ec4b6', '#c77dff', '#10002b'],
    vars: {
      bgApp: '#10002b',
      bgSidebar: '#140030',
      bgChannel: '#180036',
      bgRail: '#0c0024',
      bgPrimary: '#1c003c',
      bgElevated: '#200042',
      bgTertiary: '#280050',
      textPrimary: '#e8d4ff',
      textSecondary: '#b490d0',
      textMuted: '#6a4090',
      accentPrimary: '#7b2ff7',
      accentHover: '#6a20e0',
      accentBlue: '#2ec4b6',
      accentBluelight: '#c77dff',
      accentPurple: '#9d4edd',
      accentPink: '#ff6ec7',
      accentPrimaryH: 268,
      accentPrimaryS: '92%',
      accentPrimaryL: '58%',
    },
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    description: 'Soft pinks and delicate roses of spring sakura',
    swatches: ['#ff69b4', '#ffb3d9', '#c9184a', '#2b000e'],
    vars: {
      bgApp: '#2b000e',
      bgSidebar: '#300012',
      bgChannel: '#350016',
      bgRail: '#24000a',
      bgPrimary: '#3a001a',
      bgElevated: '#40001e',
      bgTertiary: '#4a0024',
      textPrimary: '#ffe0f0',
      textSecondary: '#d498b8',
      textMuted: '#8a4868',
      accentPrimary: '#ff69b4',
      accentHover: '#e050a0',
      accentBlue: '#c9184a',
      accentBluelight: '#ffb3d9',
      accentPink: '#ff69b4',
      accentPrimaryH: 330,
      accentPrimaryS: '100%',
      accentPrimaryL: '71%',
    },
  },
  {
    id: 'volcanic',
    name: 'Volcanic',
    description: 'Intense reds and dark charcoals of molten lava',
    swatches: ['#ef233c', '#d90429', '#6a040f', '#0a0a0a'],
    vars: {
      bgApp: '#0a0a0a',
      bgSidebar: '#0f0f0f',
      bgChannel: '#141414',
      bgRail: '#080808',
      bgPrimary: '#1a1a1a',
      bgElevated: '#1f1f1f',
      bgTertiary: '#262626',
      textPrimary: '#f0e0e0',
      textSecondary: '#b08080',
      textMuted: '#6a4040',
      accentPrimary: '#ef233c',
      accentHover: '#d90429',
      accentBlue: '#6a040f',
      accentBluelight: '#ff6b6b',
      accentPrimaryH: 355,
      accentPrimaryS: '86%',
      accentPrimaryL: '54%',
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Warm golds and ambers of late afternoon light',
    swatches: ['#fca311', '#e5a100', '#8a6000', '#1a1000'],
    vars: {
      bgApp: '#1a1000',
      bgSidebar: '#1f1402',
      bgChannel: '#241805',
      bgRail: '#150c00',
      bgPrimary: '#2a1c08',
      bgElevated: '#30200a',
      bgTertiary: '#3a2810',
      textPrimary: '#fff4d4',
      textSecondary: '#d4b880',
      textMuted: '#8a7040',
      accentPrimary: '#fca311',
      accentHover: '#e59000',
      accentBlue: '#e5a100',
      accentBluelight: '#ffd166',
      accentPrimaryH: 40,
      accentPrimaryS: '97%',
      accentPrimaryL: '53%',
    },
  },
];

/**
 * Apply a color palette as a starting point to a full ThemeVariables object.
 * Merges palette overrides onto the provided base theme.
 */
export function applyPalette(base: ThemeVariables, palette: ColorPalette): ThemeVariables {
  return { ...base, ...palette.vars } as ThemeVariables;
}

/**
 * Get a palette by ID.
 */
export function getPalette(id: string): ColorPalette | undefined {
  return COLOR_PALETTES.find((p) => p.id === id);
}
