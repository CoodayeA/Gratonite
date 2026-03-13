/**
 * haptics.ts — Haptic feedback utilities for mobile devices.
 * Uses the Vibration API (navigator.vibrate) — no-ops on unsupported browsers.
 */

export const haptic = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(25),
  heavy: () => navigator.vibrate?.(50),
  success: () => navigator.vibrate?.([10, 50, 10]),
  error: () => navigator.vibrate?.([50, 30, 50, 30, 50]),
};
