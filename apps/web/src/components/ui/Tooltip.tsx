import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
    children: ReactNode;
    content: ReactNode;
    delay?: number;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
};

export const Tooltip: React.FC<TooltipProps> = ({ children, content, delay = 300, position = 'top', className = '' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showTooltip = () => {
        if (window.matchMedia('(hover: none)').matches) return;
        timeoutRef.current = setTimeout(() => {
            updatePosition();
            setIsVisible(true);
        }, delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(false);
    };

    const updatePosition = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();

        // We will do a basic offset calculation, assuming tooltip mounts immediately (which it doesn't always)
        // To properly do edge collision, we calculate based on viewport.
        // For simplicity, we just use rect.

        let x = rect.left + rect.width / 2;
        let y = rect.top;

        if (position === 'bottom') y = rect.bottom;
        if (position === 'left') { x = rect.left; y = rect.top + rect.height / 2; }
        if (position === 'right') { x = rect.right; y = rect.top + rect.height / 2; }

        setCoords({ x, y });
    };

    useEffect(() => {
        if (isVisible && tooltipRef.current) {
            const tRect = tooltipRef.current.getBoundingClientRect();
            let newX = coords.x;
            let newY = coords.y;

            if (position === 'top') newY -= tRect.height + 8;
            if (position === 'bottom') newY += 8;
            if (position === 'left') newX -= tRect.width + 8;
            if (position === 'right') newX += 8;

            // Optional: Bounce back on screen edges
            if (newX - tRect.width / 2 < 8) newX = tRect.width / 2 + 8;
            if (newX + tRect.width / 2 > window.innerWidth - 8) newX = window.innerWidth - tRect.width / 2 - 8;
            if (newY < 8) newY = 8;
            if (newY + tRect.height > window.innerHeight - 8) newY = window.innerHeight - tRect.height - 8;

            setCoords({ x: newX, y: newY });
        }
    }, [isVisible]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                style={{ display: 'inline-block' }}
                className={className}
            >
                {children}
            </div>
            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    style={{
                        position: 'fixed',
                        top: coords.y,
                        left: coords.x,
                        transform: `translate(${position === 'left' || position === 'right' ? '0' : '-50%'}, ${position === 'top' || position === 'bottom' ? '0' : '-50%'})`,
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-primary)',
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        fontWeight: 500,
                        pointerEvents: 'none',
                        zIndex: 99999,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        border: '1px solid var(--stroke)',
                        whiteSpace: 'nowrap',
                        animation: 'scaleIn 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                >
                    {content}
                </div>,
                document.body
            )}
        </>
    );
};
