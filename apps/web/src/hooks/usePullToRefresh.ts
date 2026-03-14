import { useEffect, useRef, useState, RefObject } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;       // px to pull before triggering (default 80)
  maxPull?: number;          // max pull distance in px (default 120)
  disabled?: boolean;
}

/**
 * Pull-to-refresh hook for mobile. Attach to a scrollable container.
 * Returns { isRefreshing, pullDistance } for rendering a visual indicator.
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement>,
  options: PullToRefreshOptions,
) {
  const { onRefresh, threshold = 80, maxPull = 120, disabled = false } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      // Only start pull when scrolled to top
      if (el.scrollTop > 0 || isRefreshing) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling.current || isRefreshing) return;
      const deltaY = e.touches[0].clientY - startY.current;
      if (deltaY < 0) {
        pulling.current = false;
        setPullDistance(0);
        return;
      }
      // Rubber-band effect: diminishing returns past threshold
      const distance = Math.min(deltaY * 0.5, maxPull);
      setPullDistance(distance);
      if (distance > 10) {
        e.preventDefault(); // prevent native scroll
      }
    };

    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold * 0.5); // hold at half-height while refreshing
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref, disabled, isRefreshing, threshold, maxPull, onRefresh, pullDistance]);

  return { isRefreshing, pullDistance };
}
