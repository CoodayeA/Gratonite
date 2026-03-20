export interface KeyBinding {
    id: string;
    label: string;
    category: string;
    defaultCombo: string; // e.g. "Ctrl+K", "Alt+ArrowDown"
}

const STORAGE_KEY = 'gratonite-keybindings';

export const DEFAULT_KEYBINDINGS: KeyBinding[] = [
    // Navigation
    { id: 'quickSwitcher', label: 'Global Search', category: 'Navigation', defaultCombo: 'Meta+K' },
    { id: 'nextChannel', label: 'Next Channel', category: 'Navigation', defaultCombo: 'Alt+ArrowDown' },
    { id: 'prevChannel', label: 'Previous Channel', category: 'Navigation', defaultCombo: 'Alt+ArrowUp' },
    { id: 'closeModal', label: 'Close Modal / Overlay', category: 'Navigation', defaultCombo: 'Escape' },
    { id: 'showShortcuts', label: 'Keyboard Shortcuts', category: 'Navigation', defaultCombo: 'Meta+/' },
    { id: 'openSettings', label: 'Open Settings', category: 'Navigation', defaultCombo: 'Meta+,' },
    { id: 'focusSearch', label: 'Focus Search', category: 'Navigation', defaultCombo: 'Meta+F' },
    { id: 'bugReport', label: 'Report a Bug', category: 'Navigation', defaultCombo: 'Ctrl+Shift+B' },
    // Messaging
    { id: 'sendMessage', label: 'Send Message', category: 'Messaging', defaultCombo: 'Enter' },
    { id: 'newLine', label: 'New Line', category: 'Messaging', defaultCombo: 'Shift+Enter' },
    { id: 'editLast', label: 'Edit Last Message', category: 'Messaging', defaultCombo: 'ArrowUp' },
    { id: 'emojiPicker', label: 'Open Emoji Picker', category: 'Messaging', defaultCombo: 'Ctrl+E' },
    { id: 'markdownPreview', label: 'Toggle Preview', category: 'Messaging', defaultCombo: 'Ctrl+Shift+P' },
    // Appearance
    { id: 'openThemePicker', label: 'Open Theme Picker', category: 'Appearance', defaultCombo: 'Ctrl+Shift+T' },
    // Voice & Call
    { id: 'toggleMute', label: 'Toggle Mute', category: 'Voice & Call', defaultCombo: 'Meta+Shift+M' },
    { id: 'toggleDeafen', label: 'Toggle Deafen', category: 'Voice & Call', defaultCombo: 'Meta+Shift+D' },
];

/** Load user-customized combos from localStorage */
export function getUserOverrides(): Record<string, string> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/** Save user overrides */
export function saveUserOverrides(overrides: Record<string, string>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch { /* ignore */ }
}

/** Get the effective combo for an action (user override or default) */
export function getCombo(actionId: string): string {
    const overrides = getUserOverrides();
    if (overrides[actionId]) return overrides[actionId];
    const binding = DEFAULT_KEYBINDINGS.find(b => b.id === actionId);
    return binding?.defaultCombo || '';
}

/** Set a custom combo for an action. Pass empty string to reset to default. */
export function setCombo(actionId: string, combo: string): void {
    const overrides = getUserOverrides();
    const binding = DEFAULT_KEYBINDINGS.find(b => b.id === actionId);
    if (!combo || combo === binding?.defaultCombo) {
        delete overrides[actionId];
    } else {
        overrides[actionId] = combo;
    }
    saveUserOverrides(overrides);
}

/** Reset a single binding to default */
export function resetCombo(actionId: string): void {
    const overrides = getUserOverrides();
    delete overrides[actionId];
    saveUserOverrides(overrides);
}

/** Reset all bindings to defaults */
export function resetAllCombos(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/** Check if a combo conflicts with another action (returns the conflicting binding if any) */
export function findConflict(actionId: string, combo: string): KeyBinding | null {
    const overrides = getUserOverrides();
    for (const binding of DEFAULT_KEYBINDINGS) {
        if (binding.id === actionId) continue;
        const effective = overrides[binding.id] || binding.defaultCombo;
        if (effective === combo) return binding;
    }
    return null;
}

/** Convert a KeyboardEvent to a combo string like "Ctrl+Shift+K" */
export function eventToCombo(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.metaKey) parts.push('Meta');
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');

    const key = e.key;
    // Skip if only modifier pressed
    if (['Meta', 'Control', 'Alt', 'Shift'].includes(key)) return '';

    parts.push(key.length === 1 ? key.toUpperCase() : key);
    return parts.join('+');
}

/** Format a combo string for display (e.g. "Meta+K" → "⌘ K") */
export function formatCombo(combo: string): string[] {
    if (!combo) return [];
    return combo.split('+').map(part => {
        switch (part) {
            case 'Meta': return '⌘';
            case 'Ctrl': return 'Ctrl';
            case 'Alt': return '⌥';
            case 'Shift': return '⇧';
            case 'ArrowUp': return '↑';
            case 'ArrowDown': return '↓';
            case 'ArrowLeft': return '←';
            case 'ArrowRight': return '→';
            case 'Enter': return 'Enter';
            case 'Escape': return 'Esc';
            case ' ': return 'Space';
            default: return part;
        }
    });
}
