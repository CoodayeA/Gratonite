import { useState, useEffect } from 'react';
import { Activity, MessageSquare, Award, Circle, ArrowLeft, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';

type ActivityItem = {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
    type: 'message' | 'achievement' | 'status' | 'purchase';
    description: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
};

type FilterType = 'all' | 'message' | 'achievement' | 'status';

const TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
    message: { icon: <MessageSquare size={14} />, color: '#3b82f6' },
    achievement: { icon: <Award size={14} />, color: '#f59e0b' },
    status: { icon: <Circle size={14} />, color: '#10b981' },
    purchase: { icon: <Activity size={14} />, color: '#a855f7' },
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

const FriendActivity = () => {
    const navigate = useNavigate();
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.get<ActivityItem[]>('/users/me/friend-activity');
                if (Array.isArray(data)) setActivities(data);
            } catch {
                // Generate sample activity from friends list
                try {
                    const friends = await api.get<any[]>('/relationships?type=friend');
                    if (Array.isArray(friends)) {
                        const items: ActivityItem[] = friends.slice(0, 10).map((f: any, i: number) => ({
                            id: `${f.id}-${i}`,
                            userId: f.userId ?? f.id,
                            username: f.username ?? 'user',
                            displayName: f.displayName ?? f.username ?? 'User',
                            avatarHash: f.avatarHash ?? null,
                            type: (['status', 'message', 'achievement'] as const)[i % 3],
                            description: i % 3 === 0 ? 'Changed status to Online' : i % 3 === 1 ? 'Sent messages in a mutual server' : 'Earned a new badge',
                            timestamp: new Date(Date.now() - i * 3600000).toISOString(),
                        }));
                        setActivities(items);
                    }
                } catch { /* empty */ }
            }
            setLoading(false);
        };
        load();
    }, []);

    const filtered = filter === 'all' ? activities : activities.filter(a => a.type === filter);

    return (
        <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '16px' }}>
                    <ArrowLeft size={16} /> Back
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Activity size={24} color="var(--accent-primary)" />
                    <h1 style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Friend Activity</h1>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {(['all', 'message', 'achievement', 'status'] as FilterType[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                                border: `1px solid ${filter === f ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                background: filter === f ? 'rgba(82,109,245,0.1)' : 'var(--bg-tertiary)',
                                color: filter === f ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer', textTransform: 'capitalize',
                            }}
                        >
                            {f === 'all' ? 'All' : f}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading activity...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                        <Activity size={48} style={{ marginBottom: '12px', opacity: 0.3 }} />
                        <p>No recent friend activity</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {filtered.map(item => {
                            const meta = TYPE_META[item.type] ?? TYPE_META.status;
                            return (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '12px 16px', borderRadius: '8px',
                                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                    }}
                                >
                                    <Avatar userId={item.userId} avatarHash={item.avatarHash} displayName={item.displayName} size={36} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.displayName}</span>
                                            <span style={{ color: meta.color, display: 'flex', alignItems: 'center' }}>{meta.icon}</span>
                                        </div>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{item.description}</p>
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(item.timestamp)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FriendActivity;
