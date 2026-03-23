/**
 * Tenor GIF API — set VITE_TENOR_API_KEY in the web app env.
 * Never commit fallback keys; keys in VITE_* are public to the browser.
 */
export function getTenorApiKey(): string | undefined {
  const k = import.meta.env.VITE_TENOR_API_KEY;
  if (typeof k !== 'string' || !k.trim()) return undefined;
  return k.trim();
}
