import { useState, useEffect } from 'react';
import { Zap, Check, Lock, Users, AlertCircle } from 'lucide-react';
import { api, API_BASE } from '../../../lib/api';

type AddToastFn = (t: { title: string; description?: string; variant: 'success' | 'error' | 'info' | 'achievement' | 'undo' }) => void;

interface BoostsPanelProps {
    guildId: string;
    addToast: AddToastFn;
}

interface BoosterEntry {
    userId: string;
    username: string;
    avatarHash: string | null;
    boostedAt: string;
}

const TIERS = [
    {
        tier: 0, name: 'No Tier', min: 0, color: '#72767d',
        gradient: 'linear-gradient(135deg, #72767d22, var(--bg-tertiary))',
        perks: [] as string[],
    },
    {
        tier: 1, name: 'Tier 1', min: 2, color: '#b84ef7',
        gradient: 'linear-gradient(135deg, #b84ef722, var(--bg-tertiary))',
        perks: [
            '50 custom emoji slots',
            'Enhanced audio quality (128kbps)',
            'Custom invite backgrounds',
            'Animated server icon',
        ],
    },
    {
        tier: 2, name: 'Tier 2', min: 7, color: '#7983f5',
        gradient: 'linear-gradient(135deg, #7983f533, var(--bg-tertiary))',
        perks: [
            '100 custom emoji slots',
            '256kbps audio quality',
            'Larger file uploads (50MB)',
            'Server banner',
            'Custom role icons',
        ],
    },
    {
        tier: 3, name: 'Tier 3', min: 14, color: '#ffd700',
        gradient: 'linear-gradient(135deg, #ffd70033, var(--bg-tertiary))',
        perks: [
            '250 custom emoji slots',
            '384kbps audio quality',
            '100MB file uploads',
            'Custom vanity URL',
            'Animated server banner',
            'Custom sticker slots',
        ],
    },
] as const;

const TIER_EMOJI = ['', '⚡', '⚡⚡', '⚡⚡⚡'] as const;

function formatRelativeDate(iso: string): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
}

function ConfettiBurst() {
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
            <style>{`
                @keyframes gtn-confettiFall {
                    0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
            `}</style>
            {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} style={{
                    position: 'absolute',
                    left: `${5 + Math.random() * 90}%`,
                    top: `${Math.random() * 30}%`,
                    width: `${6 + Math.random() * 8}px`,
                    height: `${6 + Math.random() * 8}px`,
                    background: ['#b84ef7', '#ffd700', '#7983f5', '#10b981', '#f59e0b', '#ef4444'][Math.floor(Math.random() * 6)],
                    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                    animation: `gtn-confettiFall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 0.5}s forwards`,
                }} />
            ))}
        </div>
    );
}

export default function BoostsPanel({ guildId, addToast }: BoostsPanelProps) {
    const [boostCount, setBoostCount] = useState(0);
    const [boostTier, setBoostTier] = useState(0);
    const [loading, setLoading] = useState(true);
    const [userBoosting, setUserBoosting] = useState(false);
    const [checkingBoostStatus, setCheckingBoostStatus] = useState(true);
    const [boosters, setBoosters] = useState<BoosterEntry[]>([]);
    const [boostersAvailable, setBoostersAvailable] = useState(true);
    const [boostersLoading, setBoostersLoading] = useState(false);
    const [boosting, setBoosting] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // Fetch live guild data on mount
    useEffect(() => {
        setLoading(true);
        api.guilds.get(guildId)
            .then((g: any) => {
                setBoostCount(g.boostCount ?? 0);
                setBoostTier(g.boostTier ?? 0);
            })
            .catch(() => addToast({ title: 'Failed to load boost info', variant: 'error' }))
            .finally(() => setLoading(false));
    }, [guildId]);

    // Check if the current user is already boosting
    useEffect(() => {
        setCheckingBoostStatus(true);
        api.get<any>(`/guilds/${guildId}/boost`)
            .then((data: any) => { setUserBoosting(data?.boosting === true); })
            .catch(() => { setUserBoosting(false); })
            .finally(() => setCheckingBoostStatus(false));
    }, [guildId]);

    // Fetch boosters list — gracefully handle 404 / missing endpoint
    useEffect(() => {
        setBoostersLoading(true);
        api.get<any>(`/guilds/${guildId}/boosts`)
            .then((data: any) => {
                setBoostersAvailable(true);
                if (Array.isArray(data)) setBoosters(data);
                else if (Array.isArray(data?.boosters)) setBoosters(data.boosters);
                else setBoosters([]);
            })
            .catch(() => {
                setBoostersAvailable(false);
                setBoosters([]);
            })
            .finally(() => setBoostersLoading(false));
    }, [guildId]);

    const refetchGuild = async () => {
        try {
            const g: any = await api.guilds.get(guildId);
            setBoostCount(g.boostCount ?? 0);
            setBoostTier(g.boostTier ?? 0);
        } catch { /* silent */ }
    };

    const handleBoost = async () => {
        setBoosting(true);
        try {
            const result = await api.guilds.boost(guildId);
            setBoostCount(result.boostCount);
            setBoostTier(result.boostTier);
            setUserBoosting(true);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
            addToast({ title: '⚡ Server Boosted!', description: 'Thanks for boosting this server!', variant: 'success' });
            window.dispatchEvent(new CustomEvent('gratonite:guild-updated', { detail: { guildId } }));
        } catch (err: any) {
            addToast({ title: 'Failed to boost', description: err?.message || 'Unknown error', variant: 'error' });
        } finally {
            setBoosting(false);
        }
    };

    const handleRemoveBoost = async () => {
        setBoosting(true);
        try {
            await api.guilds.removeBoost(guildId);
            setUserBoosting(false);
            await refetchGuild();
            addToast({ title: 'Boost removed', variant: 'info' });
            window.dispatchEvent(new CustomEvent('gratonite:guild-updated', { detail: { guildId } }));
        } catch (err: any) {
            addToast({ title: 'Failed to remove boost', description: err?.message || 'Unknown error', variant: 'error' });
        } finally {
            setBoosting(false);
        }
    };

    const currentTierData = TIERS[Math.min(boostTier, 3)];
    const nextTierData = boostTier < 3 ? TIERS[boostTier + 1] : null;
    const progressToNext = nextTierData ? Math.min((boostCount / nextTierData.min) * 100, 100) : 100;

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                Loading boost info…
            </div>
        );
    }

    return (
        <div>
            {showConfetti && <ConfettiBurst />}

            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px' }}>Server Boosts</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 24px' }}>
                Boost your server to unlock perks and features for every member.
            </p>

            {/* Current Tier Status Card */}
            <div style={{
                background: currentTierData.gradient,
                border: `1px solid ${currentTierData.color}44`,
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '20px',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                        <div style={{ fontSize: '28px', fontWeight: 800, color: currentTierData.color, lineHeight: 1.1 }}>
                            {currentTierData.name}
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {boostCount} boost{boostCount !== 1 ? 's' : ''} active
                        </div>
                    </div>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: `${currentTierData.color}20`,
                        border: `2px solid ${currentTierData.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '22px', flexShrink: 0,
                    }}>
                        {boostTier > 0 ? TIER_EMOJI[boostTier] : <Zap size={24} style={{ color: currentTierData.color }} />}
                    </div>
                </div>

                {nextTierData ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            <span>{boostCount} / {nextTierData.min} boosts</span>
                            <span style={{ color: nextTierData.color, fontWeight: 600 }}>→ {nextTierData.name}</span>
                        </div>
                        <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: '4px',
                                background: `linear-gradient(90deg, ${currentTierData.color}, ${nextTierData.color})`,
                                width: `${progressToNext}%`,
                                transition: 'width 0.6s ease',
                            }} />
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                            {nextTierData.min - boostCount} more boost{nextTierData.min - boostCount !== 1 ? 's' : ''} to reach {nextTierData.name}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: currentTierData.color, fontWeight: 700, fontSize: '13px' }}>
                        <Check size={14} /> Maximum tier reached!
                    </div>
                )}

                {/* Boost action */}
                {!checkingBoostStatus && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                        {!userBoosting ? (
                            <button
                                onClick={handleBoost}
                                disabled={boosting}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '10px 20px', borderRadius: '10px',
                                    background: currentTierData.color, border: 'none',
                                    color: '#000', fontWeight: 700, fontSize: '14px',
                                    cursor: boosting ? 'wait' : 'pointer',
                                    opacity: boosting ? 0.7 : 1,
                                    boxShadow: `0 4px 14px ${currentTierData.color}44`,
                                }}
                            >
                                <Zap size={15} fill="currentColor" />
                                {boosting ? 'Boosting…' : 'Boost This Server'}
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    fontSize: '13px', color: currentTierData.color, fontWeight: 600,
                                    background: `${currentTierData.color}15`, padding: '8px 14px',
                                    borderRadius: '8px', border: `1px solid ${currentTierData.color}40`,
                                }}>
                                    <Zap size={14} fill="currentColor" /> You're boosting this server
                                </span>
                                <button
                                    onClick={handleRemoveBoost}
                                    disabled={boosting}
                                    style={{
                                        padding: '8px 14px', borderRadius: '8px',
                                        background: 'transparent', border: '1px solid var(--stroke)',
                                        color: 'var(--text-muted)', cursor: boosting ? 'wait' : 'pointer', fontSize: '12px',
                                    }}
                                >
                                    {boosting ? '…' : 'Remove Boost'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tier Perks */}
            <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px' }}>Tier Perks</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '28px' }}>
                {TIERS.filter(t => t.tier > 0).map(t => {
                    const isUnlocked = boostTier >= t.tier;
                    const isCurrent = boostTier === t.tier;
                    return (
                        <div key={t.tier} style={{
                            padding: '16px', borderRadius: '12px',
                            background: isCurrent ? `${t.color}10` : isUnlocked ? `${t.color}08` : 'var(--bg-elevated)',
                            border: isCurrent ? `1px solid ${t.color}55` : '1px solid var(--stroke)',
                            opacity: isUnlocked ? 1 : 0.55,
                            transition: 'opacity 0.2s',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>{TIER_EMOJI[t.tier]}</span>
                                    <span style={{ fontWeight: 700, fontSize: '14px', color: isUnlocked ? t.color : 'var(--text-muted)' }}>{t.name}</span>
                                </div>
                                {!isUnlocked
                                    ? <Lock size={13} style={{ color: 'var(--text-muted)' }} />
                                    : isCurrent
                                        ? <span style={{ fontSize: '11px', fontWeight: 700, color: t.color, background: `${t.color}20`, padding: '2px 7px', borderRadius: '6px' }}>Current</span>
                                        : <Check size={13} style={{ color: t.color }} />}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '2px 7px', borderRadius: '4px', display: 'inline-block', marginBottom: '10px' }}>
                                {t.min} boosts required
                            </div>
                            <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {t.perks.map((perk, i) => (
                                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isUnlocked ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                        {isUnlocked
                                            ? <Check size={11} style={{ color: t.color, flexShrink: 0 }} />
                                            : <Lock size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                                        {perk}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>

            {/* Active Boosters */}
            <div style={{ marginBottom: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={16} style={{ color: 'var(--text-muted)' }} />
                    Active Boosters
                </h3>

                {boostersLoading ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px' }}>Loading boosters…</div>
                ) : !boostersAvailable ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--stroke)', fontSize: '13px' }}>
                        No booster list available for this server.
                    </div>
                ) : boosters.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--stroke)' }}>
                        <AlertCircle size={24} style={{ opacity: 0.4, marginBottom: '8px' }} />
                        <p style={{ margin: 0, fontSize: '13px' }}>No active boosters yet. Be the first to boost this server!</p>
                    </div>
                ) : (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', overflow: 'hidden' }}>
                        {boosters.slice(0, 10).map((b, idx) => (
                            <div key={b.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: idx < Math.min(boosters.length, 10) - 1 ? '1px solid var(--stroke)' : 'none' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#000', overflow: 'hidden', flexShrink: 0 }}>
                                    {b.avatarHash
                                        ? <img src={`${API_BASE}/files/${b.avatarHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                                        : (b.username || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                    {b.username || b.userId.slice(0, 8)}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Boosted {formatRelativeDate(b.boostedAt)}
                                </span>
                                <Zap size={12} style={{ color: TIERS[1].color }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
