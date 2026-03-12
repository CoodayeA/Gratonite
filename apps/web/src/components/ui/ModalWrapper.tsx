import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to delay unmounting of a component to allow for exit animations
 */
export function useDelayUnmount(isMounted: boolean, delayTime: number) {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isMounted && !shouldRender) {
            setShouldRender(true);
        } else if (!isMounted && shouldRender) {
            timeoutId = setTimeout(() => setShouldRender(false), delayTime);
        }
        return () => clearTimeout(timeoutId);
    }, [isMounted, delayTime, shouldRender]);

    return shouldRender;
}

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Traps keyboard focus inside a container element while the modal is open.
 * Saves and restores the previously focused element on mount/unmount.
 */
function useFocusTrap(isOpen: boolean) {
    const containerRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<Element | null>(null);

    // Save the element that was focused before the modal opened
    useEffect(() => {
        if (isOpen) {
            previousFocusRef.current = document.activeElement;
        }
    }, [isOpen]);

    // Focus the first focusable element (or the container) when the modal opens
    useEffect(() => {
        if (!isOpen || !containerRef.current) return;

        // Small delay so the DOM has rendered children
        const raf = requestAnimationFrame(() => {
            if (!containerRef.current) return;
            const firstFocusable = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
            if (firstFocusable) {
                firstFocusable.focus();
            } else {
                containerRef.current.focus();
            }
        });

        return () => cancelAnimationFrame(raf);
    }, [isOpen]);

    // Restore focus when modal closes
    useEffect(() => {
        if (isOpen) return;
        const prev = previousFocusRef.current;
        return () => {
            if (prev && prev instanceof HTMLElement) {
                prev.focus();
            }
        };
    }, [isOpen]);

    // Handle Tab / Shift+Tab cycling
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key !== 'Tab' || !containerRef.current) return;

        const focusableEls = Array.from(
            containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        );
        if (focusableEls.length === 0) {
            e.preventDefault();
            return;
        }

        const first = focusableEls[0];
        const last = focusableEls[focusableEls.length - 1];

        if (e.shiftKey) {
            // Shift+Tab: wrap from first to last
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            // Tab: wrap from last to first
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }, []);

    return { containerRef, handleKeyDown };
}

interface ModalWrapperProps {
    isOpen: boolean;
    children: React.ReactNode;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({ isOpen, children }) => {
    const shouldRender = useDelayUnmount(isOpen, 200);
    const { containerRef, handleKeyDown } = useFocusTrap(isOpen && shouldRender);

    // Prevent background scrolling while modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!shouldRender) return null;

    return (
        <div
            ref={containerRef}
            className={`modal-animation-controller ${!isOpen ? 'modal-closing' : 'modal-opening'}`}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none',
                outline: 'none',
            }}
        >
            <div style={{ pointerEvents: 'auto', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', width: '100%', height: '100%' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};
