import { useState, useEffect } from 'react';
import {
    Star, ThumbsUp, Zap, Crown, Trophy,
    Info, Sparkles, Shield,
    ArrowUpRight, ArrowDownRight, X
} from 'lucide-react';
import { api, API_BASE } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';
import { useToast } from '../../components/ui/ToastManager';
import Avatar from '../../components/ui/Avatar';
import { StarRating } from '../../components/ui/StarRating';

// ─── Types ────────────────────────────────────────────────────────────────────

type FAMEUser = {
    id: number;
    sourceUserId: string;
    name: string;
    avatarHash: string | null;
    fameReceived: number;
    fameGiven: number;
    weeklyChange: number; // delta rank
    badges: string[];
    bgColor: string;
    isCurrentUser?: boolean;
    serverName?: string;
};

type ServerRating = {
    id: number;
    sourceGuildId: string;
    name: string;
    icon: string;
    iconHash: string | null;
    bgColor: string;
    avgRating: number;
    totalRatings: number;
    category: string;
    isJoined: boolean;
};

// ─── Sub-Components ─────────────────────────────────────────────────────────────

const FAMESparkle = ({ active }: { active: boolean }) => {
    if (!active) return null;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 9999, overflow: 'hidden'
        }}>
            {Array.from({ length: 18 }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        position: 'absolute',
                        left: `${20 + Math.random() * 60}%`,
                        top: `${20 + Math.random() * 60}%`,
                        width: `${6 + Math.random() * 10}px`,
                        height: `${6 + Math.random() * 10}px`,
                        borderRadius: '50%',
                        background: ['#f59e0b', '#fbbf24', '#fde68a', '#fff', '#10b981'][i % 5],
                        animation: `sparkle-particle 0.9s ease-out forwards`,
                        animationDelay: `${Math.random() * 0.4}s`,
                    }}
                />
            ))}
        </div>
    );
};

const ClickableName = ({
    children,
    onClick,
}: {
    children: React.ReactNode;
    onClick: () => void;
}) => {
    const [hovered, setHovered] = useState(false);
    return (
        <span
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                cursor: 'pointer',
                color: hovered ? '#f59e0b' : 'inherit',
                transition: 'color 0.15s',
            }}
        >
            {children}
        </span>
    );
};

const UserDetailPane = ({
    user,
    rank,
    onClose,
    onGiveFame,
    canGiveFame,
    alreadyGiven,
    givingFame,
}: {
    user: FAMEUser;
    rank: number;
    onClose: () => void;
    onGiveFame: (userId: number) => void;
    canGiveFame: boolean;
    alreadyGiven: boolean;
    givingFame: boolean;
}) => {
    return (
        <div
            style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2000,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: '20px',
                    padding: '32px',
                    width: '400px',
                    maxWidth: '90vw',
                    border: '1px solid var(--stroke)',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                    position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '16px', right: '16px',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                        borderRadius: '8px', width: '32px', height: '32px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-secondary)',
                        transition: 'background 0.15s',
                    }}
                >
                    <X size={16} />
                </button>

                {/* Avatar */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                    <Avatar
                        userId={user.sourceUserId}
                        displayName={user.name}
                        avatarHash={user.avatarHash}
                        size={80}
                        style={{
                            border: '3px solid #f59e0b',
                            boxShadow: '0 0 24px #f59e0b44',
                            marginBottom: '12px',
                        }}
                    />
                    <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>
                        {user.name}
                    </div>
                    {user.badges.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', fontSize: '18px', marginTop: '4px' }}>
                            {user.badges.map((badge) => (
                                <span key={badge}>{badge}</span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Stats grid */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                    marginBottom: '20px',
                }}>
                    <div style={{
                        background: 'var(--bg-tertiary)', borderRadius: '12px',
                        padding: '14px', textAlign: 'center',
                        border: '1px solid var(--stroke)',
                    }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>FAME Received</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#f59e0b' }}>
                            <Star size={14} fill="#f59e0b" color="#f59e0b" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            {user.fameReceived.toLocaleString()}
                        </div>
                    </div>
                    <div style={{
                        background: 'var(--bg-tertiary)', borderRadius: '12px',
                        padding: '14px', textAlign: 'center',
                        border: '1px solid var(--stroke)',
                    }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>FAME Given</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#8b5cf6' }}>
                            <ThumbsUp size={14} color="#8b5cf6" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            {user.fameGiven.toLocaleString()}
                        </div>
                    </div>
                    <div style={{
                        background: 'var(--bg-tertiary)', borderRadius: '12px',
                        padding: '14px', textAlign: 'center',
                        border: '1px solid var(--stroke)',
                    }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Gratonite Earned</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>
                            <Zap size={14} color="#10b981" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                            {(user.fameReceived * 200).toLocaleString()}
                        </div>
                    </div>
                    <div style={{
                        background: 'var(--bg-tertiary)', borderRadius: '12px',
                        padding: '14px', textAlign: 'center',
                        border: '1px solid var(--stroke)',
                    }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Rank</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Crown size={14} color="#ec4899" style={{ verticalAlign: 'middle' }} />
                            #{rank}
                        </div>
                    </div>
                </div>

                {/* Weekly change */}
                <div style={{
                    background: 'var(--bg-tertiary)', borderRadius: '10px',
                    padding: '10px 16px', marginBottom: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    border: '1px solid var(--stroke)',
                }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Weekly Change:</span>
                    {user.weeklyChange > 0 ? (
                        <span style={{ color: '#10b981', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <ArrowUpRight size={16} /> +{user.weeklyChange} positions
                        </span>
                    ) : user.weeklyChange < 0 ? (
                        <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <ArrowDownRight size={16} /> {user.weeklyChange} positions
                        </span>
                    ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>No change</span>
                    )}
                </div>

                {/* Give FAME button (only for non-current users) */}
                {!user.isCurrentUser && (
                    <button
                        onClick={() => onGiveFame(user.id)}
                        disabled={alreadyGiven || !canGiveFame || givingFame}
                        style={{
                            width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                            background: alreadyGiven
                                ? 'rgba(245,158,11,0.15)'
                                : !canGiveFame
                                    ? 'var(--bg-tertiary)'
                                    : 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: alreadyGiven
                                ? '#f59e0b'
                                : !canGiveFame
                                    ? 'var(--text-muted)'
                                    : '#111',
                            fontWeight: 700, fontSize: '15px',
                            cursor: alreadyGiven || !canGiveFame ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            transition: 'all 0.2s',
                            boxShadow: (!alreadyGiven && canGiveFame) ? '0 4px 16px rgba(245,158,11,0.3)' : 'none',
                        }}
                    >
                        {givingFame ? (
                            <span style={{ animation: 'spin 0.6s linear infinite', display: 'inline-block' }}>✦</span>
                        ) : alreadyGiven ? (
                            <><Star size={16} fill="#f59e0b" color="#f59e0b" /> FAME Given!</>
                        ) : !canGiveFame ? (
                            <>No FAME tokens left today</>
                        ) : (
                            <><ThumbsUp size={16} /> Give FAME</>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

const PodiumPlace = ({ user, rank, onClickName }: { user: FAMEUser; rank: number; onClickName: (user: FAMEUser) => void }) => {
    const colors = { 1: '#f59e0b', 2: '#94a3b8', 3: '#cd7f32' };
    const heights = { 1: 80, 2: 60, 3: 48 };
    const order = { 1: 1, 2: 0, 3: 2 };
    const color = colors[rank as 1 | 2 | 3];
    const height = heights[rank as 1 | 2 | 3];

    return (
        <div style={{ order: order[rank as 1 | 2 | 3], display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '20px' }}>{user.badges[0] || ''}</div>
            <Avatar
                userId={user.sourceUserId}
                displayName={user.name}
                avatarHash={user.avatarHash}
                size={52}
                style={{
                    border: `3px solid ${color}`,
                    boxShadow: `0 0 16px ${color}44`,
                }}
            />
            <ClickableName onClick={() => onClickName(user)}>
                <div style={{ fontSize: '12px', fontWeight: 600, maxWidth: '80px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            </ClickableName>
            <div style={{ fontSize: '11px', color: color, fontWeight: 700 }}>⭐ {user.fameReceived.toLocaleString()}</div>
            <div style={{
                width: '80px', height: `${height}px`, marginTop: '4px',
                background: `linear-gradient(to top, ${color}88, ${color}22)`,
                borderRadius: '6px 6px 0 0', display: 'flex', alignItems: 'flex-start',
                justifyContent: 'center', paddingTop: '8px',
                border: `1px solid ${color}44`, borderBottom: 'none'
            }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color }}>{rank}</span>
            </div>
        </div>
    );
};

// ─── Main Component ─────────────────────────────────────────────────────────────

type Tab = 'overview' | 'leaderboard' | 'servers';

const FameDashboard = () => {
    const { addToast } = useToast();
    const [tab, setTab] = useState<Tab>('overview');
    const [showSparkle, setShowSparkle] = useState(false);
    const [fameToday, setFameToday] = useState(() => {
        const MAX = 5;
        try {
            const today = new Date().toISOString().slice(0, 10);
            const stored = JSON.parse(localStorage.getItem('gratonite-fame-tokens') || '{}');
            if (stored.date === today) return Math.max(0, MAX - (stored.used ?? 0));
        } catch { /* ignore */ }
        return MAX;
    });
    const [userRatings, setUserRatings] = useState<Record<number, number>>({});
    const [ratedServers, setRatedServers] = useState<Set<number>>(new Set());
    const [showRateModal, setShowRateModal] = useState<ServerRating | null>(null);
    const [pendingRating, setPendingRating] = useState(0);
    const [fameGivenTo, setFameGivenTo] = useState<Set<number>>(new Set());
    const [givingFame, setGivingFame] = useState<number | null>(null);
    const [selectedUser, setSelectedUser] = useState<FAMEUser | null>(null);

    // Real data from API
    const [leaderboardUsers, setLeaderboardUsers] = useState<FAMEUser[]>([]);
    const [serverRatings, setServerRatings] = useState<ServerRating[]>([]);
    const [currentUserId, setCurrentUserId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [myFameStats, setMyFameStats] = useState<{ fameReceived: number; fameGiven: number } | null>(null);
    const [myGuildId, setMyGuildId] = useState<string | null>(null);
    const [brokenServerIcons, setBrokenServerIcons] = useState<Set<number>>(new Set());

    const fetchLeaderboard = (currentId?: string) => {
        return api.leaderboard.get('week').then(entries => {
            const users: FAMEUser[] = entries.map((entry, idx) => ({
                id: typeof entry.userId === 'string' ? idx + 1 : Number(entry.userId),
                sourceUserId: String(entry.userId ?? ''),
                name: entry.displayName || entry.username,
                avatarHash: entry.avatarHash || null,
                fameReceived: entry.fameReceived || 0,
                fameGiven: 0,
                weeklyChange: 0,
                badges: entry.rank <= 3 ? ['⭐'] : [],
                bgColor: getDeterministicGradient(entry.displayName || entry.username),
                isCurrentUser: currentId ? String(entry.userId) === currentId : false,
            }));
            setLeaderboardUsers(users);
        });
    };

    useEffect(() => {
        Promise.allSettled([
        // Fetch current user + their guilds
        api.users.getMe().then(me => {
            setCurrentUserId(me.id);
            // Fetch user's guilds for fame giving context
            api.guilds.getMine().then(guilds => {
                if (guilds.length > 0) setMyGuildId(guilds[0].id);
            }).catch(() => {});
        }).catch(() => {
            addToast({ title: 'Failed to load user data', description: 'Could not fetch your profile.', variant: 'error' });
        }),
        // Fetch leaderboard
        fetchLeaderboard().catch(() => {
            setLoadError('Could not fetch the FAME leaderboard.');
            addToast({ title: 'Failed to load leaderboard', description: 'Could not fetch the FAME leaderboard.', variant: 'error' });
        }),
        // Fetch discoverable guilds for server ratings
        api.guilds.discover().then(async guilds => {
            const sliced = guilds.slice(0, 8);
            const ratings: ServerRating[] = sliced.map((g, idx) => ({
                id: idx + 1,
                sourceGuildId: g.id,
                name: g.name,
                icon: g.name.charAt(0).toUpperCase(),
                iconHash: g.iconHash || null,
                bgColor: getDeterministicGradient(g.name),
                avgRating: 0,
                totalRatings: g.memberCount || 0,
                category: g.categories?.[0] || 'Community',
                isJoined: false,
            }));
            setServerRatings(ratings);
            // Fetch real ratings for each guild
            const ratingResults = await Promise.allSettled(
                sliced.map(g => api.guilds.getRating(g.id))
            );
            setServerRatings(prev => prev.map((server, idx) => {
                const result = ratingResults[idx];
                if (result.status === 'fulfilled' && result.value) {
                    return {
                        ...server,
                        avgRating: result.value.averageRating,
                        totalRatings: result.value.totalRatings ?? server.totalRatings,
                    };
                }
                return server;
            }));
            // Populate existing user ratings
            const newUserRatings: Record<number, number> = {};
            const newRatedServers = new Set<number>();
            ratingResults.forEach((result, idx) => {
                if (result.status === 'fulfilled' && result.value?.userRating) {
                    newUserRatings[idx + 1] = result.value.userRating;
                    newRatedServers.add(idx + 1);
                }
            });
            if (Object.keys(newUserRatings).length > 0) {
                setUserRatings(newUserRatings);
                setRatedServers(newRatedServers);
            }
        }).catch(() => {
            addToast({ title: 'Failed to load server ratings', description: 'Could not fetch community server data.', variant: 'error' });
        }),
        ]).then(() => setIsLoading(false));
    }, []);

    // Fetch fame stats for current user
    useEffect(() => {
        if (!currentUserId) return;
        api.fame.getStats(currentUserId).then(stats => {
            setMyFameStats(stats);
        }).catch(() => {});
    }, [currentUserId]);

    useEffect(() => {
        if (!currentUserId) return;
        api.fame.getRemaining().then(r => {
            setFameToday(r.remaining);
            const today = new Date().toISOString().slice(0, 10);
            localStorage.setItem('gratonite-fame-tokens', JSON.stringify({ date: today, used: r.used }));
        }).catch(() => {});
    }, [currentUserId]);

    // Mark current user once both data are available
    useEffect(() => {
        if (!currentUserId || leaderboardUsers.length === 0) return;
        setLeaderboardUsers(prev => prev.map(u => ({
            ...u,
            isCurrentUser: u.sourceUserId === currentUserId,
            ...(u.sourceUserId === currentUserId && myFameStats ? {
                fameReceived: myFameStats.fameReceived,
                fameGiven: myFameStats.fameGiven,
            } : {}),
        })));
    }, [currentUserId, leaderboardUsers.length, myFameStats]);

    const currentUser = leaderboardUsers.find(u => u.isCurrentUser) || null;

    const sortedUsers = [...leaderboardUsers].sort((a, b) => b.fameReceived - a.fameReceived);

    const getUserRank = (userId: number): number => {
        const idx = sortedUsers.findIndex(u => u.id === userId);
        return idx >= 0 ? idx + 1 : 0;
    };

    const currentUserRank = currentUser ? getUserRank(currentUser.id) : 0;

    // Inject sparkle keyframe
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes sparkle-particle {
                0% { transform: translate(0, 0) scale(1); opacity: 1; }
                100% { transform: translate(${Math.random() > 0.5 ? '' : '-'}${40 + Math.random() * 80}px, -${60 + Math.random() * 100}px) scale(0); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        return () => { document.head.removeChild(style); };
    }, []);

    const handleGiveFame = async (userId: number) => {
        if (fameGivenTo.has(userId) || fameToday === 0 || !myGuildId) return;
        const targetUser = leaderboardUsers.find(u => u.id === userId);
        if (!targetUser) return;
        setGivingFame(userId);
        try {
            const result = await api.fame.give(targetUser.sourceUserId, { guildId: myGuildId });
            setFameGivenTo(prev => new Set([...prev, userId]));
            setFameToday(result.remaining);
            try {
                const today = new Date().toISOString().slice(0, 10);
                localStorage.setItem('gratonite-fame-tokens', JSON.stringify({ date: today, used: result.fameGiven }));
            } catch { /* ignore */ }
            // Optimistic update: bump target user's fameReceived in local state
            setLeaderboardUsers(prev => prev.map(u =>
                u.id === userId ? { ...u, fameReceived: u.fameReceived + 1 } : u
            ));
            setShowSparkle(true);
            setTimeout(() => setShowSparkle(false), 1500);
            // Re-fetch stats and leaderboard to sync with server
            api.fame.getStats(currentUserId).then(stats => setMyFameStats(stats)).catch(() => {});
            fetchLeaderboard(currentUserId).catch(() => {});
        } catch (err: any) {
            const msg = err?.message || 'Failed to give FAME';
            addToast({ title: 'FAME Error', description: msg, variant: 'error' });
        } finally {
            setGivingFame(null);
        }
    };

    const handleRateServer = (server: ServerRating) => {
        setShowRateModal(server);
        setPendingRating(userRatings[server.id] || 0);
    };

    const submitRating = async () => {
        if (!showRateModal || pendingRating === 0) return;
        const server = showRateModal;
        try {
            await api.guilds.rate(server.sourceGuildId, pendingRating);
            setUserRatings(prev => ({ ...prev, [server.id]: pendingRating }));
            setRatedServers(prev => new Set([...prev, server.id]));
            // Refresh the rating for this server
            api.guilds.getRating(server.sourceGuildId).then(result => {
                setServerRatings(prev => prev.map(s =>
                    s.id === server.id ? { ...s, avgRating: result.averageRating, totalRatings: result.totalRatings ?? s.totalRatings } : s
                ));
            }).catch(() => {});
            setShowRateModal(null);
        } catch {
            addToast({ title: 'Rating Failed', description: 'Could not submit your rating.', variant: 'error' });
        }
    };

    const handleUserClick = (user: FAMEUser) => {
        setSelectedUser(user);
    };

    return (
        <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
            <FAMESparkle active={showSparkle} />

            {/* User Detail Modal */}
            {selectedUser && (
                <UserDetailPane
                    user={selectedUser}
                    rank={getUserRank(selectedUser.id)}
                    onClose={() => setSelectedUser(null)}
                    onGiveFame={handleGiveFame}
                    canGiveFame={fameToday > 0}
                    alreadyGiven={fameGivenTo.has(selectedUser.id)}
                    givingFame={givingFame === selectedUser.id}
                />
            )}

            {/* Rate Server Modal */}
            {showRateModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 2000
                }} onClick={() => setShowRateModal(null)}>
                    <div style={{
                        background: 'var(--bg-elevated)', borderRadius: '16px',
                        padding: '32px', width: '380px', border: '1px solid var(--stroke)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                        textAlign: 'center'
                    }} onClick={e => e.stopPropagation()}>
                        {/* Server banner */}
                        <div style={{
                            height: '90px', borderRadius: '12px', marginBottom: '20px',
                            background: showRateModal.bgColor, display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: '40px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', overflow: 'hidden'
                        }}>
                            {showRateModal.iconHash && !brokenServerIcons.has(showRateModal.id) ? (
                                <img src={`${API_BASE}/files/${showRateModal.iconHash}`} alt={showRateModal.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={() => setBrokenServerIcons(prev => new Set([...prev, showRateModal.id]))}
                                />
                            ) : showRateModal.icon}
                        </div>
                        <h3 style={{ fontWeight: 700, marginBottom: '6px', fontSize: '20px', color: 'var(--text-primary)' }}>{showRateModal.name}</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                            {showRateModal.totalRatings.toLocaleString()} members{showRateModal.avgRating > 0 ? ` · avg ${showRateModal.avgRating.toFixed(1)} ⭐` : ''}
                        </p>
                        <p style={{ fontSize: '13px', marginBottom: '14px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your rating</p>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                            <StarRating value={pendingRating} onChange={setPendingRating} size={32} />
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                            {pendingRating === 0 ? 'Tap a star to rate' : `${pendingRating} out of 5 stars`}
                        </p>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowRateModal(null)}
                                style={{ flex: 1, padding: '11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '14px', transition: 'background 0.2s' }}
                            >Cancel</button>
                            <button
                                onClick={submitRating}
                                disabled={pendingRating === 0}
                                style={{
                                    flex: 1, padding: '11px', borderRadius: 'var(--radius-md)', border: 'none',
                                    background: pendingRating > 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--bg-tertiary)',
                                    color: pendingRating > 0 ? '#fff' : 'var(--text-muted)',
                                    fontWeight: 700, fontSize: '14px', cursor: pendingRating > 0 ? 'pointer' : 'not-allowed',
                                    transition: 'all 0.2s', boxShadow: pendingRating > 0 ? '0 4px 12px rgba(245,158,11,0.3)' : 'none'
                                }}
                            >Submit Rating</button>
                        </div>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div style={{ padding: 24, maxWidth: '900px', margin: '0 auto' }}>
                    <div className="skeleton-pulse" style={{ width: '60%', height: 24, borderRadius: 6, marginBottom: 16 }} />
                    <div className="skeleton-pulse" style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 12 }} />
                    <div className="skeleton-pulse" style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 12 }} />
                    <div className="skeleton-pulse" style={{ width: '80%', height: 120, borderRadius: 8 }} />
                </div>
            ) : loadError ? (
                <div style={{ padding: '48px 24px', maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
                    <Info size={48} style={{ color: 'var(--error)', marginBottom: '16px', opacity: 0.6 }} />
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Failed to Load FAME Dashboard</h2>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>{loadError}</p>
                    <button
                        onClick={() => { setLoadError(null); setIsLoading(true); fetchLeaderboard().catch(() => setLoadError('Could not fetch the FAME leaderboard.')).finally(() => setIsLoading(false)); }}
                        style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#fff', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                    >
                        Retry
                    </button>
                </div>
            ) : (
            <div className="content-padding" style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                    <div style={{
                        width: '52px', height: '52px', borderRadius: '14px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)'
                    }}>
                        <Star size={28} color="#111" fill="#111" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>FAME Dashboard</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Recognize outstanding community members</p>
                    </div>
                </div>

                {/* Your FAME Stats */}
                <div className="grid-mobile-2" style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px'
                }}>
                    {[
                        { label: 'FAME Received', value: (myFameStats?.fameReceived ?? (currentUser?.fameReceived ?? null)) !== null ? (myFameStats?.fameReceived ?? currentUser!.fameReceived).toLocaleString() : '—', icon: <Star size={18} color="#f59e0b" fill="#f59e0b" />, color: '#f59e0b', sub: 'total FAME received' },
                        { label: 'Gratonite Earned', value: (myFameStats?.fameReceived ?? (currentUser?.fameReceived ?? null)) !== null ? ((myFameStats?.fameReceived ?? currentUser!.fameReceived) * 200).toLocaleString() : '—', icon: <Zap size={18} color="#10b981" />, color: '#10b981', sub: 'from FAME rewards' },
                        { label: 'FAME Given', value: (myFameStats?.fameGiven ?? (currentUser?.fameGiven ?? null)) !== null ? (myFameStats?.fameGiven ?? currentUser!.fameGiven).toLocaleString() : '—', icon: <ThumbsUp size={18} color="#8b5cf6" />, color: '#8b5cf6', sub: `${fameToday} left today` },
                        { label: 'Global Rank', value: currentUserRank > 0 ? `#${currentUserRank}` : '—', icon: <Crown size={18} color="#ec4899" />, color: '#ec4899', sub: currentUserRank > 0 ? `of ${sortedUsers.length} ranked users` : 'rank unavailable' },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            background: 'var(--bg-elevated)', borderRadius: '12px',
                            padding: '16px', border: '1px solid var(--stroke)',
                            borderTop: `3px solid ${stat.color}`
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                {stat.icon}
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{stat.label}</span>
                            </div>
                            <div style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>{stat.value}</div>
                            <div style={{ fontSize: '11px', color: stat.color }}>{stat.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Daily FAME Remaining */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05))',
                    border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px',
                    padding: '16px 20px', marginBottom: '28px',
                    display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: i < fameToday ? '#f59e0b' : 'var(--bg-tertiary)',
                                border: i < fameToday ? '2px solid #fbbf24' : '2px solid var(--stroke)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.3s'
                            }}>
                                {i < fameToday && <Star size={14} color="#111" fill="#111" />}
                            </div>
                        ))}
                    </div>
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>
                            {fameToday} of 5 FAME tokens remaining today
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Resets daily · Each FAME you give earns the recipient 200 Gratonite
                        </div>
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                        <Info size={16} color="var(--text-muted)" />
                    </div>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                    {([
                        { key: 'overview', label: 'Overview', icon: <Sparkles size={15} /> },
                        { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={15} /> },
                        { key: 'servers', label: 'Server Ratings', icon: <Star size={15} /> },
                    ] as { key: Tab; label: string; icon: React.ReactNode }[]).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{
                                flex: 1, padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                fontWeight: tab === t.key ? 700 : 400, fontSize: '13px',
                                background: tab === t.key ? 'var(--accent-primary)' : 'transparent',
                                color: tab === t.key ? '#111' : 'var(--text-secondary)',
                                transition: 'all 0.2s'
                            }}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Overview Tab ─────────────────────────────── */}
                {tab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Podium */}
                        <div style={{
                            background: 'var(--bg-elevated)', borderRadius: '16px',
                            padding: '28px', border: '1px solid var(--stroke)'
                        }}>
                            <h3 style={{ fontWeight: 700, marginBottom: '24px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Crown size={16} color="#f59e0b" /> This Week's Top 3
                            </h3>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'flex-end', paddingBottom: '8px' }}>
                                {sortedUsers[0] && <PodiumPlace user={sortedUsers[0]} rank={1} onClickName={handleUserClick} />}
                                {sortedUsers[1] && <PodiumPlace user={sortedUsers[1]} rank={2} onClickName={handleUserClick} />}
                                {sortedUsers[2] && <PodiumPlace user={sortedUsers[2]} rank={3} onClickName={handleUserClick} />}
                            </div>
                        </div>

                        {/* Give FAME to community */}
                        <div style={{
                            background: 'var(--bg-elevated)', borderRadius: '16px',
                            padding: '24px', border: '1px solid var(--stroke)'
                        }}>
                            <h3 style={{ fontWeight: 700, marginBottom: '4px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ThumbsUp size={16} color="#8b5cf6" /> Give FAME
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                                Recognize awesome community members · {fameToday} tokens left today
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {sortedUsers.filter(u => !u.isCurrentUser).slice(0, 5).map(user => {
                                    const given = fameGivenTo.has(user.id);
                                    const loading = givingFame === user.id;
                                    return (
                                        <div key={user.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '10px 12px', borderRadius: '10px',
                                            background: 'var(--bg-tertiary)',
                                            border: given ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent'
                                        }}>
                                            <Avatar userId={user.sourceUserId} displayName={user.name} avatarHash={user.avatarHash} size={36} />
                                            <div style={{ flex: 1 }}>
                                                <ClickableName onClick={() => handleUserClick(user)}>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{user.name}</div>
                                                </ClickableName>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                    ⭐ {user.fameReceived.toLocaleString()} FAME received
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleGiveFame(user.id)}
                                                disabled={given || fameToday === 0 || loading}
                                                style={{
                                                    padding: '6px 14px', borderRadius: '8px', border: 'none',
                                                    background: given ? 'rgba(245,158,11,0.15)' : fameToday === 0 ? 'var(--bg-tertiary)' : 'rgba(245,158,11,0.2)',
                                                    color: given ? '#f59e0b' : fameToday === 0 ? 'var(--text-muted)' : '#f59e0b',
                                                    fontWeight: 600, fontSize: '13px', cursor: given || fameToday === 0 ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {loading ? (
                                                    <span style={{ animation: 'spin 0.6s linear infinite', display: 'inline-block' }}>✦</span>
                                                ) : given ? (
                                                    <><Star size={13} fill="#f59e0b" color="#f59e0b" /> Given!</>
                                                ) : (
                                                    <><ThumbsUp size={13} /> Give FAME</>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* How FAME Works */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(245,158,11,0.08))',
                            border: '1px solid var(--stroke)', borderRadius: '16px', padding: '24px'
                        }}>
                            <h3 style={{ fontWeight: 700, marginBottom: '16px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Info size={16} color="#8b5cf6" /> How FAME Works
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {[
                                    { icon: '👍', title: 'Give FAME', desc: 'Thumbs up on any message in any server to grant FAME to that user' },
                                    { icon: '⭐', title: '200 Gratonite per FAME', desc: 'Every FAME you receive earns 200 Gratonite — our in-app currency' },
                                    { icon: '⏱️', title: '5 per day cap', desc: 'You can give up to 5 FAME tokens per day to prevent abuse' },
                                    { icon: '🚫', title: 'Once per person/day', desc: 'You can only give 1 FAME to each person per day. Choose wisely!' },
                                ].map(item => (
                                    <div key={item.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        <span style={{ fontSize: '20px' }}>{item.icon}</span>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{item.title}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Leaderboard Tab ───────────────────────────── */}
                {tab === 'leaderboard' && (
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: '16px', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Trophy size={16} color="#f59e0b" /> Global FAME Leaderboard
                            </h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>All-time rankings</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--stroke)' }}>
                                    {['#', 'User', 'FAME Received', 'FAME Given', 'Gratonite Earned', 'Change'].map(col => (
                                        <th key={col} style={{
                                            padding: '10px 16px', textAlign: col === '#' ? 'center' : 'left',
                                            fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600
                                        }}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedUsers.map((user, idx) => {
                                    const rank = idx + 1;
                                    const medalColor = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : 'var(--text-secondary)';
                                    const isYou = user.isCurrentUser;
                                    return (
                                        <tr key={user.id} style={{
                                            borderBottom: '1px solid var(--stroke)',
                                            background: isYou ? 'rgba(245,158,11,0.06)' : 'transparent',
                                            transition: 'background 0.15s'
                                        }}>
                                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 800, color: medalColor, fontSize: '15px' }}>
                                                {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <Avatar
                                                        userId={user.sourceUserId}
                                                        displayName={user.name}
                                                        avatarHash={user.avatarHash}
                                                        size={32}
                                                        style={{ border: isYou ? '2px solid #f59e0b' : '2px solid transparent' }}
                                                    />
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <ClickableName onClick={() => handleUserClick(user)}>
                                                                {user.name}
                                                            </ClickableName>
                                                            {isYou && <span style={{ fontSize: '10px', background: '#f59e0b', color: '#111', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>YOU</span>}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{(user.badges ?? []).join(' ')}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#f59e0b' }}>
                                                ⭐ {user.fameReceived.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                👍 {user.fameGiven.toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 600, fontSize: '13px' }}>
                                                ⚡ {(user.fameReceived * 200).toLocaleString()}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {user.weeklyChange > 0 ? (
                                                    <span style={{ color: '#10b981', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                        <ArrowUpRight size={14} /> +{user.weeklyChange}
                                                    </span>
                                                ) : user.weeklyChange < 0 ? (
                                                    <span style={{ color: '#ef4444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                        <ArrowDownRight size={14} /> {user.weeklyChange}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center' }}>
                            Showing top {leaderboardUsers.length} users
                        </div>
                    </div>
                )}

                {/* ── Server Ratings Tab ────────────────────────── */}
                {tab === 'servers' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h3 style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Star size={16} color="#f59e0b" fill="#f59e0b" /> Server Ratings
                            </h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Rate servers you've joined to help others find great communities</span>
                        </div>

                        {serverRatings.map(server => {
                            const myRating = userRatings[server.id] || 0;
                            const rated = ratedServers.has(server.id);
                            return (
                                <div key={server.id} style={{
                                    background: 'var(--bg-elevated)', borderRadius: '14px',
                                    border: '1px solid var(--stroke)', overflow: 'hidden',
                                    display: 'flex', alignItems: 'stretch'
                                }}>
                                    {/* Color stripe */}
                                    <div style={{ width: '6px', background: server.bgColor, flexShrink: 0 }} />
                                    <div style={{ flex: 1, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        {/* Icon */}
                                        {server.iconHash && !brokenServerIcons.has(server.id) ? (
                                            <img
                                                src={`${API_BASE}/files/${server.iconHash}`}
                                                alt={server.name}
                                                style={{
                                                    width: '52px', height: '52px', borderRadius: '14px',
                                                    objectFit: 'cover', flexShrink: 0
                                                }}
                                                onError={() => setBrokenServerIcons(prev => new Set([...prev, server.id]))}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '52px', height: '52px', borderRadius: '14px',
                                                background: server.bgColor, display: 'flex',
                                                alignItems: 'center', justifyContent: 'center', fontSize: '24px',
                                                flexShrink: 0
                                            }}>{server.icon}</div>
                                        )}
                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 700, fontSize: '15px' }}>{server.name}</span>
                                                <span style={{ fontSize: '11px', background: 'var(--bg-tertiary)', padding: '1px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{server.category}</span>
                                                {server.isJoined && <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>• Joined</span>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {server.avgRating > 0 ? (
                                                    <>
                                                        <StarRating value={server.avgRating} readOnly size={14} />
                                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f59e0b' }}>{server.avgRating.toFixed(1)}</span>
                                                    </>
                                                ) : (
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No ratings yet</span>
                                                )}
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{server.totalRatings.toLocaleString()} members</span>
                                            </div>
                                            {rated && myRating > 0 && (
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    Your rating: <StarRating value={myRating} readOnly size={12} />
                                                </div>
                                            )}
                                        </div>
                                        {/* Rate button */}
                                        <button
                                            onClick={() => handleRateServer(server)}
                                            style={{
                                                padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--stroke)',
                                                background: rated ? 'rgba(245,158,11,0.1)' : 'var(--bg-tertiary)',
                                                color: rated ? '#f59e0b' : 'var(--text-primary)', fontWeight: 600, fontSize: '13px',
                                                cursor: 'pointer', whiteSpace: 'nowrap',
                                                display: 'flex', alignItems: 'center', gap: '6px'
                                            }}
                                        >
                                            <Star size={13} fill={rated ? '#f59e0b' : 'none'} color={rated ? '#f59e0b' : 'currentColor'} />
                                            {rated ? 'Update Rating' : 'Rate Server'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        <div style={{
                            background: 'var(--bg-elevated)', borderRadius: '14px',
                            padding: '20px', border: '1px solid var(--stroke)',
                            display: 'flex', alignItems: 'center', gap: '12px',
                            color: 'var(--text-secondary)', fontSize: '13px'
                        }}>
                            <Shield size={18} color="var(--text-muted)" />
                            <span>Ratings are anonymous. Servers with consistently high ratings get featured in the <strong style={{ color: 'var(--text-primary)' }}>Discover</strong> Featured section.</span>
                        </div>
                    </div>
                )}
            </div>
            )}
        </div>
    );
};

export default FameDashboard;
