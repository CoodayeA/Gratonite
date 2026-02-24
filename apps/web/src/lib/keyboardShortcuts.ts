/**
 * Global keyboard shortcuts definition for Gratonite.
 *
 * Each shortcut specifies:
 * - `key`: the keyboard key (lowercase)
 * - `ctrl`: whether Ctrl (or Cmd on Mac) is required
 * - `shift`: whether Shift is required
 * - `alt`: whether Alt (or Option on Mac) is required
 * - `category`: grouping for the shortcuts help modal
 * - `label`: human-readable description
 * - `action`: unique action identifier
 */

export interface ShortcutDef {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  category: string;
  label: string;
  action: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

export const MOD_KEY_LABEL = isMac ? '⌘' : 'Ctrl';
export const ALT_KEY_LABEL = isMac ? '⌥' : 'Alt';

export function formatShortcut(def: ShortcutDef): string {
  const parts: string[] = [];
  if (def.ctrl) parts.push(MOD_KEY_LABEL);
  if (def.alt) parts.push(ALT_KEY_LABEL);
  if (def.shift) parts.push('Shift');
  parts.push(def.key === ' ' ? 'Space' : def.key.length === 1 ? def.key.toUpperCase() : def.key);
  return parts.join(' + ');
}

export const SHORTCUTS: ShortcutDef[] = [
  // Navigation
  { key: ',', ctrl: true, category: 'Navigation', label: 'Open Settings', action: 'open-settings' },
  { key: '/', ctrl: true, category: 'Navigation', label: 'Show Keyboard Shortcuts', action: 'show-shortcuts' },
  { key: 'n', ctrl: true, shift: true, category: 'Navigation', label: 'Create / Join Server', action: 'create-server' },
  { key: 'k', ctrl: true, category: 'Navigation', label: 'Quick Switcher', action: 'quick-switcher' },

  // Search
  { key: 'f', ctrl: true, category: 'Search', label: 'Search Current Channel', action: 'search-channel' },
  { key: 'f', ctrl: true, shift: true, category: 'Search', label: 'Search All Channels', action: 'search-all' },

  // Message Navigation
  { key: 'ArrowUp', alt: true, category: 'Channels', label: 'Previous Channel', action: 'prev-channel' },
  { key: 'ArrowDown', alt: true, category: 'Channels', label: 'Next Channel', action: 'next-channel' },

  // Server Navigation
  { key: 'ArrowUp', ctrl: true, alt: true, category: 'Servers', label: 'Previous Server', action: 'prev-server' },
  { key: 'ArrowDown', ctrl: true, alt: true, category: 'Servers', label: 'Next Server', action: 'next-server' },

  // Audio Controls
  { key: 'm', ctrl: true, shift: true, category: 'Audio', label: 'Toggle Mute', action: 'toggle-mute' },
  { key: 'd', ctrl: true, shift: true, category: 'Audio', label: 'Toggle Deafen', action: 'toggle-deafen' },

  // Text Formatting
  { key: 'b', ctrl: true, category: 'Formatting', label: 'Bold', action: 'format-bold' },
  { key: 'i', ctrl: true, category: 'Formatting', label: 'Italic', action: 'format-italic' },
  { key: 'u', ctrl: true, category: 'Formatting', label: 'Underline', action: 'format-underline' },

  // UI Panels
  { key: 'u', ctrl: true, shift: true, category: 'Panels', label: 'Upload File', action: 'upload-file' },
  { key: 'p', ctrl: true, category: 'Panels', label: 'Toggle Pinned Messages', action: 'toggle-pins' },
  { key: 'e', ctrl: true, category: 'Panels', label: 'Emoji Picker', action: 'emoji-picker' },
];

/**
 * Check if a keyboard event matches a shortcut definition.
 */
export function matchesShortcut(event: KeyboardEvent, def: ShortcutDef): boolean {
  const modKey = isMac ? event.metaKey : event.ctrlKey;
  if (!!def.ctrl !== modKey) return false;
  if (!!def.shift !== event.shiftKey) return false;
  if (!!def.alt !== event.altKey) return false;

  const eventKey = event.key.toLowerCase();
  const defKey = def.key.toLowerCase();
  return eventKey === defKey;
}

/**
 * Group shortcuts by category for display.
 */
export function groupShortcutsByCategory(): Map<string, ShortcutDef[]> {
  const groups = new Map<string, ShortcutDef[]>();
  for (const def of SHORTCUTS) {
    const existing = groups.get(def.category) ?? [];
    existing.push(def);
    groups.set(def.category, existing);
  }
  return groups;
}
