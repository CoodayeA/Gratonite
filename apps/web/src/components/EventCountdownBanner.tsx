import { useState, useEffect, useCallback } from 'react';
import { Calendar, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface UpcomingEvent {
    id: string;
    name: string;
    startTime: string;
    guildId: string;
}

interface EventCountdownBannerProps {
    guildId: string;
}

function formatCountdown(targetMs: number): string {
    const diff = targetMs - Date.now();
    if (diff <= 0) return 'starting now';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

const EventCountdownBanner = ({ guildId }: EventCountdownBannerProps) => {
    const navigate = useNavigate();
    const [event, setEvent] = useState<UpcomingEvent | null>(null);
    const [countdown, setCountdown] = useState('');
    const [dismissed, setDismissed] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('gratonite-dismissed-event-banners');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    // Fetch upcoming events (within 24h)
    useEffect(() => {
        if (!guildId) return;
        api.events.list(guildId).then((events: any[]) => {
            const now = Date.now();
            const cutoff = now + 24 * 3600000; // 24 hours from now
            const upcoming = events
                .filter((e: any) => {
                    const start = new Date(e.startTime).getTime();
                    return start > now && start <= cutoff && !dismissed.has(e.id);
                })
                .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            if (upcoming.length > 0) {
                const e = upcoming[0];
                setEvent({
                    id: e.id,
                    name: e.name ?? e.title ?? 'Event',
                    startTime: e.startTime,
                    guildId,
                });
            } else {
                setEvent(null);
            }
        }).catch(() => {});
    }, [guildId, dismissed]);

    // Update countdown every minute
    useEffect(() => {
        if (!event) return;
        const update = () => setCountdown(formatCountdown(new Date(event.startTime).getTime()));
        update();
        const iv = setInterval(update, 60000);
        return () => clearInterval(iv);
    }, [event]);

    const handleDismiss = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!event) return;
        const next = new Set(dismissed);
        next.add(event.id);
        setDismissed(next);
        try {
            localStorage.setItem('gratonite-dismissed-event-banners', JSON.stringify([...next]));
        } catch {}
        setEvent(null);
    }, [event, dismissed]);

    if (!event) return null;

    return (
        <div
            onClick={() => navigate(`/guild/${guildId}/events`)}
            style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 16px',
                background: 'linear-gradient(90deg, rgba(82, 109, 245, 0.15), rgba(168, 85, 247, 0.10))',
                borderBottom: '1px solid rgba(82, 109, 245, 0.2)',
                cursor: 'pointer',
                fontSize: '13px',
                color: 'var(--text-primary)',
                position: 'relative',
                zIndex: 5,
            }}
        >
            <Calendar size={16} color="var(--accent-primary)" />
            <span style={{ fontWeight: 600 }}>{event.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>starts in</span>
            <span style={{
                fontWeight: 700, color: 'var(--accent-primary)',
                padding: '2px 8px', borderRadius: '6px',
                background: 'rgba(82, 109, 245, 0.12)',
            }}>
                {countdown}
            </span>
            <ChevronRight size={14} color="var(--text-muted)" style={{ marginLeft: 'auto' }} />
            <button
                onClick={handleDismiss}
                style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '2px', borderRadius: '4px',
                    display: 'flex', alignItems: 'center',
                }}
                title="Dismiss"
            >
                <X size={14} />
            </button>
        </div>
    );
};

export default EventCountdownBanner;
