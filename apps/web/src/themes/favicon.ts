/**
 * Theme-aware favicon utility (Item 98).
 * Dynamically tints the favicon using the theme's accent color via canvas.
 */

let currentFaviconUrl: string | null = null;
let originalFaviconImage: HTMLImageElement | null = null;

/**
 * Load the original favicon image once for reuse.
 */
function getOriginalFavicon(): Promise<HTMLImageElement> {
  if (originalFaviconImage) return Promise.resolve(originalFaviconImage);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Find the current favicon link
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    const href = link?.href || '/favicon.ico';

    img.onload = () => {
      originalFaviconImage = img;
      resolve(img);
    };
    img.onerror = () => {
      reject(new Error('Failed to load favicon'));
    };
    img.src = href;
  });
}

/**
 * Update the favicon to be tinted with the given accent color.
 * Uses canvas to apply a color overlay on the original favicon.
 *
 * @param accentColor - A CSS hex color string (e.g., "#7c3aed")
 */
export async function updateFavicon(accentColor: string): Promise<void> {
  try {
    const img = await getOriginalFavicon();
    const size = 32;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw original favicon
    ctx.drawImage(img, 0, 0, size, size);

    // Apply accent color overlay with "multiply" blend mode
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, 0, size, size);

    // Restore alpha from original image
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(img, 0, 0, size, size);

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/png');

    // Update or create favicon link element
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    // Revoke previous blob URL if we created one
    if (currentFaviconUrl && currentFaviconUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentFaviconUrl);
    }

    link.type = 'image/png';
    link.href = dataUrl;
    currentFaviconUrl = dataUrl;
  } catch {
    // Silently fail — favicon tinting is a nice-to-have
  }
}

/**
 * Reset the favicon to the original (un-tinted) version.
 */
export function resetFavicon(): void {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (link && originalFaviconImage) {
    link.href = originalFaviconImage.src;
  }
  if (currentFaviconUrl && currentFaviconUrl.startsWith('blob:')) {
    URL.revokeObjectURL(currentFaviconUrl);
  }
  currentFaviconUrl = null;
}
