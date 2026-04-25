/**
 * Creates a focus trap within a container element
 * Prevents focus from leaving the container using Tab navigation
 * Useful for modals, dialogs, and other overlays
 */
export function createFocusTrap(containerEl: HTMLElement) {
  const focusableElements = containerEl.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  // Focus the first focusable element when trap is created
  firstElement?.focus();
  containerEl.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    containerEl.removeEventListener('keydown', handleKeyDown);
  };
}
