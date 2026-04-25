import { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, MessageSquare, X, Star, Palette, Lock, Copy, ShieldOff, ShieldCheck, Flag, Check, Loader2, Code, Tv, Gamepad2, Play, Headphones, Eye, Music, Globe } from 'lucide-react';
import { onPresenceUpdate, type PresenceUpdatePayload } from '../../lib/socket';
import { Tooltip } from '../ui/Tooltip';
import { useToast } from '../ui/ToastManager';
import { useUser } from '../../contexts/UserContext';
import Avatar from '../ui/Avatar';
import { RemoteBadge } from '../ui/RemoteBadge';
import { FederatedReportModal } from './FederatedReportModal';
import { api, API_BASE, getAccessToken } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';
import { copyToClipboard } from '../../utils/clipboard';

const BADGE_META: Record<string, { label: string; emoji: string; color: string }> = {
    admin: { label: 'Admin', emoji: '\u{1F6E1}\uFE0F', color: '#ed4245' },
    early_adopter: { label: 'Early Adopter', emoji: '\u2B50', color: '#faa61a' },
    verified: { label: 'Verified', emoji: '\u2705', color: '#3ba55c' },
    developer: { label: 'Developer', emoji: '\u{1F527}', color: '#5865f2' },
    moderator: { label: 'Moderator', emoji: '\u{1F528}', color: '#eb459e' },
    supporter: { label: 'Supporter', emoji: '\u{1F48E}', color: '#5865f2' },
};

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
    github: <Code size={14} />,
    twitch: <Tv size={14} />,
    steam: <Gamepad2 size={14} />,
    twitter: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
    youtube: <Play size={14} />,
    spotify: <Music size={14} />,
};

// ─── Live Canvas Backgrounds ─────────────────────────────────────────────────

type CanvasType = 'none' | 'gradient-pulse' | 'stars' | 'particles' | 'matrix-rain' | 'aurora' | 'liquid-metal';

type CanvasOption = {
    id: CanvasType;
    name: string;
    premium: boolean;
    cssClass?: string;
    color?: string;
};

const CANVAS_OPTIONS: CanvasOption[] = [
    { id: 'none',          name: 'None',          premium: false, color: '#1a1a2e' },
    { id: 'gradient-pulse',name: 'Gradient Pulse', premium: false, cssClass: 'canvas-gradient-pulse' },
    { id: 'stars',         name: 'Starfield',      premium: false, cssClass: 'canvas-stars' },
    { id: 'particles',     name: 'Particles',      premium: false, color: '#0f0f1a' },
    { id: 'matrix-rain',   name: 'Matrix Rain',    premium: true,  cssClass: 'canvas-matrix-rain' },
    { id: 'aurora',        name: 'Aurora Borealis', premium: true, cssClass: 'canvas-aurora' },
    { id: 'liquid-metal',  name: 'Liquid Metal',   premium: true,  cssClass: 'canvas-liquid-metal' },
];

// Particle canvas using JS canvas API
const ParticleCanvas = ({ width, height }: { width: number; height: number }) => {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = [];

        for (let i = 0; i < 40; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                r: 1 + Math.random() * 2,
                alpha: 0.3 + Math.random() * 0.7,
            });
        }

        let raf = 0;
        const draw = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#0f0f1a';
            ctx.fillRect(0, 0, width, height);

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(139, 92, 246, ${p.alpha})`;
                ctx.fill();
            });

            // Draw connecting lines
            particles.forEach((a, i) => {
                particles.slice(i + 1).forEach(b => {
                    const dist = Math.hypot(a.x - b.x, a.y - b.y);
                    if (dist < 60) {
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.strokeStyle = `rgba(139, 92, 246, ${0.15 * (1 - dist / 60)})`;
                        ctx.lineWidth = 0.8;
                        ctx.stroke();
                    }
                });
            });

            raf = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(raf);
    }, [width, height]);

    return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
};

// Starfield canvas
const StarfieldCanvas = ({ width, height }: { width: number; height: number }) => {
    const ref = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const stars: { x: number; y: number; r: number; alpha: number; speed: number }[] = [];

        for (let i = 0; i < 80; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: 0.5 + Math.random() * 1.5,
                alpha: 0.3 + Math.random() * 0.7,
                speed: 0.002 + Math.random() * 0.004,
            });
        }

        let t = 0;
        let raf = 0;
        const draw = () => {
            t++;
            ctx.fillStyle = '#090a0f';
            ctx.fillRect(0, 0, width, height);

            stars.forEach(s => {
                const pulsing = Math.sin(t * s.speed * 60) * 0.3 + 0.7;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r * pulsing, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * pulsing})`;
                ctx.fill();
            });

            raf = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(raf);
    }, [width, height]);

    return <canvas ref={ref} width={width} height={height} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
};

// ─── Main Component ─────────────────────────────────────────────────────────────

const UserProfileModal = ({ onClose, userProfile }: { onClose: () => void; userProfile: any }) => {
    const [activeCanvas, setActiveCanvas] = useState<CanvasType>('gradient-pulse');
    const [showCanvasPicker, setShowCanvasPicker] = useState(false);
    const [showUserOptions, setShowUserOptions] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [showReportConfirm, setShowReportConfirm] = useState(false);
    const [isBlockLoading, setIsBlockLoading] = useState(false);
    const [isReportLoading, setIsReportLoading] = useState(false);
    const [showFedReportModal, setShowFedReportModal] = useState(false);
    const { addToast } = useToast();
    const { user: currentUser } = useUser();
    const optionsRef = useRef<HTMLDivElement>(null);
    const [note, setNote] = useState('');
    const [noteLoaded, setNoteLoaded] = useState(false);
    const lastSavedNoteRef = useRef<string>('');
    const [showGiftModal, setShowGiftModal] = useState(false);
    const [giftAmount, setGiftAmount] = useState(50);
    const [giftMessage, setGiftMessage] = useState('');
    const [gifting, setGifting] = useState(false);

    const getCanvasStorageKey = (userId?: string) => `gratonite-profile-canvas:${userId || 'me'}`;

    // Live activity from presence system
    const [activity, setActivity] = useState<{ name: string; type: string; startedAt?: string } | null>(null);
    useEffect(() => {
        const userId = userProfile?.id;
        if (!userId) return;
        const unsub = onPresenceUpdate((payload: PresenceUpdatePayload) => {
            if (payload.userId === userId) {
                setActivity(payload.activity ?? null);
            }
        });
        return unsub;
    }, [userProfile?.id]);

    // Elapsed time for PLAYING activity
    const [elapsed, setElapsed] = useState('');
    useEffect(() => {
        if (!activity || activity.type !== 'PLAYING' || !activity.startedAt) {
            setElapsed('');
            return;
        }
        const tick = () => {
            const diff = Math.max(0, Math.floor((Date.now() - new Date(activity.startedAt!).getTime()) / 1000));
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [activity]);

    // Real profile and mutuals data
    const [profile, setProfile] = useState<any>(null);
    const [mutuals, setMutuals] = useState<{ mutualServers: any[]; mutualFriends: any[] } | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [connections, setConnections] = useState<{ provider: string; providerUsername: string; profileUrl: string | null }[]>([]);

    // Fetch real data on mount
    useEffect(() => {
        const userId = userProfile?.id;
        if (!userId) { setLoadingProfile(false); return; }

        const fetchData = async () => {
            try {
                const [profileRes, mutualsRes] = await Promise.all([
                    api.users.getProfile(userId).catch(() => null),
                    api.users.getMutuals(userId).catch(() => null),
                ]);
                if (profileRes) setProfile(profileRes);
                if (mutualsRes) setMutuals(mutualsRes);
            } catch { /* fallback to userProfile prop */ }
            finally { setLoadingProfile(false); }
        };
        fetchData();

        // Fetch connections separately (non-blocking)
        api.users.getConnections(userId)
            .then((rows) => {
                if (Array.isArray(rows)) setConnections(rows);
            })
            .catch(() => {});
    }, [userProfile?.id]);

    // Fetch note
    useEffect(() => {
        const userId = userProfile?.id;
        if (!userId || userId === currentUser?.id) { setNoteLoaded(true); return; }
        api.users.getNote(userId)
            .then(data => { const c = data.content || ''; setNote(c); lastSavedNoteRef.current = c; setNoteLoaded(true); })
            .catch(() => setNoteLoaded(true));
    }, [userProfile?.id, currentUser?.id]);

    const saveNote = async () => {
        const userId = userProfile?.id;
        if (!userId) return;
        if (note === lastSavedNoteRef.current) return;
        try {
            await api.users.saveNote(userId, note);
            lastSavedNoteRef.current = note;
            addToast({ title: 'Note saved', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to save note', description: 'Please try again.', variant: 'error' });
        }
    };

    // Persist selected canvas per-user so it sticks between modal opens.
    useEffect(() => {
        const userId = userProfile?.id;
        const key = getCanvasStorageKey(userId);
        try {
            const saved = localStorage.getItem(key);
            if (!saved) return;
            const isValid = CANVAS_OPTIONS.some((opt) => opt.id === saved);
            if (isValid) setActiveCanvas(saved as CanvasType);
        } catch {
            // ignore storage errors
        }
    }, [userProfile?.id]);

    // Live-update canvas when equipping from shop/inventory
    useEffect(() => {
        const viewingUserId = userProfile?.id;
        const handler = () => {
            const key = getCanvasStorageKey(viewingUserId);
            const stored = localStorage.getItem(key) as CanvasType | null;
            if (stored && CANVAS_OPTIONS.some(opt => opt.id === stored)) {
                setActiveCanvas(stored);
            }
        };
        window.addEventListener('gratonite:profile-canvas-updated', handler);
        return () => window.removeEventListener('gratonite:profile-canvas-updated', handler);
    }, [userProfile?.id]);

    // Merge fetched data with prop data
    const displayName = profile?.displayName || userProfile?.name || 'User';
    const username = profile?.username || userProfile?.handle || 'user';
    const avatarHash = profile ? (profile.avatarHash ?? null) : (userProfile?.avatarHash ?? null);
    const bannerHash = profile ? (profile.bannerHash ?? null) : (userProfile?.bannerHash ?? null);
    const bio = profile?.bio ?? userProfile?.bio ?? null;
    const pronouns = profile?.pronouns ?? null;
    const customStatus = profile?.customStatus ?? userProfile?.customStatus ?? null;
    const isFederated = (profile as any)?.isFederated ?? (userProfile as any)?.isFederated ?? false;
    const federationAddress = (profile as any)?.federationAddress ?? (userProfile as any)?.federationAddress ?? null;

    // Escape to close
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Close options menu on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
                setShowUserOptions(false);
                setShowReportConfirm(false);
            }
        };
        if (showUserOptions) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showUserOptions]);

    const currentCanvas = CANVAS_OPTIONS.find(c => c.id === activeCanvas)!;

    const renderBannerContent = () => {
        if (activeCanvas === 'particles') {
            return <ParticleCanvas width={400} height={140} />;
        }
        if (activeCanvas === 'stars') {
            return <StarfieldCanvas width={400} height={140} />;
        }
        return null;
    };

    return (
        <>
        <div className="gt-profile-modal-backdrop modal-backdrop" data-ui-profile-modal-backdrop onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
                role="dialog" aria-modal="true"
                aria-label="User profile"
                className="gt-profile-modal profile-modal"
                data-ui-profile-modal
                onClick={e => e.stopPropagation()}
                style={{ width: '400px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative' }}
            >
                <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '6px', border: 'none', color: 'white', cursor: 'pointer', zIndex: 10 }}>
                    <X size={16} />
                </button>

                {/* Canvas Picker Toggle */}
                <Tooltip content="Change Profile Canvas" position="bottom">
                    <button
                        onClick={() => setShowCanvasPicker(p => !p)}
                        style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', borderRadius: '8px', padding: '6px 10px', border: 'none', color: 'white', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
                    >
                        <Palette size={14} /> Canvas
                    </button>
                </Tooltip>

                {/* Canvas Picker Dropdown */}
                {showCanvasPicker && (
                    <div style={{
                        position: 'absolute', top: 52, left: 16, zIndex: 20,
                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                        borderRadius: '12px', padding: '12px', width: '220px',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.6)'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                            Live Canvas
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {CANVAS_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        setActiveCanvas(opt.id);
                                        setShowCanvasPicker(false);
                                        try {
                                            localStorage.setItem(getCanvasStorageKey(userProfile?.id), opt.id);
                                        } catch {
                                            // ignore storage errors
                                        }
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        padding: '8px 10px', borderRadius: '8px', border: 'none',
                                        background: activeCanvas === opt.id ? 'var(--accent-primary-alpha)' : 'transparent',
                                        cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)'
                                    }}
                                >
                                    <div style={{ width: '28px', height: '20px', borderRadius: '4px', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                                        <div className={opt.cssClass || ''} style={{ width: '100%', height: '100%', background: opt.color || undefined }} />
                                    </div>
                                    <span style={{ fontSize: '13px', flex: 1 }}>{opt.name}</span>
                                    {opt.premium && (
                                        <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>PRO</span>
                                    )}
                                    {activeCanvas === opt.id && <span style={{ fontSize: '14px' }}>✓</span>}
                                </button>
                            ))}
                        </div>
                        <div style={{ marginTop: '8px', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Lock size={10} /> PRO canvases available in Shop
                        </div>
                    </div>
                )}

                {/* Animated Banner Area */}
                <div className="gt-profile-modal__banner" data-ui-profile-banner style={{ height: '140px', position: 'relative', overflow: 'hidden', background: !bannerHash ? (profile?.bannerColor ?? undefined) : undefined }}>
                    {/* Real banner image if available */}
                    {bannerHash ? (
                        <img src={`${API_BASE}/files/${bannerHash}`} alt="Banner" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <>
                            {/* CSS animated canvas */}
                            <div className={currentCanvas.cssClass || ''} style={{
                                position: 'absolute', inset: 0,
                                background: currentCanvas.color || undefined,
                            }} />
                            {/* JS canvas overlays */}
                            {renderBannerContent()}
                        </>
                    )}
                    {/* Gradient overlay at bottom for depth */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(to bottom, transparent, var(--bg-elevated))' }} />
                </div>

                {/* Content */}
                <div className="gt-profile-modal__content" data-ui-profile-content style={{ padding: '0 24px 24px', position: 'relative' }}>
                    <div className="gt-profile-modal__avatar" data-ui-profile-avatar style={{ marginTop: '-44px', marginBottom: '16px' }}>
                        <Avatar
                            userId={userProfile?.id || 'user'}
                            avatarHash={avatarHash}
                            displayName={displayName}
                            size={88}
                            status={userProfile?.status || 'online'}
                            statusRingColor="var(--bg-elevated)"
                            style={{ border: '4px solid var(--bg-elevated)' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-display)', margin: 0 }}>{displayName}</h2>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {(profile?.badges ?? []).map((badge: string) => {
                                const meta = BADGE_META[badge];
                                if (!meta) return null;
                                return (
                                    <Tooltip key={badge} content={meta.label} position="top">
                                        <div style={{ width: 24, height: 24, background: 'var(--bg-tertiary)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', fontSize: '14px', color: meta.color }}>{meta.emoji}</div>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>@{username}{isFederated && <RemoteBadge address={federationAddress} />}</p>
                    {profile?.level != null && profile.level > 1 && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '2px 8px', borderRadius: '10px',
                            background: 'var(--accent-primary-alpha)',
                            color: 'var(--accent-primary)',
                            fontSize: '12px', fontWeight: 600,
                            marginTop: '4px',
                        }}>
                            ⚡ Level {profile.level}
                        </div>
                    )}
                    {pronouns && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{pronouns}</p>}

                    {customStatus && (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{customStatus}</div>
                        </div>
                    )}

                    {activity && (
                        <div style={{
                            marginTop: '12px',
                            padding: '10px 12px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                        }}>
                            <div style={{
                                color: activity.type === 'PLAYING' ? '#10b981'
                                    : activity.type === 'LISTENING' ? '#8b5cf6'
                                    : '#3b82f6',
                                display: 'flex',
                                alignItems: 'center',
                            }}>
                                {activity.type === 'PLAYING' && <Gamepad2 size={16} />}
                                {activity.type === 'LISTENING' && <Headphones size={16} />}
                                {activity.type === 'WATCHING' && <Eye size={16} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: activity.type === 'PLAYING' ? '#10b981'
                                        : activity.type === 'LISTENING' ? '#8b5cf6'
                                        : '#3b82f6',
                                    marginBottom: '2px',
                                }}>
                                    {activity.type === 'PLAYING' ? 'Playing'
                                        : activity.type === 'LISTENING' ? 'Listening to'
                                        : activity.type === 'WATCHING' ? 'Watching'
                                        : activity.type}
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {activity.name}
                                </div>
                                {activity.type === 'PLAYING' && elapsed && (
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {elapsed}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div style={{ height: '1px', background: 'var(--stroke)', margin: '16px 0' }} />

                    {bio && (
                        <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.5px' }}>About Me</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {bio}
                            </p>
                        </div>
                    )}

                    {connections.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.5px' }}>Connections</h3>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {connections.map((conn) => {
                                    const label = conn.provider.charAt(0).toUpperCase() + conn.provider.slice(1);
                                    const icon = PROVIDER_ICONS[conn.provider.toLowerCase()];
                                    const inner = (
                                        <>
                                            {icon && <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>{icon}</span>}
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                                            <span style={{ color: 'var(--text-primary)' }}>{conn.providerUsername}</span>
                                        </>
                                    );
                                    if (conn.profileUrl) {
                                        return (
                                            <a
                                                key={conn.provider}
                                                href={conn.profileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}
                                            >
                                                {inner}
                                            </a>
                                        );
                                    }
                                    return (
                                        <div
                                            key={conn.provider}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}
                                        >
                                            {inner}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div style={{ height: '1px', background: 'var(--stroke)', margin: '16px 0' }} />

                    {/* Federation section — shown only for remote/federated users */}
                    {isFederated && (
                        <div style={{ marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.5px' }}>Federation</h3>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 12px', background: 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)', borderRadius: '8px',
                            }}>
                                <Globe size={16} style={{ color: '#60a5fa', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Home Instance</p>
                                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {federationAddress
                                            ? federationAddress.split('@')[1] ?? federationAddress
                                            : 'Remote instance'}
                                    </p>
                                    {federationAddress && (
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {federationAddress}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {mutuals && mutuals.mutualServers.length > 0 && (
                        <>
                            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.5px' }}>Mutual Servers — {mutuals.mutualServers.length}</h3>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                {mutuals.mutualServers.slice(0, 10).map((s: any) => (
                                    <Tooltip key={s.id} content={s.name} position="top">
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '8px',
                                            background: s.iconHash ? `url(${API_BASE}/files/${s.iconHash}) center/cover` : 'var(--bg-tertiary)',
                                            border: '1px solid var(--stroke)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer',
                                        }}>
                                            {!s.iconHash && s.name.charAt(0).toUpperCase()}
                                        </div>
                                    </Tooltip>
                                ))}
                            </div>
                        </>
                    )}

                    {mutuals && mutuals.mutualFriends.length > 0 && (
                        <>
                            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.5px' }}>Mutual Friends — {mutuals.mutualFriends.length}</h3>
                            <div style={{ display: 'flex', marginBottom: '16px', alignItems: 'center' }}>
                                {mutuals.mutualFriends.slice(0, 5).map((f: any, i: number) => (
                                    <div key={f.id} style={{ marginLeft: i > 0 ? '-6px' : 0 }}>
                                        <Avatar
                                            userId={f.id}
                                            avatarHash={f.avatarHash}
                                            displayName={f.displayName || f.username}
                                            size={28}
                                            style={{ border: '2px solid var(--bg-elevated)' }}
                                        />
                                    </div>
                                ))}
                                {mutuals.mutualFriends.length > 5 && (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>+{mutuals.mutualFriends.length - 5} more</span>
                                )}
                            </div>
                        </>
                    )}

                    {loadingProfile && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading profile...
                        </div>
                    )}

                    {noteLoaded && userProfile?.id !== currentUser?.id && (
                        <div style={{ marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px', letterSpacing: '0.5px' }}>Note</h3>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value.slice(0, 256))}
                                onBlur={saveNote}
                                placeholder="Click to add a note"
                                rows={2}
                                style={{
                                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                    borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px', padding: '6px 8px',
                                    resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                    )}

                    <div className="gt-profile-modal__actions" data-ui-profile-actions style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { addToast({ title: 'Direct Message', description: `Opening DM with ${displayName}...`, variant: 'info' }); onClose(); }} className="auth-button" style={{ marginTop: 0, flex: 1, height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <MessageSquare size={16} /> Message
                        </button>
                        {userProfile?.id !== currentUser?.id && (
                            <button
                                onClick={() => setShowGiftModal(true)}
                                style={{
                                    padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                    borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-primary)',
                                    fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px',
                                }}
                            >
                                🪙 Gift Coins
                            </button>
                        )}
                        <div ref={optionsRef} style={{ position: 'relative' }}>
                            <button onClick={() => { setShowUserOptions(prev => !prev); setShowReportConfirm(false); }} className="auth-button" style={{ marginTop: 0, width: '40px', height: '40px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <MoreHorizontal size={16} />
                            </button>

                            {showUserOptions && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '48px',
                                    right: 0,
                                    width: '200px',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--stroke)',
                                    borderRadius: '8px',
                                    padding: '6px',
                                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                                    zIndex: 30,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                }}>
                                    {/* Copy Profile Link */}
                                    <button
                                        onClick={() => {
                                            copyToClipboard(`https://gratonite.app/user/${username}`);
                                            addToast({ title: 'Profile link copied to clipboard.', variant: 'success' });
                                            setShowUserOptions(false);
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '8px 10px', borderRadius: '6px', border: 'none',
                                            background: 'transparent', cursor: 'pointer', color: 'var(--text-primary)',
                                            fontSize: '13px', width: '100%', textAlign: 'left',
                                        }}
                                        className="hover-bg-tertiary"
                                    >
                                        <Copy size={14} /> Copy Profile Link
                                    </button>

                                    {/* Block User */}
                                    <button
                                        onClick={async () => {
                                            const targetId = userProfile?.id;
                                            if (!targetId) return;
                                            setIsBlockLoading(true);
                                            try {
                                                if (isBlocked) {
                                                    await api.relationships.unblock(targetId);
                                                    setIsBlocked(false);
                                                    addToast({ title: `Unblocked ${displayName}.`, variant: 'success' });
                                                } else {
                                                    await api.relationships.block(targetId);
                                                    setIsBlocked(true);
                                                    addToast({ title: `Blocked ${displayName}.`, variant: 'success' });
                                                }
                                            } catch {
                                                addToast({ title: `Failed to ${isBlocked ? 'unblock' : 'block'} user.`, variant: 'error' });
                                            } finally {
                                                setIsBlockLoading(false);
                                                setShowUserOptions(false);
                                            }
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '8px 10px', borderRadius: '6px', border: 'none',
                                            background: 'transparent', cursor: 'pointer',
                                            color: isBlocked ? 'var(--success)' : 'var(--error)',
                                            fontSize: '13px', width: '100%', textAlign: 'left',
                                        }}
                                        className="hover-bg-tertiary"
                                    >
                                        {isBlocked ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
                                        {isBlocked ? 'Unblock User' : 'Block User'}
                                    </button>

                                    {/* Report User */}
                                    {!showReportConfirm ? (
                                        <button
                                            onClick={() => setShowReportConfirm(true)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '8px 10px', borderRadius: '6px', border: 'none',
                                                background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)',
                                                fontSize: '13px', width: '100%', textAlign: 'left',
                                            }}
                                            className="hover-bg-tertiary"
                                        >
                                            <Flag size={14} /> Report User
                                        </button>
                                    ) : (
                                        <div style={{ padding: '8px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>Report this user for violating community guidelines?</p>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    onClick={async () => {
                                                        const targetId = userProfile?.id;
                                                        if (!targetId) return;
                                                        setIsReportLoading(true);
                                                        try {
                                                            await api.reports.submit({
                                                                targetType: 'user',
                                                                targetId,
                                                                reason: 'Reported via profile modal for violating community guidelines.',
                                                            });
                                                            addToast({ title: 'User reported. Our team will review this.', variant: 'success' });
                                                        } catch {
                                                            addToast({ title: 'Failed to submit report.', variant: 'error' });
                                                        } finally {
                                                            setIsReportLoading(false);
                                                            setShowUserOptions(false);
                                                            setShowReportConfirm(false);
                                                        }
                                                    }}
                                                    style={{
                                                        flex: 1, padding: '4px 8px', borderRadius: '4px', border: 'none',
                                                        background: 'var(--error)', color: 'white', fontSize: '12px',
                                                        fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                                    }}
                                                >
                                                    <Check size={12} /> Confirm
                                                </button>
                                                <button
                                                    onClick={() => setShowReportConfirm(false)}
                                                    style={{
                                                        flex: 1, padding: '4px 8px', borderRadius: '4px',
                                                        border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
                                                        color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Report Federated Content — shown only for remote users */}
                                    {isFederated && (
                                        <button
                                            onClick={() => {
                                                setShowUserOptions(false);
                                                setShowFedReportModal(true);
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '10px',
                                                padding: '8px 10px', borderRadius: '6px', border: 'none',
                                                background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)',
                                                fontSize: '13px', width: '100%', textAlign: 'left',
                                            }}
                                            className="hover-bg-tertiary"
                                        >
                                            <Globe size={14} /> Report Federated Content
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
        {showFedReportModal && (
            <FederatedReportModal
                instanceDomain={federationAddress ? federationAddress.split('@')[1] : undefined}
                federationAddress={federationAddress ?? undefined}
                reportedUserId={userProfile?.id}
                onClose={() => setShowFedReportModal(false)}
            />
        )}
        {showGiftModal && (
            <div className="gt-gift-modal-backdrop" data-ui-gift-modal-backdrop style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                <div className="gt-gift-modal" data-ui-gift-modal style={{ background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)', padding: '24px', width: '320px' }}>
                    <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>🪙 Gift Coins</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Gift coins to <strong>{profile?.displayName}</strong>
                    </p>
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Amount (min 10)</label>
                        <input
                            type="number" min={10} step={10} value={giftAmount}
                            onChange={e => setGiftAmount(parseInt(e.target.value) || 10)}
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', boxSizing: 'border-box' as const }}
                        />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Message (optional)</label>
                        <input
                            value={giftMessage} onChange={e => setGiftMessage(e.target.value)}
                            placeholder="Add a note..."
                            style={{ width: '100%', padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', boxSizing: 'border-box' as const }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setShowGiftModal(false)} style={{ flex: 1, padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            Cancel
                        </button>
                        <button
                            disabled={gifting}
                            onClick={async () => {
                                setGifting(true);
                                try {
                                    await fetch(`${API_BASE}/users/@me/gift`, {
                                        method: 'POST',
                                        credentials: 'include',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${getAccessToken() ?? ''}`,
                                        },
                                        body: JSON.stringify({ toUserId: profile?.id, amount: giftAmount, message: giftMessage }),
                                    });
                                    setShowGiftModal(false);
                                    setGiftMessage('');
                                } catch {
                                    // show error
                                } finally {
                                    setGifting(false);
                                }
                            }}
                            style={{ flex: 1, padding: '8px', background: 'var(--accent-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'white', fontWeight: 600 }}
                        >
                            {gifting ? 'Sending...' : 'Send Gift'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default UserProfileModal;
