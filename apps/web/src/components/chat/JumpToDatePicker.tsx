import { useState, useRef, useEffect, useCallback } from 'react';
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
    const panelRef = useRef<HTMLDivElement>(null);

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

    return (
        <div
            ref={panelRef}
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
                <button
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
                <button
                    onClick={prevMonth}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', padding: '4px',
                        borderRadius: '4px', display: 'flex',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                    <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {MONTHS[viewMonth]} {viewYear}
                </span>
                <button
                    onClick={canGoNext ? nextMonth : undefined}
                    style={{
                        background: 'none', border: 'none',
                        cursor: canGoNext ? 'pointer' : 'not-allowed',
                        color: canGoNext ? 'var(--text-secondary)' : 'var(--text-muted)',
                        padding: '4px', borderRadius: '4px', display: 'flex',
                        opacity: canGoNext ? 1 : 0.4,
                    }}
                    onMouseEnter={e => canGoNext && (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
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
                {cells.map((day, i) => (
                    <div
                        key={i}
                        onClick={() => day && !isFuture(day) && handleSelect(day)}
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
                            background: day && isToday(day) ? 'rgba(var(--accent-primary-rgb, 139,92,246), 0.1)' : 'transparent',
                            position: 'relative',
                        }}
                        onMouseEnter={e => {
                            if (day && !isFuture(day)) e.currentTarget.style.background = 'var(--bg-tertiary)';
                        }}
                        onMouseLeave={e => {
                            if (day && !isFuture(day)) {
                                e.currentTarget.style.background = isToday(day)
                                    ? 'rgba(var(--accent-primary-rgb, 139,92,246), 0.1)'
                                    : 'transparent';
                            }
                        }}
                    >
                        {day || ''}
                    </div>
                ))}
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
