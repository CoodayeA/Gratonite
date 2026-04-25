/**
 * Creates and renders skip links for keyboard navigation
 * Skip links allow users to bypass repetitive content like navigation
 * Only visible on focus for accessibility
 */
export function renderSkipLinks(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'skip-links-container';
  container.innerHTML = `
    <a href="#main-content" class="sr-only-focusable">Skip to main content</a>
    <a href="#sidebar" class="sr-only-focusable">Skip to sidebar</a>
  `;
  return container;
}
