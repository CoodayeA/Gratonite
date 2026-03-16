import { useCallback, useRef, useState } from 'react';

/**
 * Hook for arrow-key navigation in lists (Feature 15: Keyboard Navigation).
 * Implements WAI-ARIA roving tabindex pattern.
 */
export function useRovingTabIndex(itemCount: number, options?: {
    orientation?: 'vertical' | 'horizontal' | 'both';
    wrap?: boolean;
    onSelect?: (index: number) => void;
}) {
    const { orientation = 'vertical', wrap = true, onSelect } = options || {};
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLElement>(null);

    const focusItem = useCallback((index: number) => {
        if (!containerRef.current) return;
        const items = containerRef.current.querySelectorAll('[data-roving-item]');
        const item = items[index] as HTMLElement | undefined;
        if (item) {
            item.focus();
            setActiveIndex(index);
        }
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const isVertical = orientation === 'vertical' || orientation === 'both';
        const isHorizontal = orientation === 'horizontal' || orientation === 'both';

        let nextIndex = activeIndex;
        let handled = false;

        if ((e.key === 'ArrowDown' && isVertical) || (e.key === 'ArrowRight' && isHorizontal)) {
            nextIndex = activeIndex + 1;
            if (nextIndex >= itemCount) nextIndex = wrap ? 0 : itemCount - 1;
            handled = true;
        } else if ((e.key === 'ArrowUp' && isVertical) || (e.key === 'ArrowLeft' && isHorizontal)) {
            nextIndex = activeIndex - 1;
            if (nextIndex < 0) nextIndex = wrap ? itemCount - 1 : 0;
            handled = true;
        } else if (e.key === 'Home') {
            nextIndex = 0;
            handled = true;
        } else if (e.key === 'End') {
            nextIndex = itemCount - 1;
            handled = true;
        } else if (e.key === 'Enter' || e.key === ' ') {
            onSelect?.(activeIndex);
            handled = true;
        }

        if (handled) {
            e.preventDefault();
            e.stopPropagation();
            focusItem(nextIndex);
        }
    }, [activeIndex, itemCount, orientation, wrap, onSelect, focusItem]);

    const getItemProps = useCallback((index: number) => ({
        'data-roving-item': '',
        tabIndex: index === activeIndex ? 0 : -1,
        onFocus: () => setActiveIndex(index),
    }), [activeIndex]);

    return {
        containerRef,
        activeIndex,
        setActiveIndex,
        handleKeyDown,
        getItemProps,
        focusItem,
    };
}
