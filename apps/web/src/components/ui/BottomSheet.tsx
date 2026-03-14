import React, { useState, useRef, useEffect, useCallback, ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Max height as CSS value (default "85vh") */
  maxHeight?: string;
}

/**
 * Full-screen bottom sheet for mobile (<768px).
 * Renders as a regular centered modal on desktop.
 * Supports swipe-to-dismiss gesture.
 */
const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '85vh',
}) => {
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Only allow drag from the handle area or top portion
    if (target.closest('.bottom-sheet-handle') || target.closest('.bottom-sheet-header')) {
      startY.current = e.touches[0].clientY;
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = e.touches[0].clientY - startY.current;
    if (deltaY > 0) {
      setTranslateY(deltaY);
    }
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    // Dismiss if dragged more than 100px
    if (translateY > 100) {
      onClose();
    }
    setTranslateY(0);
  }, [isDragging, translateY, onClose]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setTranslateY(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="bottom-sheet-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
          animation: 'fadeIn 0.2s ease',
        }}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="bottom-sheet"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight,
          zIndex: 9999,
          background: 'var(--bg-elevated)',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Drag handle */}
        <div className="bottom-sheet-handle" style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '10px 0 4px',
          cursor: 'grab',
        }}>
          <div style={{
            width: '36px',
            height: '4px',
            borderRadius: '2px',
            background: 'var(--text-muted)',
            opacity: 0.4,
          }} />
        </div>
        {/* Header */}
        {title && (
          <div className="bottom-sheet-header" style={{
            padding: '8px 16px 12px',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            borderBottom: '1px solid var(--stroke)',
          }}>
            {title}
          </div>
        )}
        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '8px 0',
        }}>
          {children}
        </div>
      </div>
    </>
  );
};

export default BottomSheet;
