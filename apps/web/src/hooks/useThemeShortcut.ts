import { useEffect } from 'react';
import { getCombo, eventToCombo } from '../utils/keybindings';

/**
 * Global keyboard shortcut for opening the theme picker (Ctrl+Shift+T by default).
 * Dispatches a custom "gratonite:open-theme-picker" event on window.
 *
 * Usage:
 *   useThemeShortcut();                          // just register the listener
 *   useThemeShortcut(() => setActiveModal('settings')); // or pass a direct handler
 */
export function useThemeShortcut(onOpen?: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (isInput) return;

      const expected = getCombo('openThemePicker');
      if (!expected) return;

      const pressed = eventToCombo(e);
      if (pressed === expected) {
        e.preventDefault();
        if (onOpen) {
          onOpen();
        } else {
          window.dispatchEvent(new CustomEvent('gratonite:open-theme-picker'));
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
