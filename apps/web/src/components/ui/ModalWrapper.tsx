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

/**
 * Hook for mobile bottom sheet drag-to-dismiss behavior
 */
function useBottomSheetDrag(isMobile: boolean, onDismiss?: () => void) {
    const dragRef = useRef<{ startY: number; currentY: number; dragging: boolean }>({ startY: 0, currentY: 0, dragging: false });
    const [dragOffset, setDragOffset] = useState(0);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (!isMobile) return;
        const target = e.target as HTMLElement;
        // Only start drag from the handle area (top 40px of modal)
        const rect = target.closest('[data-bottom-sheet]')?.getBoundingClientRect();
        if (!rect) return;
        const touchY = e.touches[0].clientY;
        if (touchY - rect.top > 40) return; // only drag from handle
        dragRef.current = { startY: touchY, currentY: touchY, dragging: true };
    }, [isMobile]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!dragRef.current.dragging) return;
        const touchY = e.touches[0].clientY;
        dragRef.current.currentY = touchY;
        const delta = Math.max(0, touchY - dragRef.current.startY);
        setDragOffset(delta);
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!dragRef.current.dragging) return;
        const delta = dragRef.current.currentY - dragRef.current.startY;
        dragRef.current.dragging = false;
        if (delta > 100 && onDismiss) {
            onDismiss();
        }
        setDragOffset(0);
    }, [onDismiss]);

    return { dragOffset, handleTouchStart, handleTouchMove, handleTouchEnd };
}

interface ModalWrapperProps {
    isOpen: boolean;
    children: React.ReactNode;
    onClose?: () => void;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({ isOpen, children, onClose }) => {
    const shouldRender = useDelayUnmount(isOpen, 200);
    const { containerRef, handleKeyDown } = useFocusTrap(isOpen && shouldRender);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const { dragOffset, handleTouchStart, handleTouchMove, handleTouchEnd } = useBottomSheetDrag(isMobile, onClose);

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

    if (isMobile) {
        return (
            <div
                ref={containerRef}
                className={`modal-animation-controller ${!isOpen ? 'modal-closing' : 'modal-opening'}`}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    outline: 'none',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                }}
            >
                {/* Backdrop */}
                <div
                    onClick={onClose}
                    style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        opacity: isOpen ? 1 - (dragOffset / 300) : 0,
                        transition: dragOffset ? 'none' : 'opacity 0.2s',
                    }}
                />

                {/* Bottom Sheet */}
                <div
                    data-bottom-sheet
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{
                        position: 'relative',
                        background: 'var(--bg-primary)',
                        borderRadius: '16px 16px 0 0',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        transform: `translateY(${dragOffset}px)`,
                        transition: dragOffset ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                        animation: isOpen ? 'bottomSheetSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
                    }}
                >
                    {/* Drag Handle */}
                    <div style={{
                        display: 'flex', justifyContent: 'center',
                        padding: '12px 0 8px',
                        cursor: 'grab',
                    }}>
                        <div style={{
                            width: '36px', height: '4px',
                            borderRadius: '2px',
                            background: 'var(--text-muted)',
                            opacity: 0.3,
                        }} />
                    </div>
                    {children}
                </div>

                <style>{`
                    @keyframes bottomSheetSlideUp {
                        from { transform: translateY(100%); }
                        to { transform: translateY(0); }
                    }
                `}</style>
            </div>
        );
    }

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
