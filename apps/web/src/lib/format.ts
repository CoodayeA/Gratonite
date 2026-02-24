/**
 * Shared formatting utilities for the Gratonite web app.
 */

/**
 * Format an ISO date string into a human-readable short date (e.g. "Feb 24, 2026").
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
