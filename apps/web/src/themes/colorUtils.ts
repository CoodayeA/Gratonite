/**
 * Color utility functions for the theme editor.
 * - Color harmony suggestions (complementary, analogous, triadic, split-complementary)
 * - WCAG contrast ratio calculation
 */

// ── HSL utilities ──

export interface HSL {
  h: number;
  s: number;
  l: number;
}

/** Parse a hex color (#rrggbb or #rgb) to { r, g, b } in 0-255 range. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

/** Convert RGB (0-255) to HSL. */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Convert HSL to hex string. */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Convert a hex color to HSL. */
export function hexToHsl(hex: string): HSL | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

// ── Color harmony ──

export interface ColorHarmony {
  label: string;
  colors: string[];
}

/** Given a hex accent color, return 4 harmony suggestions. */
export function getColorHarmonies(hex: string): ColorHarmony[] {
  const hsl = hexToHsl(hex);
  if (!hsl) return [];

  const { h, s, l } = hsl;

  return [
    {
      label: 'Complementary',
      colors: [hslToHex((h + 180) % 360, s, l)],
    },
    {
      label: 'Analogous',
      colors: [
        hslToHex((h + 30) % 360, s, l),
        hslToHex((h + 330) % 360, s, l),
      ],
    },
    {
      label: 'Triadic',
      colors: [
        hslToHex((h + 120) % 360, s, l),
        hslToHex((h + 240) % 360, s, l),
      ],
    },
    {
      label: 'Split-Complementary',
      colors: [
        hslToHex((h + 150) % 360, s, l),
        hslToHex((h + 210) % 360, s, l),
      ],
    },
  ];
}

// ── WCAG Contrast Ratio ──

/** Get the relative luminance of a color (0-1). */
function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Calculate contrast ratio between two hex colors (1:1 to 21:1). */
export function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;

  const l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

export type WCAGLevel = 'AAA' | 'AA' | 'Fail';

/** Check WCAG compliance for normal text. AA >= 4.5:1, AAA >= 7:1 */
export function wcagLevel(ratio: number): WCAGLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'Fail';
}

/** Check if a string looks like a valid hex color. */
export function isValidHexColor(s: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);
}
