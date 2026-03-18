import { useState, useEffect } from 'react';
import { X, BookOpen, Rocket, Hash, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE, api } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';
import { useToast } from '../ui/ToastManager';

interface WelcomeBlock {
    id: string;
    type: 'message' | 'channels' | 'rules' | 'links';
    enabled: boolean;
    data: Record<string, any>;
}

interface GuildWelcomeModalProps {
    guildId: string;
    guildName: string;
    memberCount: number;
    iconHash?: string | null;
    bannerHash?: string | null;
    welcomeMessage: string;
    rulesChannelId?: string | null;
    onClose: () => void;
}

const WELCOME_STORAGE_KEY = 'gratonite-welcome-config';
const DISMISS_KEY = 'gratonite-welcome-dismissed';

const GuildWelcomeModal = ({
    guildId,
    guildName,
    memberCount,
    iconHash,
    bannerHash,
    welcomeMessage,
    rulesChannelId,
    onClose,
}: GuildWelcomeModalProps) => {
    const navigate = useNavigate();
    const { addToast } = useToast();

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);
    const [completing, setCompleting] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [blocks, setBlocks] = useState<WelcomeBlock[]>([]);
    const [channels, setChannels] = useState<{ id: string; name: string; topic: string | null }[]>([]);

    // Load welcome blocks from localStorage
    useEffect(() => {
        try {
            const raw = localStorage.getItem(WELCOME_STORAGE_KEY);
            if (raw) {
                const all = JSON.parse(raw);
                if (all[guildId]) {
                    setBlocks(all[guildId]);
                    return;
                }
            }
        } catch { /* ignore */ }
        // Default: just show message block
        setBlocks([{ id: 'msg', type: 'message', enabled: true, data: { text: '' } }]);
    }, [guildId]);

    // Fetch channels for the recommended channels block
    useEffect(() => {
        const hasChannelBlock = blocks.some(b => b.type === 'channels' && b.enabled && b.data.channelIds?.length > 0);
        if (!hasChannelBlock) return;
        api.get<any>(`/guilds/${guildId}/channels`).then((data: any) => {
            const mapped = (Array.isArray(data) ? data : data.channels || []).map((ch: any) => ({
                id: ch.id,
                name: ch.name,
                topic: ch.topic || null,
            }));
            setChannels(mapped);
        }).catch(() => {});
    }, [guildId, blocks]);

    const handleComplete = async () => {
        setCompleting(true);
        if (dontShowAgain) {
            try {
                const dismissed = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
                dismissed[guildId] = true;
                localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed));
            } catch { /* ignore */ }
        }
        try {
            await fetch(`${API_BASE}/guilds/${guildId}/onboarding/complete`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('gratonite_access_token') ?? ''}`,
                },
            });
        } catch {
            addToast({ title: 'Welcome!', description: `You joined ${guildName}.`, variant: 'info' });
        } finally {
            setCompleting(false);
            onClose();
        }
    };

    const handleGoToRules = async () => {
        if (!rulesChannelId) return;
        await handleComplete();
        navigate(`/guild/${guildId}/channel/${rulesChannelId}`);
    };

    const bannerUrl = bannerHash ? `${API_BASE}/files/${bannerHash}` : null;
    const guildInitial = guildName.charAt(0).toUpperCase();
    const enabledBlocks = blocks.filter(b => b.enabled);

    return (
        <div
            className="modal-backdrop"
            onClick={onClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <div
                role="dialog" aria-modal="true"
                onClick={e => e.stopPropagation()}
                style={{
                    width: 'min(480px, 95vw)',
                    background: 'var(--bg-elevated)',
                    border: 'var(--border-structural, 3px solid #000)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    boxShadow: 'var(--shadow-panel, 8px 8px 0 #000)',
                    overflow: 'hidden',
                    position: 'relative',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: 16, right: 16, zIndex: 10,
                        background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                        padding: '6px', color: 'white', cursor: 'pointer', display: 'flex',
                    }}
                >
                    <X size={16} />
                </button>

                {/* Banner / gradient header */}
                <div style={{ height: '140px', position: 'relative', overflow: 'hidden' }}>
                    {bannerUrl ? (
                        <img
                            src={bannerUrl}
                            alt={`${guildName} banner`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    ) : (
                        <div style={{ width: '100%', height: '100%', background: getDeterministicGradient(guildName) }} />
                    )}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '70px',
                        background: 'linear-gradient(transparent, var(--bg-elevated))',
                    }} />
                </div>

                {/* Content */}
                <div style={{ padding: '0 32px 32px' }}>
                    {/* Guild icon */}
                    <div style={{ marginTop: '-36px', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                            width: '72px', height: '72px', borderRadius: '16px',
                            border: '4px solid var(--bg-elevated)',
                            background: iconHash ? 'transparent' : getDeterministicGradient(guildName),
                            overflow: 'hidden',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '28px', fontWeight: 700, color: 'white',
                        }}>
                            {iconHash ? (
                                <img
                                    src={`${API_BASE}/files/${iconHash}`}
                                    alt={guildName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : guildInitial}
                        </div>
                    </div>

                    <h2 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
                        Welcome to {guildName}!
                    </h2>
                    <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                        {memberCount.toLocaleString()} {memberCount === 1 ? 'member' : 'members'}
                    </p>

                    {/* Configurable blocks */}
                    {enabledBlocks.map(block => (
                        <div key={block.id} style={{ marginBottom: '16px' }}>
                            {block.type === 'message' && (
                                <div style={{
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                    borderRadius: '10px', padding: '16px',
                                    fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6,
                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                }}>
                                    {block.data.text || welcomeMessage}
                                </div>
                            )}
                            {block.type === 'channels' && block.data.channelIds?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.05em' }}>
                                        Recommended Channels
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {block.data.channelIds.map((cid: string) => {
                                            const ch = channels.find(c => c.id === cid);
                                            return (
                                                <button
                                                    key={cid}
                                                    onClick={async () => {
                                                        await handleComplete();
                                                        navigate(`/guild/${guildId}/channel/${cid}`);
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '8px',
                                                        padding: '10px 12px', background: 'var(--bg-tertiary)',
                                                        border: '1px solid var(--stroke)', borderRadius: '8px',
                                                        color: 'var(--text-primary)', fontSize: '14px',
                                                        cursor: 'pointer', textAlign: 'left', width: '100%',
                                                    }}
                                                >
                                                    <Hash size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                    <span style={{ fontWeight: 500 }}>{ch?.name || cid}</span>
                                                    {ch?.topic && (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                            {ch.topic}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {block.type === 'rules' && block.data.summary && (
                                <div>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.05em' }}>
                                        Server Rules
                                    </div>
                                    <div style={{
                                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '10px', padding: '16px',
                                        fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                    }}>
                                        {block.data.summary}
                                    </div>
                                </div>
                            )}
                            {block.type === 'links' && block.data.items?.length > 0 && (
                                <div>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.05em' }}>
                                        Resources
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {block.data.items.map((item: { label: string; url: string }, i: number) => (
                                            <a
                                                key={i}
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '10px 12px', background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--stroke)', borderRadius: '8px',
                                                    color: 'var(--accent-primary)', fontSize: '14px',
                                                    textDecoration: 'none',
                                                }}
                                            >
                                                <ExternalLink size={16} style={{ flexShrink: 0 }} />
                                                <span>{item.label || item.url}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Don't show again */}
                    <label style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer',
                        marginBottom: '16px',
                    }}>
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={e => setDontShowAgain(e.target.checked)}
                            style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        Don't show this again
                    </label>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {rulesChannelId && (
                            <button
                                onClick={handleGoToRules}
                                disabled={completing}
                                className="auth-button"
                                style={{
                                    flex: 1, margin: 0, padding: '12px',
                                    background: 'var(--bg-tertiary)',
                                    border: '2px solid var(--stroke)',
                                    color: 'var(--text-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                    fontWeight: 700,
                                }}
                            >
                                <BookOpen size={16} /> Go to #rules
                            </button>
                        )}
                        <button
                            onClick={handleComplete}
                            disabled={completing}
                            className="auth-button"
                            style={{
                                flex: 1, margin: 0, padding: '12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                fontWeight: 700,
                            }}
                        >
                            <Rocket size={16} /> {completing ? 'Loading...' : "Let's go!"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuildWelcomeModal;
