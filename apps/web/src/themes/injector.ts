/**
 * Theme CSS variable injector.
 * Applies a ThemeVariables object to document.documentElement.style
 * using batched requestAnimationFrame for <16ms switches.
 */

import { ThemeVariables, CSS_VAR_MAP, THEME_CSS_KEYS } from './types';

let pending: ThemeVariables | null = null;
let rafId: number | null = null;

function flush() {
  if (!pending) return;
  const vars = pending;
  pending = null;
  rafId = null;

  const style = document.documentElement.style;
  const el = document.documentElement;

  // Set color-scheme attribute
  el.setAttribute('data-color-mode', vars.colorScheme);

  // Batch all CSS property updates
  for (const key of THEME_CSS_KEYS) {
    const cssVar = CSS_VAR_MAP[key];
    const value = String(vars[key]);
    style.setProperty(cssVar, value);
  }
}

/**
 * Apply a ThemeVariables object to the document.
 * All style.setProperty calls are batched in a single rAF.
 */
export function applyTheme(vars: ThemeVariables): void {
  pending = vars;
  if (rafId === null) {
    rafId = requestAnimationFrame(flush);
  }
}

/**
 * Apply theme immediately (synchronous), used for initial load.
 */
export function applyThemeSync(vars: ThemeVariables): void {
  pending = vars;
  flush();
}

/**
 * Apply theme with view transition animation (200ms crossfade).
 * Falls back to instant apply if View Transitions API not supported.
 */
export function applyThemeWithTransition(vars: ThemeVariables): void {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    (document as any).startViewTransition(() => {
      applyThemeSync(vars);
    });
  } else {
    applyTheme(vars);
  }
}
