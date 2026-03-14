import { useEffect, useRef, RefObject } from 'react';

interface SwipeHandlers {
    onSwipeRight?: () => void;
    onSwipeLeft?: () => void;
    /** Called during active swipe with progress 0-1 (for visual indicator) */
    onSwipeProgress?: (progress: number, direction: 'left' | 'right') => void;
}

const SWIPE_X_THRESHOLD = 60;
const SWIPE_Y_CANCEL = 40;
const EDGE_ZONE = 40; // px from screen edge to start swipe

export function useMobileSwipe(
    ref: RefObject<HTMLElement>,
    handlers: SwipeHandlers,
) {
    const handlersRef = useRef(handlers);
    handlersRef.current = handlers;

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let startX = 0;
        let startY = 0;
        let isEdgeSwipe = false;
        let swipeDirection: 'left' | 'right' | null = null;

        const onTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isEdgeSwipe = startX < EDGE_ZONE || startX > window.innerWidth - EDGE_ZONE;
            swipeDirection = null;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!isEdgeSwipe) return;
            const deltaX = e.touches[0].clientX - startX;
            const deltaY = e.touches[0].clientY - startY;

            if (Math.abs(deltaY) > SWIPE_Y_CANCEL) {
                isEdgeSwipe = false;
                handlersRef.current.onSwipeProgress?.(0, 'right');
                return;
            }

            if (Math.abs(deltaX) > 10) {
                swipeDirection = deltaX > 0 ? 'right' : 'left';
                const progress = Math.min(Math.abs(deltaX) / SWIPE_X_THRESHOLD, 1);
                handlersRef.current.onSwipeProgress?.(progress, swipeDirection);
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            const deltaX = e.changedTouches[0].clientX - startX;
            const deltaY = e.changedTouches[0].clientY - startY;

            // Reset progress indicator
            handlersRef.current.onSwipeProgress?.(0, swipeDirection || 'right');

            // Ignore if primarily a vertical scroll
            if (Math.abs(deltaY) > SWIPE_Y_CANCEL) return;

            // Edge-start: only trigger if swipe started near screen edge
            if (deltaX > SWIPE_X_THRESHOLD && startX < EDGE_ZONE) {
                handlersRef.current.onSwipeRight?.();
            } else if (deltaX < -SWIPE_X_THRESHOLD && startX > window.innerWidth - EDGE_ZONE) {
                handlersRef.current.onSwipeLeft?.();
            }

            isEdgeSwipe = false;
            swipeDirection = null;
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [ref]);
}
