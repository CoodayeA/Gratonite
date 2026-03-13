import { useState, useEffect, useRef } from 'react';
import { MessageSquare, UserPlus, MoreHorizontal, Gamepad2, Headphones, Eye, Star, Clock, Music, Cake, Link2, Shield } from 'lucide-react';
import { api, API_BASE } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';
import { useUser } from '../../contexts/UserContext';
import Avatar from './Avatar';
import { ReputationBadge } from './ReputationBadge';

const BADGE_META: Record<string, { label: string; emoji: string; color: string }> = {
    admin: { label: 'Admin', emoji: '\u{1F6E1}\uFE0F', color: '#ed4245' },
    early_adopter: { label: 'Early Adopter', emoji: '\u2B50', color: '#faa61a' },
    verified: { label: 'Verified', emoji: '\u2705', color: '#3ba55c' },
    developer: { label: 'Developer', emoji: '\u{1F527}', color: '#5865f2' },
    moderator: { label: 'Moderator', emoji: '\u{1F528}', color: '#eb459e' },
    supporter: { label: 'Supporter', emoji: '\u{1F48E}', color: '#5865f2' },
};

/** Minimal user data passed from the caller (no API fetch needed for these) */
export type PopoverUserInput = {
    id: string;
    name: string;
    handle: string;
    avatarHash?: string | null;
    status?: 'online' | 'idle' | 'dnd' | 'offline' | 'invisible';
    /** If provided, guild-specific roles/mutuals can be loaded */
    guildId?: string;
    /** Live activity from presence system */
    activity?: { name: string; type: string; startedAt?: string } | null;
};

/** Full profile data fetched from the API */
type ProfileData = {
    displayName: string;
    username: string;
    avatarHash: string | null;
    bannerHash: string | null;
    bio: string | null;
    pronouns: string | null;
    accentColor: string | null;
    primaryColor: string | null;
    createdAt: string;
    timezone?: string | null;
    profileSong?: { url: string; title: string; artist: string; platform: string } | null;
    birthday?: { month: number; day: number } | null;
    messageCount?: number;
};

type ConnectionData = {
    provider: string;
    providerUsername: string;
    profileUrl: string | null;
};

type MutualData = {
    mutualServers: Array<{ id: string; name: string; iconHash: string | null; nickname: string | null }>;
    mutualFriends: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>;
};

const STATUS_COLORS: Record<string, string> = {
    online: '#10b981',
    idle: '#f59e0b',
    dnd: '#ef4444',
    invisible: '#6b7280',
    offline: '#6b7280',
};

const UserProfilePopover = ({
    user,
    position,
    onClose,
    onMessage,
    onAddFriend,
    onViewFullProfile,
}: {
    user: PopoverUserInput;
    position: { x: number; y: number };
    onClose: () => void;
    onMessage?: () => void;
    onAddFriend?: () => void;
    onViewFullProfile?: () => void;
}) => {
    const [hovered, setHovered] = useState<string | null>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [mutuals, setMutuals] = useState<MutualData | null>(null);
    const [roles, setRoles] = useState<Array<{ name: string; color: string }>>([]);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [badges, setBadges] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [noteLoaded, setNoteLoaded] = useState(false);
    const [fameStats, setFameStats] = useState<{ fameReceived: number; fameGiven: number } | null>(null);
    const [connections, setConnections] = useState<ConnectionData[]>([]);
    const { user: currentUser } = useUser();
    const isOwnProfile = user.id === currentUser?.id;

    const readCanvasEffect = () => isOwnProfile
        ? (localStorage.getItem(`gratonite-profile-canvas:${user.id}`) || localStorage.getItem('gratonite-profile-canvas') || 'none')
        : 'none';

    const [myCanvasEffect, setMyCanvasEffect] = useState(readCanvasEffect);

    useEffect(() => {
        if (!isOwnProfile) return;
        const handler = () => setMyCanvasEffect(readCanvasEffect());
        window.addEventListener('gratonite:profile-canvas-updated', handler);
        return () => window.removeEventListener('gratonite:profile-canvas-updated', handler);
    }, [isOwnProfile, user.id]);

    // Fetch real profile + mutuals on mount
    useEffect(() => {
        let cancelled = false;

        const fetchAll = async () => {
            try {
                const [profileRes, mutualsRes, fameRes, connectionsRes] = await Promise.all([
                    api.users.getProfile(user.id).catch(() => null),
                    api.users.getMutuals(user.id).catch(() => null),
                    api.fame.getStats(user.id).catch(() => null),
                    api.users.getConnections(user.id).catch(() => []),
                ]);

                // Record profile view (non-blocking)
                if (user.id !== currentUser?.id) {
                    api.profileVisitors.record(user.id).catch(() => {});
                }

                if (Array.isArray(connectionsRes)) setConnections(connectionsRes);

                if (cancelled) return;

                if (profileRes) {
                    setProfile({
                        displayName: profileRes.displayName,
                        username: profileRes.username,
                        avatarHash: profileRes.avatarHash,
                        bannerHash: profileRes.bannerHash,
                        bio: profileRes.bio,
                        pronouns: profileRes.pronouns,
                        accentColor: profileRes.accentColor,
                        primaryColor: profileRes.primaryColor,
                        createdAt: profileRes.createdAt,
                    });
                    if (profileRes.badges) setBadges(profileRes.badges);
                }
                if (mutualsRes) {
                    setMutuals(mutualsRes);
                }
                if (fameRes) {
                    setFameStats(fameRes);
                }

                // Fetch guild-specific roles if guildId provided
                if (user.guildId) {
                    try {
                        const memberRoles = await api.guilds.getMemberRoles(user.guildId, user.id) as any[];
                        if (!cancelled && memberRoles && memberRoles.length > 0) {
                            setRoles(memberRoles.map((r: any) => {
                                const colorInt = r.color ?? 0;
                                const colorStr = colorInt ? `#${colorInt.toString(16).padStart(6, '0')}` : '#99aab5';
                                return { name: r.name, color: colorStr };
                            }));
                        }
                    } catch { /* roles optional */ }
                }
            } catch { /* profile fetch failed, show fallback */ }
            finally {
                if (!cancelled) setLoadingProfile(false);
            }
        };

        fetchAll();
        return () => { cancelled = true; };
    }, [user.id, user.guildId]);

    // Fetch note
    useEffect(() => {
        if (!user.id || user.id === currentUser?.id) { setNoteLoaded(true); return; }
        api.users.getNote(user.id)
            .then(data => { setNote(data.content || ''); setNoteLoaded(true); })
            .catch(() => setNoteLoaded(true));
    }, [user.id, currentUser?.id]);

    const saveNote = async () => {
        if (!user.id) return;
        await api.users.saveNote(user.id, note).catch(() => {});
    };

    // Activity elapsed time
    const activityStartRef = useRef<number>(Date.now());
    const [elapsed, setElapsed] = useState('0:00:00');

    useEffect(() => {
        if (!user.activity) return;
        const start = user.activity.startedAt ? new Date(user.activity.startedAt).getTime() : activityStartRef.current;
        const tick = () => {
            const diff = Math.max(0, Math.floor((Date.now() - start) / 1000));
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            setElapsed(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        tick();
        const iv = setInterval(tick, 1000);
        return () => clearInterval(iv);
    }, [user.activity]);

    // Use fetched profile data when available, fall back to input props
    const displayName = profile?.displayName || user.name;
    const handle = profile?.username || user.handle;
    const avatarHash = profile?.avatarHash ?? user.avatarHash;
    const bio = profile?.bio;
    const pronouns = profile?.pronouns;
    const statusColor = STATUS_COLORS[user.status || 'online'];

    // Birthday check
    const today = new Date();
    const isBirthday = profile?.birthday
        ? profile.birthday.month === (today.getMonth() + 1) && profile.birthday.day === today.getDate()
        : false;

    // Timezone local time
    const localTime = profile?.timezone ? (() => {
        try {
            return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: profile.timezone }).format(new Date());
        } catch { return null; }
    })() : null;

    // Banner: use real bannerHash if available, else accentColor gradient, else fallback
    const bannerBg = profile?.bannerHash
        ? `url(${API_BASE}/files/${profile.bannerHash}) center/cover`
        : profile?.accentColor
            ? `linear-gradient(135deg, ${profile.accentColor}, ${profile.primaryColor || profile.accentColor})`
            : getDeterministicGradient(displayName);

    // Clamp position to viewport
    const popW = 300;
    const popH = 380;
    const x = Math.max(16, Math.min(position.x, window.innerWidth - popW - 16));
    const y = Math.max(16, Math.min(position.y, window.innerHeight - popH - 16));

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    width: popW,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                    overflow: 'hidden',
                    animation: 'fadeInScale 0.15s ease-out',
                }}
            >
                {/* Mini Banner */}
                <div
                    className={myCanvasEffect !== 'none' ? `canvas-${myCanvasEffect}` : ''}
                    style={{
                        height: '60px',
                        background: myCanvasEffect === 'none' ? bannerBg : undefined,
                        position: 'relative',
                        borderRadius: '12px 12px 0 0',
                        overflow: 'hidden',
                    }}
                >
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.4))' }} />
                </div>

                <div style={{ padding: '0 16px 16px', position: 'relative' }}>
                    {/* Avatar */}
                    <div style={{ marginTop: '-28px', marginBottom: '8px' }}>
                        <Avatar
                            userId={user.id}
                            avatarHash={avatarHash}
                            displayName={displayName}
                            size={56}
                            status={user.status || 'online'}
                            statusRingColor="var(--bg-elevated)"
                            style={{ border: '3px solid var(--bg-elevated)' }}
                        />
                    </div>

                    {/* Name + Handle + Reputation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <h3
                            style={{
                                fontSize: '16px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-display)',
                                margin: 0,
                                cursor: onViewFullProfile ? 'pointer' : 'default',
                                color: 'var(--text-primary)',
                            }}
                            onClick={onViewFullProfile}
                        >
                            {displayName}
                        </h3>
                        {profile?.profileSong && <Music size={12} color="#8b5cf6" />}
                        {isBirthday && <span title="Birthday today!" style={{ fontSize: '14px' }}>🎂</span>}
                        <ReputationBadge
                            accountAge={profile?.createdAt}
                            fameReceived={fameStats?.fameReceived}
                            achievementCount={badges.length}
                            size="sm"
                        />
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{handle}</p>

                    {badges.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            {badges.map((badge: string) => {
                                const meta = BADGE_META[badge];
                                if (!meta) return null;
                                return (
                                    <span key={badge} title={meta.label} style={{ fontSize: '14px', cursor: 'default', color: meta.color }}>{meta.emoji}</span>
                                );
                            })}
                        </div>
                    )}

                    {pronouns && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{pronouns}</p>
                    )}

                    {bio && (
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{bio}</p>
                    )}

                    {fameStats && fameStats.fameReceived > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '4px 8px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px', width: 'fit-content' }}>
                            <Star size={13} color="#f59e0b" fill="#f59e0b" />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>{fameStats.fameReceived} FAME</span>
                        </div>
                    )}

                    {user.activity && (
                        <div style={{
                            marginBottom: '8px',
                            padding: '8px 10px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            <div style={{
                                color: user.activity.type === 'PLAYING' ? '#10b981'
                                    : user.activity.type === 'LISTENING' ? '#8b5cf6'
                                    : '#3b82f6',
                                display: 'flex',
                                alignItems: 'center',
                            }}>
                                {user.activity.type === 'PLAYING' && <Gamepad2 size={14} />}
                                {user.activity.type === 'LISTENING' && <Headphones size={14} />}
                                {user.activity.type === 'WATCHING' && <Eye size={14} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: user.activity.type === 'PLAYING' ? '#10b981'
                                        : user.activity.type === 'LISTENING' ? '#8b5cf6'
                                        : '#3b82f6',
                                    marginBottom: '2px',
                                }}>
                                    {user.activity.type === 'PLAYING' ? 'Playing'
                                        : user.activity.type === 'LISTENING' ? 'Listening to'
                                        : user.activity.type === 'WATCHING' ? 'Watching'
                                        : user.activity.type}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user.activity.name}
                                </div>
                                {user.activity.type === 'PLAYING' && (
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {elapsed}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={{ height: '1px', background: 'var(--stroke)', margin: '8px 0' }} />

                    {/* Roles */}
                    {roles.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>Roles</div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {roles.map(r => (
                                    <span key={r.name} style={{ fontSize: '11px', padding: '2px 8px', background: `${r.color}20`, color: r.color, borderRadius: '10px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.color }} />
                                        {r.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mutual Servers */}
                    {mutuals && mutuals.mutualServers.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>
                                Mutual Servers — {mutuals.mutualServers.length}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {mutuals.mutualServers.slice(0, 8).map(s => (
                                    <div
                                        key={s.id}
                                        title={s.name}
                                        style={{
                                            width: '26px',
                                            height: '26px',
                                            borderRadius: '6px',
                                            background: s.iconHash ? `url(${API_BASE}/files/${s.iconHash}) center/cover` : 'var(--bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '11px',
                                            color: 'var(--text-muted)',
                                            fontWeight: 600,
                                        }}
                                    >
                                        {!s.iconHash && s.name.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Mutual Friends */}
                    {mutuals && mutuals.mutualFriends.length > 0 && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                            {mutuals.mutualFriends.length} mutual friend{mutuals.mutualFriends.length !== 1 ? 's' : ''}
                        </p>
                    )}

                    {/* Loading indicator */}
                    {loadingProfile && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Loading...</div>
                    )}

                    {/* Note */}
                    {noteLoaded && user.id !== currentUser?.id && (
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.05em' }}>Note</div>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value.slice(0, 256))}
                                onBlur={saveNote}
                                placeholder="Click to add a note"
                                rows={2}
                                style={{
                                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                    borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px', padding: '4px 6px',
                                    resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onClick={onMessage}
                            onMouseEnter={() => setHovered('msg')}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                flex: 1, height: '32px', borderRadius: '6px', border: 'none',
                                background: hovered === 'msg' ? 'var(--accent-hover)' : 'var(--accent-primary)',
                                color: '#000', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            }}
                        >
                            <MessageSquare size={13} /> Message
                        </button>
                        <button
                            onClick={onAddFriend}
                            onMouseEnter={() => setHovered('add')}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--stroke)',
                                background: hovered === 'add' ? 'var(--hover-overlay)' : 'transparent',
                                color: 'var(--text-primary)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <UserPlus size={14} />
                        </button>
                        <button
                            onMouseEnter={() => setHovered('more')}
                            onMouseLeave={() => setHovered(null)}
                            style={{
                                width: '32px', height: '32px', borderRadius: '6px', border: '1px solid var(--stroke)',
                                background: hovered === 'more' ? 'var(--hover-overlay)' : 'transparent',
                                color: 'var(--text-primary)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <MoreHorizontal size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfilePopover;
