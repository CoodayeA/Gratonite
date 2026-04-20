import { useState, useEffect, useMemo } from 'react';
import { Timer, BarChart2, Users, Cloud, Sun, CloudRain, Snowflake, Wind } from 'lucide-react';

type WidgetType = 'countdown' | 'progress' | 'server-stats' | 'weather';

interface CountdownData {
    targetDate: string;
    label: string;
}

interface ProgressData {
    title: string;
    current: number;
    total: number;
}

interface ServerStatsData {
    memberCount: number;
    onlineCount: number;
    messageCount: number;
}

interface WeatherData {
    city: string;
    temp: number;
    condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy';
    humidity: number;
}

interface EmbeddedWidgetProps {
    type: WidgetType;
    data: CountdownData | ProgressData | ServerStatsData | WeatherData;
}

const weatherIcons: Record<string, React.ReactNode> = {
    sunny: <Sun size={28} color="#f59e0b" />,
    cloudy: <Cloud size={28} color="#94a3b8" />,
    rainy: <CloudRain size={28} color="#60a5fa" />,
    snowy: <Snowflake size={28} color="#c4b5fd" />,
    windy: <Wind size={28} color="#a5b4fc" />,
};

const CountdownWidget = ({ data }: { data: CountdownData }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

    useEffect(() => {
        const update = () => {
            const diff = new Date(data.targetDate).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
                return;
            }
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeft({ days, hours, minutes, seconds, expired: false });
        };
        update();
        const iv = setInterval(update, 1000);
        return () => clearInterval(iv);
    }, [data.targetDate]);

    const units = [
        { label: 'Days', value: timeLeft.days },
        { label: 'Hours', value: timeLeft.hours },
        { label: 'Mins', value: timeLeft.minutes },
        { label: 'Secs', value: timeLeft.seconds },
    ];

    return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', marginTop: '8px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Timer size={18} color="var(--accent-primary)" />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{data.label}</span>
            </div>
            {timeLeft.expired ? (
                <div style={{ textAlign: 'center', padding: '12px', fontSize: '16px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    Event Started!
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {units.map(u => (
                        <div key={u.label} style={{
                            flex: 1, textAlign: 'center', padding: '12px 8px',
                            background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)',
                        }}>
                            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                {String(u.value).padStart(2, '0')}
                            </div>
                            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {u.label}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ProgressWidget = ({ data }: { data: ProgressData }) => {
    const percentage = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;

    return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', marginTop: '8px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <BarChart2 size={18} color="var(--accent-primary)" />
                <span style={{ fontSize: '14px', fontWeight: 600, flex: 1 }}>{data.title}</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: percentage >= 100 ? '#22c55e' : 'var(--accent-primary)' }}>
                    {percentage}%
                </span>
            </div>
            <div style={{ height: '12px', borderRadius: '6px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', borderRadius: '6px',
                    width: `${Math.min(percentage, 100)}%`,
                    background: percentage >= 100
                        ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                        : 'linear-gradient(90deg, var(--accent-primary), #818cf8)',
                    transition: 'width 0.5s ease-out',
                }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>{data.current.toLocaleString()} / {data.total.toLocaleString()}</span>
                <span>{percentage >= 100 ? 'Complete!' : `${data.total - data.current} remaining`}</span>
            </div>
        </div>
    );
};

const ServerStatsWidget = ({ data }: { data: ServerStatsData }) => {
    const stats = [
        { label: 'Members', value: data.memberCount, icon: <Users size={16} color="#8b5cf6" /> },
        { label: 'Online', value: data.onlineCount, icon: <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} /> },
        { label: 'Messages', value: data.messageCount, icon: <BarChart2 size={16} color="#f59e0b" /> },
    ];

    return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', marginTop: '8px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Users size={18} color="var(--accent-primary)" />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Portal Stats</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                {stats.map(s => (
                    <div key={s.label} style={{
                        flex: 1, textAlign: 'center', padding: '12px 8px',
                        background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>{s.icon}</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {s.value >= 1000 ? `${(s.value / 1000).toFixed(1)}k` : s.value}
                        </div>
                        <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {s.label}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const WeatherWidget = ({ data }: { data: WeatherData }) => {
    return (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', marginTop: '8px', maxWidth: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '10px' }}>
                    {weatherIcons[data.condition] ?? <Cloud size={28} color="#94a3b8" />}
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{data.city}</div>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {data.temp}°F
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize', marginTop: '2px' }}>
                        {data.condition} · {data.humidity}% humidity
                    </div>
                </div>
            </div>
        </div>
    );
};

const EmbeddedWidget = ({ type, data }: EmbeddedWidgetProps) => {
    switch (type) {
        case 'countdown':
            return <CountdownWidget data={data as CountdownData} />;
        case 'progress':
            return <ProgressWidget data={data as ProgressData} />;
        case 'server-stats':
            return <ServerStatsWidget data={data as ServerStatsData} />;
        case 'weather':
            return <WeatherWidget data={data as WeatherData} />;
        default:
            return null;
    }
};

export default EmbeddedWidget;
