import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useRef, ReactNode, useCallback } from 'react';
import { LucideIcon } from 'lucide-react';

export type ContextMenuItem = {
    id: string;
    label: string;
    icon?: LucideIcon;
    color?: string; // e.g. for destructive actions like delete
    onClick: () => void;
    divider?: boolean; // If true, rendering a divider below this item
};

type ContextMenuState = {
    isOpen: boolean;
    x: number;
    y: number;
    items: ContextMenuItem[];
    focusedIndex: number;
};

type ContextMenuContextType = {
    openMenu: (e: React.MouseEvent, items: ContextMenuItem[]) => void;
    openMenuAt: (x: number, y: number, items: ContextMenuItem[]) => void;
    closeMenu: () => void;
};

const ContextMenuContext = createContext<ContextMenuContextType | undefined>(undefined);

export const useContextMenu = () => {
    const ctx = useContext(ContextMenuContext);
    if (!ctx) throw new Error("useContextMenu must be used within ContextMenuProvider");
    return ctx;
};

export const ContextMenuProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<ContextMenuState>({
        isOpen: false,
        x: 0,
        y: 0,
        items: [],
        focusedIndex: -1
    });

    const [positioned, setPositioned] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Detect touch-only devices (no fine pointer / no hover)
    const isTouchDevice = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;

    const openMenuAt = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
        setPositioned(false);
        setState({
            isOpen: true,
            x,
            y,
            items,
            focusedIndex: 0
        });
    }, []);

    const openMenu = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
        e.preventDefault();
        e.stopPropagation();

        // Store the raw click coordinates; actual clamping happens after measurement
        openMenuAt(e.clientX, e.clientY, items);
    }, [openMenuAt]);

    // After the menu renders (hidden), measure it and clamp to viewport
    useLayoutEffect(() => {
        if (!state.isOpen || positioned || !menuRef.current) return;

        const rect = menuRef.current.getBoundingClientRect();
        const pad = 10;
        let x = state.x;
        let y = state.y;

        if (x + rect.width > window.innerWidth - pad) {
            x = window.innerWidth - rect.width - pad;
        }
        if (x < pad) x = pad;

        if (y + rect.height > window.innerHeight - pad) {
            y = window.innerHeight - rect.height - pad;
        }
        if (y < pad) y = pad;

        setState(prev => ({ ...prev, x, y }));
        setPositioned(true);
    }, [state.isOpen, state.x, state.y, positioned]);

    const closeMenu = useCallback(() => {
        setState(prev => ({ ...prev, isOpen: false }));
        setPositioned(false);
    }, []);

    useEffect(() => {
        const handleClickOutside = () => {
            if (state.isOpen) closeMenu();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!state.isOpen) return;
            if (e.key === 'Escape') closeMenu();
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setState(prev => ({ ...prev, focusedIndex: (prev.focusedIndex + 1) % prev.items.length }));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setState(prev => ({ ...prev, focusedIndex: (prev.focusedIndex - 1 + prev.items.length) % prev.items.length }));
            }
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (state.focusedIndex >= 0 && state.focusedIndex < state.items.length) {
                    state.items[state.focusedIndex].onClick();
                    closeMenu();
                }
            }
        };

        window.addEventListener('click', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('click', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [state.isOpen, state.items, state.focusedIndex, closeMenu]);

    return (
        <ContextMenuContext.Provider value={{ openMenu, openMenuAt, closeMenu }}>
            {children}

            {state.isOpen && (
                <>
                {/* Touch backdrop for bottom-sheet style */}
                {isTouchDevice && (
                    <div
                        onClick={closeMenu}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.5)',
                            zIndex: 99998,
                        }}
                    />
                )}
                <div
                    ref={menuRef}
                    className={isTouchDevice ? 'context-menu-touch' : ''}
                    style={{
                        position: 'fixed',
                        top: isTouchDevice ? undefined : state.y,
                        left: isTouchDevice ? undefined : state.x,
                        zIndex: 99999,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--stroke)',
                        borderRadius: isTouchDevice ? '16px 16px 0 0' : 'var(--radius-md)',
                        boxShadow: '0 16px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset',
                        padding: '8px',
                        minWidth: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        animation: positioned ? (isTouchDevice ? 'bottomSheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'popIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)') : 'none',
                        transformOrigin: 'top left',
                        backdropFilter: 'blur(20px)',
                        visibility: positioned ? 'visible' : 'hidden',
                        ...(isTouchDevice ? { bottom: 0, left: 0, right: 0, top: 'auto', paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' } : {}),
                    }}
                    role="menu"
                    aria-label="Context Menu"
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {isTouchDevice && (
                        <div className="context-menu-handle" style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 4px' }}>
                            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--text-muted)', opacity: 0.4 }} />
                        </div>
                    )}
                    {state.items.map((item, idx) => (
                        <React.Fragment key={item.id}>
                            <button
                                role="menuitem"
                                aria-label={item.label}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: isTouchDevice ? '12px 16px' : '8px 12px',
                                    minHeight: isTouchDevice ? '48px' : undefined,
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: item.color || 'var(--text-primary)',
                                    cursor: 'pointer',
                                    transition: 'background 0.1s, color 0.1s',
                                    textAlign: 'left',
                                    fontFamily: 'var(--font-sans)',
                                    fontSize: isTouchDevice ? '16px' : '14px',
                                    fontWeight: 500,
                                    outline: state.focusedIndex === idx ? '2px solid var(--accent-primary)' : 'none',
                                    outlineOffset: '-2px'
                                }}
                                onMouseEnter={() => setState(prev => ({ ...prev, focusedIndex: idx }))}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = item.color ? `color-mix(in srgb, ${item.color} 15%, transparent)` : 'var(--accent-primary)';
                                    if (!item.color) e.currentTarget.style.color = 'white';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    if (!item.color) e.currentTarget.style.color = 'var(--text-primary)';
                                }}
                                onClick={() => {
                                    item.onClick();
                                    closeMenu();
                                }}
                            >
                                {item.icon && <item.icon size={isTouchDevice ? 20 : 16} />}
                                {item.label}
                            </button>
                            {item.divider && <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }} />}
                        </React.Fragment>
                    ))}
                </div>
                </>
            )}
        </ContextMenuContext.Provider>
    );
};

/**
 * Hook for long-press (500ms hold) to trigger context menu on touch devices.
 * Returns touch event handlers to spread onto the target element.
 */
export function useLongPressMenu(items: ContextMenuItem[]) {
    const { openMenuAt } = useContextMenu();
    const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchPos = useRef<{ x: number; y: number } | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        if (!touch) return;
        touchPos.current = { x: touch.clientX, y: touch.clientY };
        touchTimer.current = setTimeout(() => {
            if (touchPos.current) {
                openMenuAt(touchPos.current.x, touchPos.current.y, items);
            }
            touchTimer.current = null;
        }, 500);
    }, [items, openMenuAt]);

    const handleTouchEnd = useCallback(() => {
        if (touchTimer.current) {
            clearTimeout(touchTimer.current);
            touchTimer.current = null;
        }
        touchPos.current = null;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        // Cancel if finger moves more than 10px (user is scrolling, not long-pressing)
        if (touchPos.current && e.touches[0]) {
            const dx = e.touches[0].clientX - touchPos.current.x;
            const dy = e.touches[0].clientY - touchPos.current.y;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                if (touchTimer.current) {
                    clearTimeout(touchTimer.current);
                    touchTimer.current = null;
                }
            }
        }
    }, []);

    return {
        onTouchStart: handleTouchStart,
        onTouchEnd: handleTouchEnd,
        onTouchCancel: handleTouchEnd,
        onTouchMove: handleTouchMove,
    };
}
