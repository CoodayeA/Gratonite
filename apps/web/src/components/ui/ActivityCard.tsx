import { useState, useEffect } from 'react';
import { type ActivityEntry, formatElapsed } from '../../utils/activity';

const TYPE_LABELS: Record<string, string> = {
    game: 'PLAYING A GAME',
    music: 'LISTENING TO SPOTIFY',
    streaming: 'LIVE ON TWITCH',
    watching: 'WATCHING',
};

const TYPE_COLORS: Record<string, string> = {
    game: 'var(--success, #22c55e)',
    music: '#1DB954',
    streaming: '#9146FF',
    watching: '#F47521',
};

const ActivityCard = ({ activity, compact = false }: { activity: ActivityEntry; compact?: boolean }) => {
    const [elapsed, setElapsed] = useState(() => Date.now() - activity.startedAt);

    // Update elapsed timer every 30s
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Date.now() - activity.startedAt);
        }, 30000);
        return () => clearInterval(interval);
    }, [activity.startedAt]);

    if (compact) {
        const verb = activity.type === 'game' ? 'Playing' : activity.type === 'music' ? 'Listening to' : activity.type === 'watching' ? 'Watching' : 'Streaming on';
        const label = activity.type === 'music' ? (activity.details || activity.name) : activity.name;
        return (
            <div style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
            }}>
                <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: TYPE_COLORS[activity.type] || 'var(--text-muted)',
                    flexShrink: 0,
                }} />
                {verb} <strong style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</strong>
                <span style={{ opacity: 0.7 }}>&middot; {formatElapsed(elapsed)}</span>
            </div>
        );
    }

    return (
        <div style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--stroke)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '12px',
            marginTop: '8px',
        }}>
            {/* Type label */}
            <div style={{
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: TYPE_COLORS[activity.type] || 'var(--text-muted)',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
            }}>
                <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: TYPE_COLORS[activity.type] || 'var(--text-muted)',
                }} />
                {TYPE_LABELS[activity.type] || 'ACTIVITY'}
            </div>

            {/* Activity name */}
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                {activity.name}
            </div>

            {/* Rich presence details */}
            {activity.isRichPresence && activity.details && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '1px' }}>
                    {activity.details}
                </div>
            )}

            {/* State + elapsed */}
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {activity.isRichPresence && activity.state && (
                    <span>{activity.state}</span>
                )}
                {activity.isRichPresence && activity.state && <span>&middot;</span>}
                <span>{formatElapsed(elapsed)} elapsed</span>
            </div>

            {/* Platform badge */}
            {activity.platform && (
                <div style={{
                    marginTop: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-elevated)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    textTransform: 'capitalize',
                }}>
                    {activity.platform}
                </div>
            )}
        </div>
    );
};

export default ActivityCard;
