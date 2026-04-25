/**
 * Creates and renders skip links for keyboard navigation
 * Skip links allow users to bypass repetitive content like navigation
 * Hidden by default, only visible when focused via keyboard (Tab key)
 */
export function renderSkipLinks(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'skip-links';
  container.innerHTML = `
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <a href="#sidebar" class="skip-link">Skip to sidebar</a>
  `;
  return container;
}
