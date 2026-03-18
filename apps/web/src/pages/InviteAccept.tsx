import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, LogIn, AlertCircle, ArrowLeft } from 'lucide-react';
import { api, getAccessToken } from '../lib/api';
import { getDeterministicGradient } from '../utils/colors';

interface InviteGuild {
    id: string;
    name: string;
    iconHash: string | null;
    memberCount: number;
    onlineCount?: number;
    bannerHash?: string | null;
    description: string | null;
}

interface InviteInviter {
    id: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
}

interface InviteData {
    code: string;
    guild: InviteGuild;
    inviter?: InviteInviter;
    expiresAt: string | null;
    uses: number;
    maxUses: number | null;
}

type PageState =
    | { kind: 'loading' }
    | { kind: 'ready'; invite: InviteData }
    | { kind: 'joining'; invite: InviteData }
    | { kind: 'joined'; guildId: string }
    | { kind: 'error'; message: string };

export default function InviteAccept() {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [state, setState] = useState<PageState>({ kind: 'loading' });
    const isLoggedIn = !!getAccessToken();

    useEffect(() => {
        if (!code) {
            setState({ kind: 'error', message: 'No invite code provided.' });
            return;
        }

        let cancelled = false;
        api.invites.get(code).then(data => {
            if (!cancelled) setState({ kind: 'ready', invite: data as InviteData });
        }).catch((err: any) => {
            if (!cancelled) {
                const msg = err?.message || err?.code || 'This invite is invalid or has expired.';
                setState({ kind: 'error', message: msg });
            }
        });

        return () => { cancelled = true; };
    }, [code]);

    const handleJoin = async () => {
        if (!code) return;

        if (!isLoggedIn) {
            navigate(`/login?redirect=/invite/${code}`);
            return;
        }

        const currentInvite = state.kind === 'ready' ? state.invite : null;
        if (!currentInvite) return;

        setState({ kind: 'joining', invite: currentInvite });
        try {
            const guild = await api.invites.accept(code);
            setState({ kind: 'joined', guildId: guild.id });
            window.dispatchEvent(new CustomEvent('gratonite:guild-updated', { detail: { guildId: guild.id } }));
            setTimeout(() => navigate(`/guild/${guild.id}`), 1200);
        } catch (err: any) {
            const msg = err?.message || 'Failed to join server. Please try again.';
            setState({ kind: 'error', message: msg });
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '480px',
            }}>
                {/* Back link */}
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '16px',
                        padding: 0,
                    }}
                >
                    <ArrowLeft size={16} />
                    Back to home
                </button>

                {/* Card */}
                <div style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--stroke)',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}>
                    {state.kind === 'loading' && <LoadingState />}
                    {state.kind === 'error' && <ErrorState message={state.message} onBack={() => navigate('/')} />}
                    {state.kind === 'ready' && (
                        <InvitePreview
                            invite={state.invite}
                            isLoggedIn={isLoggedIn}
                            onJoin={handleJoin}
                        />
                    )}
                    {state.kind === 'joining' && (
                        <InvitePreview
                            invite={state.invite}
                            isLoggedIn={isLoggedIn}
                            onJoin={handleJoin}
                            joining
                        />
                    )}
                    {state.kind === 'joined' && <JoinedState />}
                </div>
            </div>
        </div>
    );
}

function LoadingState() {
    return (
        <div style={{
            padding: '64px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
        }}>
            <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--stroke)',
                borderTopColor: 'var(--accent-primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Loading invite...
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
    const isBanned = /ban/i.test(message);
    const [appealText, setAppealText] = useState('');
    const [appealSent, setAppealSent] = useState(false);
    const [appealSending, setAppealSending] = useState(false);

    const handleAppeal = async () => {
        if (!appealText.trim()) return;
        setAppealSending(true);
        try {
            // Extract guild ID from the URL path
            const pathMatch = window.location.pathname.match(/invite\/([^/]+)/);
            const code = pathMatch?.[1];
            if (code) {
                await api.post(`/invites/${code}/ban-appeal`, { text: appealText });
            }
            setAppealSent(true);
        } catch {
            // silently fail
        } finally {
            setAppealSending(false);
        }
    };

    return (
        <div style={{
            padding: '48px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            textAlign: 'center',
        }}>
            <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <AlertCircle size={28} color="#ef4444" />
            </div>
            <div>
                <h2 style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-primary)',
                    margin: '0 0 8px',
                }}>
                    {isBanned ? 'You Are Banned' : 'Invalid Invite'}
                </h2>
                <p style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.5,
                }}>
                    {message}
                </p>
            </div>
            {isBanned && !appealSent && (
                <div style={{ width: '100%', textAlign: 'left', marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                        Submit a Ban Appeal
                    </label>
                    <textarea
                        value={appealText}
                        onChange={e => setAppealText(e.target.value)}
                        rows={3}
                        placeholder="Explain why you should be unbanned..."
                        style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                    <button
                        onClick={handleAppeal}
                        disabled={appealSending || !appealText.trim()}
                        style={{ marginTop: '8px', padding: '8px 20px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, fontSize: '13px', cursor: (appealSending || !appealText.trim()) ? 'not-allowed' : 'pointer', opacity: (appealSending || !appealText.trim()) ? 0.5 : 1 }}
                    >
                        {appealSending ? 'Sending...' : 'Submit Appeal'}
                    </button>
                </div>
            )}
            {isBanned && appealSent && (
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>Your appeal has been submitted. A moderator will review it.</p>
            )}
            <button
                onClick={onBack}
                style={{
                    marginTop: '8px',
                    padding: '10px 24px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--stroke)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                }}
            >
                Go Home
            </button>
        </div>
    );
}

function InvitePreview({
    invite,
    isLoggedIn,
    onJoin,
    joining = false,
}: {
    invite: InviteData;
    isLoggedIn: boolean;
    onJoin: () => void;
    joining?: boolean;
}) {

    const { guild, inviter } = invite;
    const gradient = getDeterministicGradient(guild.id);
    const [hoverJoin, setHoverJoin] = useState(false);

    const bannerBg = guild.bannerHash
        ? `url(/api/files/${guild.bannerHash}) center/cover`
        : gradient;

    return (
        <>
            {/* Banner */}
            <div style={{
                height: '140px',
                background: bannerBg,
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.6))' }} />
                {inviter && (
                    <div style={{
                        position: 'absolute',
                        top: '12px',
                        left: '16px',
                        background: 'rgba(0,0,0,0.55)',
                        borderRadius: '20px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.9)',
                        backdropFilter: 'blur(4px)',
                    }}>
                        Invited by <strong>{inviter.displayName || inviter.username}</strong>
                    </div>
                )}
            </div>

            {/* Guild icon */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '-40px',
                position: 'relative',
                zIndex: 1,
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '22px',
                    background: guild.iconHash
                        ? `url(/api/guilds/${guild.id}/icon) center/cover`
                        : gradient,
                    border: '5px solid var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: 'white',
                    boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
                    overflow: 'hidden',
                }}>
                    {guild.iconHash
                        ? <img src={`/api/guilds/${guild.id}/icon`} alt={guild.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : guild.name.charAt(0).toUpperCase()
                    }
                </div>
            </div>

            {/* Content */}
            <div style={{
                padding: '16px 32px 32px',
                textAlign: 'center',
            }}>
                <p style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    margin: '0 0 4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: 600,
                }}>
                    You've been invited to join
                </p>

                <h1 style={{
                    fontSize: '26px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-primary)',
                    margin: '0 0 8px',
                }}>
                    {guild.name}
                </h1>

                {guild.description && (
                    <p style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        margin: '0 0 16px',
                        lineHeight: 1.5,
                    }}>
                        {guild.description}
                    </p>
                )}

                {/* Member count + online count */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    marginBottom: '24px',
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--text-muted)',
                        fontSize: '14px',
                    }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                        <span>
                            <strong style={{ color: 'var(--text-secondary)' }}>
                                {guild.memberCount.toLocaleString()}
                            </strong>{' '}
                            {guild.memberCount === 1 ? 'member' : 'members'}
                        </span>
                    </div>
                    {(guild.onlineCount ?? 0) > 0 && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'var(--text-muted)',
                            fontSize: '14px',
                        }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
                            <span>
                                <strong style={{ color: 'var(--success)' }}>
                                    {(guild.onlineCount ?? 0).toLocaleString()}
                                </strong>{' '}
                                online
                            </span>
                        </div>
                    )}
                </div>

                {/* Action button */}
                <button
                    onClick={onJoin}
                    disabled={joining}
                    onMouseEnter={() => setHoverJoin(true)}
                    onMouseLeave={() => setHoverJoin(false)}
                    style={{
                        width: '100%',
                        padding: '14px 24px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'var(--accent-primary)',
                        color: 'white',
                        fontSize: '15px',
                        fontWeight: 700,
                        cursor: joining ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        opacity: joining ? 0.7 : 1,
                        transform: hoverJoin && !joining ? 'scale(1.02)' : 'scale(1)',
                        transition: 'opacity 0.15s, transform 0.2s, box-shadow 0.2s',
                        boxShadow: hoverJoin && !joining ? '0 4px 16px rgba(88, 101, 242, 0.4)' : 'none',
                    }}
                >
                    {joining ? (
                        <>
                            <div style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid rgba(255,255,255,0.3)',
                                borderTopColor: 'white',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }} />
                            Joining...
                        </>
                    ) : isLoggedIn ? (
                        <>
                            <LogIn size={18} />
                            Join Portal
                        </>
                    ) : (
                        <>
                            <LogIn size={18} />
                            Log in to Join
                        </>
                    )}
                </button>

                {!isLoggedIn && (
                    <p style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '12px',
                    }}>
                        You need an account to join this server.
                    </p>
                )}
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}

function JoinedState() {
    return (
        <div style={{
            padding: '48px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Confetti particles */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                {Array.from({ length: 30 }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${Math.random() * 100}%`,
                            top: '-10px',
                            width: `${4 + Math.random() * 6}px`,
                            height: `${4 + Math.random() * 6}px`,
                            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                            background: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff71ce', '#ff9671', '#845ec2'][i % 7],
                            animation: `confettiFall ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
                            opacity: 0.9,
                        }}
                    />
                ))}
            </div>
            <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                animation: 'scaleIn 0.4s ease-out',
            }}>
                &#10003;
            </div>
            <div>
                <h2 style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    color: 'var(--text-primary)',
                    margin: '0 0 8px',
                }}>
                    Welcome!
                </h2>
                <p style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    margin: 0,
                }}>
                    You've joined the server. Redirecting...
                </p>
            </div>
            <style>{`
                @keyframes confettiFall {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(250px) rotate(720deg); opacity: 0; }
                }
                @keyframes scaleIn {
                    0% { transform: scale(0); }
                    60% { transform: scale(1.2); }
                    100% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
