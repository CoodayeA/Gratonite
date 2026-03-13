import { useRef, useCallback } from 'react';
import { haptic } from '../../utils/haptics';

interface SwipeableMessageProps {
  children: React.ReactNode;
  onSwipeRight?: () => void; // swipe right = reply
  disabled?: boolean;
}

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 80;

export default function SwipeableMessage({ children, onSwipeRight, disabled }: SwipeableMessageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const swiping = useRef(false);
  const triggered = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = 0;
    swiping.current = false;
    triggered.current = false;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !containerRef.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Only swipe right, and only if horizontal movement dominates
    if (!swiping.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5 && dx > 0) {
        swiping.current = true;
      } else if (Math.abs(dy) > 10) {
        return; // vertical scroll, bail
      } else {
        return;
      }
    }

    const clamped = Math.min(Math.max(dx, 0), MAX_SWIPE);
    currentX.current = clamped;
    containerRef.current.style.transform = `translateX(${clamped}px)`;
    containerRef.current.style.transition = 'none';

    if (clamped >= SWIPE_THRESHOLD && !triggered.current) {
      triggered.current = true;
      haptic.light();
    } else if (clamped < SWIPE_THRESHOLD) {
      triggered.current = false;
    }
  }, [disabled]);

  const handleTouchEnd = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.style.transition = 'transform 0.2s ease-out';
    containerRef.current.style.transform = 'translateX(0)';

    if (triggered.current && onSwipeRight) {
      onSwipeRight();
    }
    swiping.current = false;
    triggered.current = false;
  }, [onSwipeRight]);

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Reply indicator behind the message */}
      <div style={{
        position: 'absolute',
        left: '8px',
        top: '50%',
        transform: 'translateY(-50%)',
        opacity: currentX.current >= SWIPE_THRESHOLD ? 1 : 0.4,
        color: 'var(--accent-primary)',
        fontSize: '18px',
        transition: 'opacity 0.1s',
        pointerEvents: 'none',
      }}>
        &#8617;
      </div>
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ position: 'relative', zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  );
}
