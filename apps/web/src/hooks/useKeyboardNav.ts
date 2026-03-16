import { useEffect, useCallback } from 'react';

/**
 * Global keyboard navigation shortcuts (Feature 15: Full Keyboard Navigation).
 * Registers document-level keydown listeners for app-wide navigation.
 */
export function useKeyboardNav(options: {
    onEscape?: () => void;
    onQuickSwitch?: () => void;
    onNextServer?: () => void;
    onPrevServer?: () => void;
    onNextChannel?: () => void;
    onPrevChannel?: () => void;
    onNextUnread?: () => void;
    onToggleMute?: () => void;
    onToggleDeafen?: () => void;
    onGoToInbox?: () => void;
}) {
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

        // Escape — always works (close modals, panels, etc.)
        if (e.key === 'Escape') {
            options.onEscape?.();
            return;
        }

        // Don't fire navigation shortcuts when typing in inputs
        if (isInput) return;

        // Ctrl/Cmd+K — Quick Switcher
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            options.onQuickSwitch?.();
            return;
        }

        // Alt+Up / Alt+Down — navigate channels
        if (e.altKey && e.key === 'ArrowUp') {
            e.preventDefault();
            options.onPrevChannel?.();
            return;
        }
        if (e.altKey && e.key === 'ArrowDown') {
            e.preventDefault();
            options.onNextChannel?.();
            return;
        }

        // Ctrl+Alt+Up / Ctrl+Alt+Down — navigate servers
        if (e.ctrlKey && e.altKey && e.key === 'ArrowUp') {
            e.preventDefault();
            options.onPrevServer?.();
            return;
        }
        if (e.ctrlKey && e.altKey && e.key === 'ArrowDown') {
            e.preventDefault();
            options.onNextServer?.();
            return;
        }

        // Alt+Shift+Up — go to next unread channel
        if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
            e.preventDefault();
            options.onNextUnread?.();
            return;
        }

        // Ctrl+Shift+M — toggle mute
        if (e.ctrlKey && e.shiftKey && e.key === 'M') {
            e.preventDefault();
            options.onToggleMute?.();
            return;
        }

        // Ctrl+Shift+D — toggle deafen
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            options.onToggleDeafen?.();
            return;
        }

        // Ctrl+I — go to inbox
        if (e.ctrlKey && e.key === 'i' && !e.shiftKey) {
            e.preventDefault();
            options.onGoToInbox?.();
            return;
        }
    }, [options]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}
