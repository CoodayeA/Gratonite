/**
 * Copy text to clipboard with fallback for browsers/contexts where
 * navigator.clipboard.writeText is unavailable (e.g. Firefox, non-HTTPS).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Prefer the modern Clipboard API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy approach
    }
  }

  // Legacy fallback via hidden textarea
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
