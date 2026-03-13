import { useState, useEffect } from 'react';
import { Award, Lock, Star, Users, Coins, Zap, ArrowLeft } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

type Badge = {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'activity' | 'social' | 'economy' | 'special';
    requirement: string;
    progress: number;
    target: number;
    earned: boolean;
    earnedAt?: string;
};

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    activity: { label: 'Activity', icon: <Zap size={14} />, color: '#3b82f6' },
    social: { label: 'Social', icon: <Users size={14} />, color: '#10b981' },
    economy: { label: 'Economy', icon: <Coins size={14} />, color: '#f59e0b' },
    special: { label: 'Special', icon: <Star size={14} />, color: '#a855f7' },
};

const DEFAULT_BADGES: Badge[] = [
    { id: 'first_message', name: 'First Words', description: 'Send your first message', icon: '💬', category: 'activity', requirement: 'Send 1 message', progress: 0, target: 1, earned: false },
    { id: 'chatterbox', name: 'Chatterbox', description: 'Send 100 messages', icon: '🗣️', category: 'activity', requirement: 'Send 100 messages', progress: 0, target: 100, earned: false },
    { id: 'veteran', name: 'Veteran', description: 'Send 1000 messages', icon: '🎖️', category: 'activity', requirement: 'Send 1,000 messages', progress: 0, target: 1000, earned: false },
    { id: 'daily_streak_7', name: 'Weekly Warrior', description: 'Check in 7 days in a row', icon: '🔥', category: 'activity', requirement: '7-day check-in streak', progress: 0, target: 7, earned: false },
    { id: 'daily_streak_30', name: 'Monthly Master', description: 'Check in 30 days in a row', icon: '⚡', category: 'activity', requirement: '30-day check-in streak', progress: 0, target: 30, earned: false },
    { id: 'first_friend', name: 'Social Butterfly', description: 'Add your first friend', icon: '🤝', category: 'social', requirement: 'Add 1 friend', progress: 0, target: 1, earned: false },
    { id: 'popular', name: 'Popular', description: 'Have 10 friends', icon: '🌟', category: 'social', requirement: 'Have 10 friends', progress: 0, target: 10, earned: false },
    { id: 'fame_receiver', name: 'Famous', description: 'Receive 50 FAME', icon: '⭐', category: 'social', requirement: 'Receive 50 FAME', progress: 0, target: 50, earned: false },
    { id: 'guild_joiner', name: 'Server Explorer', description: 'Join 5 servers', icon: '🏠', category: 'social', requirement: 'Join 5 servers', progress: 0, target: 5, earned: false },
    { id: 'first_purchase', name: 'First Purchase', description: 'Buy your first item', icon: '🛒', category: 'economy', requirement: 'Buy 1 item from the shop', progress: 0, target: 1, earned: false },
    { id: 'big_spender', name: 'Big Spender', description: 'Spend 5000 Gratonites', icon: '💎', category: 'economy', requirement: 'Spend 5,000 Gratonites', progress: 0, target: 5000, earned: false },
    { id: 'collector', name: 'Collector', description: 'Own 10 cosmetics', icon: '🎨', category: 'economy', requirement: 'Own 10 cosmetics', progress: 0, target: 10, earned: false },
    { id: 'gacha_lucky', name: 'Lucky Pull', description: 'Get a legendary from gacha', icon: '🎰', category: 'economy', requirement: 'Pull a Legendary item', progress: 0, target: 1, earned: false },
    { id: 'early_adopter', name: 'Early Adopter', description: 'Joined during beta', icon: '🌅', category: 'special', requirement: 'Join during the beta period', progress: 0, target: 1, earned: false },
    { id: 'bug_hunter', name: 'Bug Hunter', description: 'Report 5 valid bugs', icon: '🐛', category: 'special', requirement: 'Report 5 valid bugs', progress: 0, target: 5, earned: false },
    { id: 'admin', name: 'Staff', description: 'Gratonite team member', icon: '🛡️', category: 'special', requirement: 'Be a Gratonite staff member', progress: 0, target: 1, earned: false },
];

const BadgesGallery = () => {
    const navigate = useNavigate();
    const [badges, setBadges] = useState<Badge[]>(DEFAULT_BADGES);
    const [filter, setFilter] = useState<string>('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const [achievements, stats] = await Promise.all([
                    api.get<any[]>('/achievements').catch(() => []),
                    api.get<any>('/users/@me/stats').catch(() => null),
                ]);
                if (Array.isArray(achievements) && achievements.length > 0) {
                    setBadges(prev => prev.map(b => {
                        const match = achievements.find((a: any) => a.key === b.id || a.id === b.id);
                        if (match) {
                            return { ...b, earned: !!match.earnedAt, progress: match.progress ?? b.progress, earnedAt: match.earnedAt };
                        }
                        return b;
                    }));
                }
                if (stats) {
                    setBadges(prev => prev.map(b => {
                        if (b.id === 'first_message' || b.id === 'chatterbox' || b.id === 'veteran') {
                            const count = stats.messageCount ?? stats.messages ?? 0;
                            return { ...b, progress: Math.min(count, b.target), earned: count >= b.target };
                        }
                        return b;
                    }));
                }
            } catch { /* use defaults */ }
            setLoading(false);
        };
        load();
    }, []);

    const categories = ['all', 'activity', 'social', 'economy', 'special'];
    const filtered = filter === 'all' ? badges : badges.filter(b => b.category === filter);
    const earnedCount = badges.filter(b => b.earned).length;

    return (
        <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', marginBottom: '16px' }}>
                    <ArrowLeft size={16} /> Back
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Award size={28} color="var(--accent-primary)" />
                    <h1 style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Badges Gallery</h1>
                </div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                    {earnedCount} of {badges.length} badges earned
                </p>

                {/* Progress bar */}
                <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', marginBottom: '24px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(earnedCount / badges.length) * 100}%`, background: 'var(--accent-primary)', borderRadius: '3px', transition: 'width 0.3s' }} />
                </div>

                {/* Category filter */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                    {categories.map(cat => {
                        const meta = CATEGORY_META[cat];
                        return (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                style={{
                                    padding: '6px 16px', borderRadius: '20px', border: '1px solid',
                                    borderColor: filter === cat ? (meta?.color ?? 'var(--accent-primary)') : 'var(--stroke)',
                                    background: filter === cat ? `${meta?.color ?? 'var(--accent-primary)'}20` : 'var(--bg-tertiary)',
                                    color: filter === cat ? (meta?.color ?? 'var(--accent-primary)') : 'var(--text-secondary)',
                                    cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                }}
                            >
                                {meta?.icon} {cat === 'all' ? 'All' : meta?.label}
                            </button>
                        );
                    })}
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading badges...</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                        {filtered.map(badge => {
                            const meta = CATEGORY_META[badge.category];
                            const pct = badge.target > 0 ? Math.min(100, (badge.progress / badge.target) * 100) : 0;
                            return (
                                <div
                                    key={badge.id}
                                    style={{
                                        background: 'var(--bg-elevated)',
                                        border: `1px solid ${badge.earned ? (meta?.color ?? 'var(--accent-primary)') : 'var(--stroke)'}`,
                                        borderRadius: '12px',
                                        padding: '20px',
                                        position: 'relative',
                                        opacity: badge.earned ? 1 : 0.65,
                                        transition: 'opacity 0.2s, transform 0.2s',
                                    }}
                                >
                                    {!badge.earned && (
                                        <div style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--text-muted)' }}>
                                            <Lock size={14} />
                                        </div>
                                    )}
                                    <div style={{ fontSize: '32px', marginBottom: '8px', filter: badge.earned ? 'none' : 'grayscale(1)' }}>
                                        {badge.icon}
                                    </div>
                                    <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>{badge.name}</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{badge.description}</p>
                                    <p style={{ fontSize: '11px', color: meta?.color ?? 'var(--text-secondary)', marginBottom: '8px' }}>{badge.requirement}</p>
                                    {!badge.earned && (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                <span>Progress</span>
                                                <span>{badge.progress}/{badge.target}</span>
                                            </div>
                                            <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: meta?.color ?? 'var(--accent-primary)', borderRadius: '2px', transition: 'width 0.3s' }} />
                                            </div>
                                        </div>
                                    )}
                                    {badge.earned && badge.earnedAt && (
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                            Earned {new Date(badge.earnedAt).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BadgesGallery;
