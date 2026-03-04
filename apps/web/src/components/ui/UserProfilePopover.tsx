import { useState, useEffect } from 'react';
import { MessageSquare, UserPlus, MoreHorizontal } from 'lucide-react';
import { api, API_BASE } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';
import Avatar from './Avatar';

/** Minimal user data passed from the caller (no API fetch needed for these) */
export type PopoverUserInput = {
    id: string;
    name: string;
    handle: string;
    avatarHash?: string | null;
    status?: 'online' | 'idle' | 'dnd' | 'offline' | 'invisible';
    /** If provided, guild-specific roles/mutuals can be loaded */
    guildId?: string;
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

    // Fetch real profile + mutuals on mount
    useEffect(() => {
        let cancelled = false;

        const fetchAll = async () => {
            try {
                const [profileRes, mutualsRes] = await Promise.all([
                    api.users.getProfile(user.id).catch(() => null),
                    api.users.getMutuals(user.id).catch(() => null),
                ]);

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
                }
                if (mutualsRes) {
                    setMutuals(mutualsRes);
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

    // Use fetched profile data when available, fall back to input props
    const displayName = profile?.displayName || user.name;
    const handle = profile?.username || user.handle;
    const avatarHash = profile?.avatarHash ?? user.avatarHash;
    const bio = profile?.bio;
    const pronouns = profile?.pronouns;
    const statusColor = STATUS_COLORS[user.status || 'online'];

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
                <div style={{ height: '60px', background: bannerBg, position: 'relative' }}>
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

                    {/* Name + Handle */}
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
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{handle}</p>

                    {pronouns && (
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{pronouns}</p>
                    )}

                    {bio && (
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{bio}</p>
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
