import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

type Props = {
    onSelect: (date: string) => void;
    onClose: () => void;
    loading?: boolean;
};

export function JumpToDatePicker({ onSelect, onClose, loading }: Props) {
    const now = new Date();
    const [viewYear, setViewYear] = useState(now.getFullYear());
    const [viewMonth, setViewMonth] = useState(now.getMonth());
    const [activeDay, setActiveDay] = useState<number>(now.getDate());
    const panelRef = useRef<HTMLDivElement>(null);

    // Focus the panel when mounted so arrow keys are received
    useEffect(() => {
        panelRef.current?.focus();
    }, []);

    // Close on click-outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const prevMonth = useCallback(() => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(y => y - 1);
        } else {
            setViewMonth(m => m - 1);
        }
    }, [viewMonth]);

    const nextMonth = useCallback(() => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(y => y + 1);
        } else {
            setViewMonth(m => m + 1);
        }
    }, [viewMonth]);

    // Build calendar grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const isToday = (day: number) => {
        return day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
    };

    const isFuture = (day: number) => {
        const d = new Date(viewYear, viewMonth, day);
        d.setHours(0, 0, 0, 0);
        return d > today;
    };

    const handleSelect = (day: number) => {
        if (isFuture(day)) return;
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onSelect(dateStr);
    };

    // Can't navigate to future months
    const canGoNext = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

    // Clamp activeDay if it falls outside the current month
    useEffect(() => {
        setActiveDay(d => Math.min(Math.max(1, d), daysInMonth));
    }, [daysInMonth]);

    const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
        // Escape is already handled by global listener; keep here for safety
        if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (activeDay > 1) setActiveDay(activeDay - 1);
            else { prevMonth(); setActiveDay(new Date(viewYear, viewMonth, 0).getDate()); }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = activeDay + 1;
            if (next <= daysInMonth) {
                if (!isFuture(next)) setActiveDay(next);
            } else if (canGoNext) {
                nextMonth();
                setActiveDay(1);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = activeDay - 7;
            if (next >= 1) setActiveDay(next);
            else { prevMonth(); const prevDays = new Date(viewYear, viewMonth, 0).getDate(); setActiveDay(Math.max(1, prevDays + next)); }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = activeDay + 7;
            if (next <= daysInMonth) {
                if (!isFuture(next)) setActiveDay(next);
                else setActiveDay(activeDay);
            } else if (canGoNext) {
                nextMonth();
                setActiveDay(Math.max(1, next - daysInMonth));
            }
        } else if (e.key === 'Home') {
            e.preventDefault();
            setActiveDay(1);
        } else if (e.key === 'End') {
            e.preventDefault();
            setActiveDay(daysInMonth);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect(activeDay);
        }
    };

    return (
        <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="Jump to date"
            onKeyDown={onKey}
            style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '280px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-lg, 12px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                zIndex: 50,
                overflow: 'hidden',
                animation: 'fadeInSlideUp 0.2s ease-out',
                outline: 'none',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--stroke)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-tertiary)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        Jump to Date
                    </span>
                </div>
                <button aria-label="Close"
                    onClick={onClose}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '2px', display: 'flex',
                    }}
                >
                    <X size={14} />
                </button>
            </div>

            {/* Month Navigation */}
            <div style={{
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <button aria-label="Previous month"
                    onClick={prevMonth}
                    className="hover-bg-tertiary"
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', padding: '4px',
                        borderRadius: '4px', display: 'flex',
                    }}
                >
                    <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {MONTHS[viewMonth]} {viewYear}
                </span>
                <button aria-label="Next month"
                    onClick={canGoNext ? nextMonth : undefined}
                    style={{
                        background: 'none', border: 'none',
                        cursor: canGoNext ? 'pointer' : 'not-allowed',
                        color: canGoNext ? 'var(--text-secondary)' : 'var(--text-muted)',
                        padding: '4px', borderRadius: '4px', display: 'flex',
                        opacity: canGoNext ? 1 : 0.4,
                    }}
                    className={canGoNext ? 'hover-bg-tertiary' : ''}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Day headers */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                padding: '0 12px', gap: '0',
            }}>
                {DAYS.map(d => (
                    <div key={d} style={{
                        textAlign: 'center', fontSize: '10px', fontWeight: 600,
                        color: 'var(--text-muted)', padding: '4px 0',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                padding: '4px 12px 12px', gap: '2px',
            }}>
                {cells.map((day, i) => {
                    const isActive = day === activeDay;
                    return (
                    <div
                        key={i}
                        role={day && !isFuture(day) ? 'button' : undefined}
                        aria-current={day && isActive ? 'date' : undefined}
                        onClick={() => day && !isFuture(day) && handleSelect(day)}
                        onMouseEnter={() => day && !isFuture(day) && setActiveDay(day)}
                        className={day && !isFuture(day) ? 'hover-bg-tertiary' : ''}
                        style={{
                            textAlign: 'center',
                            padding: '6px 0',
                            fontSize: '12px',
                            fontWeight: day && isToday(day) ? 700 : 500,
                            color: !day ? 'transparent'
                                : isFuture(day) ? 'var(--text-muted)'
                                : isToday(day) ? 'var(--accent-primary)'
                                : 'var(--text-secondary)',
                            cursor: day && !isFuture(day) ? 'pointer' : 'default',
                            borderRadius: '6px',
                            transition: 'background 0.15s',
                            opacity: !day ? 0 : isFuture(day) ? 0.3 : 1,
                            background: day && isActive && !isFuture(day)
                                ? 'rgba(var(--accent-primary-rgb, 139,92,246), 0.25)'
                                : (day && isToday(day) ? 'rgba(var(--accent-primary-rgb, 139,92,246), 0.1)' : 'transparent'),
                            outline: day && isActive && !isFuture(day) ? '1px solid var(--accent-primary)' : 'none',
                            position: 'relative',
                        }}
                    >
                        {day || ''}
                    </div>
                    );
                })}
            </div>

            {/* Loading overlay */}
            {loading && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 'var(--radius-lg, 12px)',
                }}>
                    <Loader2 size={24} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                </div>
            )}
        </div>
    );
}
