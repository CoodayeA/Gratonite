import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';

interface ScheduledEvent {
    id: string;
    name: string;
    description: string | null;
    startTime: string;
    endTime: string | null;
    location: string | null;
    interestedCount: number;
    status: string;
    isInterested: boolean;
}

type CalendarView = 'month' | 'week' | 'day';

interface Props {
    events: ScheduledEvent[];
    onEventClick: (eventId: string) => void;
    onDateClick: (date: Date) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const EVENT_TYPE_COLORS: Record<string, string> = {
    voice: '#43b581',
    external: '#5865f2',
    text: '#faa61a',
    default: '#5865f2',
};

function getEventColor(event: ScheduledEvent): string {
    const loc = event.location?.toLowerCase() || '';
    if (loc.includes('voice') || loc.includes('vc')) return EVENT_TYPE_COLORS.voice;
    if (loc.includes('http') || loc.includes('external')) return EVENT_TYPE_COLORS.external;
    return EVENT_TYPE_COLORS.default;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(year: number, month: number): Date[][] {
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks: Date[][] = [];
    let current = new Date(year, month, 1 - startDay);
    while (current <= new Date(year, month, daysInMonth) || weeks.length < 6) {
        const week: Date[] = [];
        for (let i = 0; i < 7; i++) {
            week.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        weeks.push(week);
        if (weeks.length >= 6) break;
    }
    return weeks;
}

function getWeekDates(date: Date): Date[] {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return d;
    });
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function EventCalendarView({ events, onEventClick, onDateClick }: Props) {
    const [view, setView] = useState<CalendarView>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

    const [today, setToday] = useState(() => new Date());

    // Update `today` at midnight so the highlight stays correct
    useEffect(() => {
        const now = new Date();
        const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
        const timer = setTimeout(() => setToday(new Date()), msUntilMidnight);
        return () => clearTimeout(timer);
    }, [today]);

    const eventsByDate = useMemo(() => {
        const map = new Map<string, ScheduledEvent[]>();
        for (const event of events) {
            const d = new Date(event.startTime);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(event);
        }
        return map;
    }, [events]);

    const getEventsForDate = (date: Date): ScheduledEvent[] => {
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        return eventsByDate.get(key) || [];
    };

    const navigate = (direction: -1 | 1) => {
        const next = new Date(currentDate);
        if (view === 'month') next.setMonth(next.getMonth() + direction);
        else if (view === 'week') next.setDate(next.getDate() + 7 * direction);
        else next.setDate(next.getDate() + direction);
        setCurrentDate(next);
    };

    const goToToday = () => setCurrentDate(new Date());

    const headerLabel = view === 'month'
        ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
        : view === 'week'
            ? (() => {
                const week = getWeekDates(currentDate);
                return `${week[0].toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${week[6].toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
            })()
            : currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const viewBtnStyle = (active: boolean): React.CSSProperties => ({
        padding: '6px 14px',
        borderRadius: '6px',
        border: 'none',
        background: active ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
        color: active ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 600,
    });

    const eventPillStyle = (event: ScheduledEvent): React.CSSProperties => ({
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 600,
        color: '#fff',
        background: getEventColor(event),
        cursor: 'pointer',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap' as const,
        opacity: hoveredEvent === event.id ? 0.8 : 1,
        transition: 'opacity 0.15s',
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Header / Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => navigate(1)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <ChevronRight size={16} />
                    </button>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginLeft: '8px' }}>{headerLabel}</h3>
                    <button onClick={goToToday} style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginLeft: '8px' }}>
                        Today
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setView('month')} style={viewBtnStyle(view === 'month')}>Month</button>
                    <button onClick={() => setView('week')} style={viewBtnStyle(view === 'week')}>Week</button>
                    <button onClick={() => setView('day')} style={viewBtnStyle(view === 'day')}>Day</button>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: EVENT_TYPE_COLORS.voice }} /> Voice
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: EVENT_TYPE_COLORS.default }} /> General
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: EVENT_TYPE_COLORS.text }} /> Text
                </span>
            </div>

            {/* Calendar Body */}
            {view === 'month' && <MonthView
                currentDate={currentDate}
                today={today}
                getEventsForDate={getEventsForDate}
                onEventClick={onEventClick}
                onDateClick={onDateClick}
                eventPillStyle={eventPillStyle}
                hoveredEvent={hoveredEvent}
                setHoveredEvent={setHoveredEvent}
            />}
            {view === 'week' && <WeekView
                currentDate={currentDate}
                today={today}
                getEventsForDate={getEventsForDate}
                onEventClick={onEventClick}
                onDateClick={onDateClick}
                eventPillStyle={eventPillStyle}
                hoveredEvent={hoveredEvent}
                setHoveredEvent={setHoveredEvent}
            />}
            {view === 'day' && <DayView
                currentDate={currentDate}
                today={today}
                getEventsForDate={getEventsForDate}
                onEventClick={onEventClick}
                hoveredEvent={hoveredEvent}
                setHoveredEvent={setHoveredEvent}
            />}
        </div>
    );
}

/* ---- Month View ---- */
function MonthView({ currentDate, today, getEventsForDate, onEventClick, onDateClick, eventPillStyle, hoveredEvent, setHoveredEvent }: {
    currentDate: Date; today: Date;
    getEventsForDate: (d: Date) => ScheduledEvent[];
    onEventClick: (id: string) => void;
    onDateClick: (d: Date) => void;
    eventPillStyle: (e: ScheduledEvent) => React.CSSProperties;
    hoveredEvent: string | null;
    setHoveredEvent: (id: string | null) => void;
}) {
    const weeks = getMonthGrid(currentDate.getFullYear(), currentDate.getMonth());

    return (
        <div style={{ border: '1px solid var(--stroke)', borderRadius: '8px', overflow: 'hidden' }}>
            {/* Weekday headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--stroke)' }}>
                {WEEKDAYS.map(d => (
                    <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--bg-tertiary)' }}>
                        {d}
                    </div>
                ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < weeks.length - 1 ? '1px solid var(--stroke)' : undefined }}>
                    {week.map((date, di) => {
                        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                        const isToday = isSameDay(date, today);
                        const dayEvents = getEventsForDate(date);
                        return (
                            <div
                                key={di}
                                onClick={() => onDateClick(date)}
                                style={{
                                    minHeight: '80px',
                                    padding: '4px',
                                    borderRight: di < 6 ? '1px solid var(--stroke)' : undefined,
                                    background: isToday ? 'rgba(88, 101, 242, 0.08)' : 'transparent',
                                    cursor: 'pointer',
                                    opacity: isCurrentMonth ? 1 : 0.35,
                                }}
                            >
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: isToday ? 700 : 400,
                                    color: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isToday ? 'var(--accent-primary)' : 'transparent',
                                    ...(isToday ? { color: '#fff' } : {}),
                                    marginBottom: '2px',
                                }}>
                                    {date.getDate()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {dayEvents.slice(0, 3).map(ev => (
                                        <div
                                            key={ev.id}
                                            onClick={(e) => { e.stopPropagation(); onEventClick(ev.id); }}
                                            onMouseEnter={() => setHoveredEvent(ev.id)}
                                            onMouseLeave={() => setHoveredEvent(null)}
                                            style={eventPillStyle(ev)}
                                        >
                                            {ev.name}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                                            +{dayEvents.length - 3} more
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

/* ---- Week View ---- */
function WeekView({ currentDate, today, getEventsForDate, onEventClick, onDateClick, eventPillStyle, hoveredEvent, setHoveredEvent }: {
    currentDate: Date; today: Date;
    getEventsForDate: (d: Date) => ScheduledEvent[];
    onEventClick: (id: string) => void;
    onDateClick: (d: Date) => void;
    eventPillStyle: (e: ScheduledEvent) => React.CSSProperties;
    hoveredEvent: string | null;
    setHoveredEvent: (id: string | null) => void;
}) {
    const weekDates = getWeekDates(currentDate);

    return (
        <div style={{ border: '1px solid var(--stroke)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {weekDates.map((date, i) => {
                    const isToday = isSameDay(date, today);
                    const dayEvents = getEventsForDate(date);
                    return (
                        <div key={i} style={{ borderRight: i < 6 ? '1px solid var(--stroke)' : undefined, minHeight: '200px', display: 'flex', flexDirection: 'column' }}>
                            {/* Day header */}
                            <div
                                onClick={() => onDateClick(date)}
                                style={{
                                    padding: '8px',
                                    textAlign: 'center',
                                    borderBottom: '1px solid var(--stroke)',
                                    background: isToday ? 'rgba(88, 101, 242, 0.12)' : 'var(--bg-tertiary)',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                    {WEEKDAYS[date.getDay()]}
                                </div>
                                <div style={{
                                    fontSize: '18px',
                                    fontWeight: isToday ? 700 : 400,
                                    color: isToday ? '#fff' : 'var(--text-primary)',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: isToday ? 'var(--accent-primary)' : 'transparent',
                                }}>
                                    {date.getDate()}
                                </div>
                            </div>
                            {/* Events */}
                            <div style={{ flex: 1, padding: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {dayEvents.map(ev => (
                                    <div
                                        key={ev.id}
                                        onClick={() => onEventClick(ev.id)}
                                        onMouseEnter={() => setHoveredEvent(ev.id)}
                                        onMouseLeave={() => setHoveredEvent(null)}
                                        style={{
                                            ...eventPillStyle(ev),
                                            padding: '6px 8px',
                                            borderRadius: '6px',
                                            borderLeft: `3px solid ${getEventColor(ev)}`,
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-primary)',
                                        }}
                                    >
                                        <div style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.name}</div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                            <Clock size={10} />
                                            {new Date(ev.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ---- Day View ---- */
function DayView({ currentDate, today, getEventsForDate, onEventClick, hoveredEvent, setHoveredEvent }: {
    currentDate: Date; today: Date;
    getEventsForDate: (d: Date) => ScheduledEvent[];
    onEventClick: (id: string) => void;
    hoveredEvent: string | null;
    setHoveredEvent: (id: string | null) => void;
}) {
    const dayEvents = getEventsForDate(currentDate);
    const isToday = isSameDay(currentDate, today);

    const eventsByHour = useMemo(() => {
        const map = new Map<number, ScheduledEvent[]>();
        for (const ev of dayEvents) {
            const hour = new Date(ev.startTime).getHours();
            if (!map.has(hour)) map.set(hour, []);
            map.get(hour)!.push(ev);
        }
        return map;
    }, [dayEvents]);

    return (
        <div style={{ border: '1px solid var(--stroke)', borderRadius: '8px', overflow: 'hidden', maxHeight: '500px', overflowY: 'auto' }}>
            {HOURS.map(hour => {
                const hourEvents = eventsByHour.get(hour) || [];
                const now = new Date();
                const isCurrentHour = isToday && now.getHours() === hour;
                return (
                    <div key={hour} style={{ display: 'flex', borderBottom: '1px solid var(--stroke)', minHeight: '48px', background: isCurrentHour ? 'rgba(88, 101, 242, 0.06)' : undefined }}>
                        {/* Time label */}
                        <div style={{
                            width: '60px',
                            flexShrink: 0,
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: isCurrentHour ? 'var(--accent-primary)' : 'var(--text-muted)',
                            fontWeight: isCurrentHour ? 700 : 400,
                            textAlign: 'right',
                            borderRight: '1px solid var(--stroke)',
                        }}>
                            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                        </div>
                        {/* Events in this hour */}
                        <div style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {hourEvents.map(ev => (
                                <div
                                    key={ev.id}
                                    onClick={() => onEventClick(ev.id)}
                                    onMouseEnter={() => setHoveredEvent(ev.id)}
                                    onMouseLeave={() => setHoveredEvent(null)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        borderLeft: `3px solid ${getEventColor(ev)}`,
                                        background: hoveredEvent === ev.id ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.name}</div>
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <Clock size={10} />
                                            {new Date(ev.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                            {ev.endTime && ` - ${new Date(ev.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                                        </span>
                                        {ev.location && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <MapPin size={10} /> {ev.location}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
