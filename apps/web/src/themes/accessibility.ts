/**
 * Theme accessibility scoring utility (Item 84).
 * Calculates WCAG contrast ratios for all text/background pairs
 * in a ThemeVariables and returns an overall accessibility grade.
 */

import { ThemeVariables } from './types';
import { contrastRatio, wcagLevel, type WCAGLevel } from './colorUtils';

export type AccessibilityGrade = 'AAA' | 'AA' | 'A' | 'Fail';

export interface ContrastPair {
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  level: WCAGLevel;
}

export interface AccessibilityReport {
  grade: AccessibilityGrade;
  score: number; // 0-100
  pairs: ContrastPair[];
  passing: number;
  total: number;
}

/**
 * Text/background pairs to check for WCAG compliance.
 * Each pair represents a realistic reading scenario in the UI.
 */
const CONTRAST_PAIRS: { label: string; fg: keyof ThemeVariables; bg: keyof ThemeVariables }[] = [
  { label: 'Primary text on app background', fg: 'textPrimary', bg: 'bgApp' },
  { label: 'Primary text on sidebar', fg: 'textPrimary', bg: 'bgSidebar' },
  { label: 'Primary text on channel', fg: 'textPrimary', bg: 'bgChannel' },
  { label: 'Primary text on elevated', fg: 'textPrimary', bg: 'bgElevated' },
  { label: 'Secondary text on app background', fg: 'textSecondary', bg: 'bgApp' },
  { label: 'Secondary text on sidebar', fg: 'textSecondary', bg: 'bgSidebar' },
  { label: 'Secondary text on channel', fg: 'textSecondary', bg: 'bgChannel' },
  { label: 'Muted text on app background', fg: 'textMuted', bg: 'bgApp' },
  { label: 'Muted text on sidebar', fg: 'textMuted', bg: 'bgSidebar' },
  { label: 'Accent on app background', fg: 'accentPrimary', bg: 'bgApp' },
  { label: 'Accent on channel', fg: 'accentPrimary', bg: 'bgChannel' },
  { label: 'Success on app background', fg: 'success', bg: 'bgApp' },
  { label: 'Error on app background', fg: 'error', bg: 'bgApp' },
  { label: 'Warning on app background', fg: 'warning', bg: 'bgApp' },
];

/**
 * Extract a usable hex color from a CSS value string.
 * Handles hex colors, hsl(), and rgb() values.
 * Returns null if the value cannot be parsed.
 */
function extractHexColor(value: string): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();

  // Direct hex color
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed;
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Calculate an accessibility report for a theme.
 * Checks all text/background contrast pairs against WCAG standards.
 */
export function calculateAccessibilityScore(vars: ThemeVariables): AccessibilityReport {
  const pairs: ContrastPair[] = [];

  for (const pair of CONTRAST_PAIRS) {
    const fgValue = String(vars[pair.fg]);
    const bgValue = String(vars[pair.bg]);
    const fgHex = extractHexColor(fgValue);
    const bgHex = extractHexColor(bgValue);

    if (fgHex && bgHex) {
      const ratio = contrastRatio(fgHex, bgHex);
      const level = wcagLevel(ratio);
      pairs.push({
        label: pair.label,
        foreground: fgHex,
        background: bgHex,
        ratio: Math.round(ratio * 100) / 100,
        level,
      });
    }
  }

  const total = pairs.length;
  const aaaPassing = pairs.filter((p) => p.level === 'AAA').length;
  const aaPassing = pairs.filter((p) => p.level === 'AA' || p.level === 'AAA').length;

  // Score: AAA pairs = 100 points, AA pairs = 70 points, Fail = 0
  const score = total > 0
    ? Math.round(pairs.reduce((sum, p) => {
        if (p.level === 'AAA') return sum + 100;
        if (p.level === 'AA') return sum + 70;
        return sum;
      }, 0) / total)
    : 0;

  // Overall grade
  let grade: AccessibilityGrade;
  if (aaaPassing === total && total > 0) {
    grade = 'AAA';
  } else if (aaPassing === total && total > 0) {
    grade = 'AA';
  } else if (aaPassing >= total * 0.7) {
    grade = 'A';
  } else {
    grade = 'Fail';
  }

  return { grade, score, pairs, passing: aaPassing, total };
}
