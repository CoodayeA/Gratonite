import { useEffect, RefObject } from 'react';

interface SwipeHandlers {
    onSwipeRight?: () => void;
    onSwipeLeft?: () => void;
}

const SWIPE_X_THRESHOLD = 60;
const SWIPE_Y_CANCEL = 40;

export function useMobileSwipe(
    ref: RefObject<HTMLElement>,
    handlers: SwipeHandlers,
) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let startX = 0;
        let startY = 0;

        const onTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        };

        const onTouchEnd = (e: TouchEvent) => {
            const deltaX = e.changedTouches[0].clientX - startX;
            const deltaY = e.changedTouches[0].clientY - startY;

            // Ignore if primarily a vertical scroll
            if (Math.abs(deltaY) > SWIPE_Y_CANCEL) return;

            // Edge-start: only trigger if swipe started near screen edge
            if (deltaX > SWIPE_X_THRESHOLD && startX < 30) {
                handlers.onSwipeRight?.();
            } else if (deltaX < -SWIPE_X_THRESHOLD && startX > window.innerWidth - 30) {
                handlers.onSwipeLeft?.();
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [ref, handlers.onSwipeRight, handlers.onSwipeLeft]);
}
