import { useEffect } from 'react';
import { renderSkipLinks } from '../lib/accessibility/skip-links';

/**
 * AppLayout wrapper component that manages accessibility features
 * including skip links for keyboard navigation
 */
export function AppLayoutAccessibility() {
  useEffect(() => {
    const skipLinksEl = renderSkipLinks();
    document.body.insertBefore(skipLinksEl, document.body.firstChild);
    return () => skipLinksEl.remove();
  }, []);

  return null;
}
