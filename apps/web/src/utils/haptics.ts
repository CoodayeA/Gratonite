/**
 * haptics.ts — Haptic feedback utilities for mobile devices.
 * Uses the Vibration API (navigator.vibrate) — no-ops on unsupported browsers.
 */

const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export const haptic = {
  /** Subtle tap — e.g. hovering, selecting */
  light: () => canVibrate() && navigator.vibrate(10),
  /** Standard interaction — button press, toggle */
  medium: () => canVibrate() && navigator.vibrate(25),
  /** Strong feedback — destructive actions */
  heavy: () => canVibrate() && navigator.vibrate(50),
  /** Double-pulse — success confirmation */
  success: () => canVibrate() && navigator.vibrate([10, 50, 10]),
  /** Triple-pulse — error / warning */
  error: () => canVibrate() && navigator.vibrate([50, 30, 50, 30, 50]),

  // ─── Specialized Mobile Haptics (Items 54) ─────────────────────────

  /** Reaction tap — quick double tap */
  reaction: () => canVibrate() && navigator.vibrate([8, 40, 8]),
  /** Message sent confirmation */
  messageSent: () => canVibrate() && navigator.vibrate([12, 30, 6]),
  /** Theme switch — gentle ramp */
  themeSwitch: () => canVibrate() && navigator.vibrate([5, 20, 10, 20, 15]),
  /** Pull-to-refresh threshold reached */
  pullThreshold: () => canVibrate() && navigator.vibrate(15),
  /** Swipe action triggered (sidebar open/close) */
  swipe: () => canVibrate() && navigator.vibrate(8),
  /** Long press activated */
  longPress: () => canVibrate() && navigator.vibrate(30),
  /** Notification received */
  notification: () => canVibrate() && navigator.vibrate([15, 60, 15]),
};
