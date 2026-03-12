import { useState } from 'react';
import { X, BookOpen, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../../lib/api';
import { getDeterministicGradient } from '../../utils/colors';
import { useToast } from '../ui/ToastManager';

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
    const [completing, setCompleting] = useState(false);

    const handleComplete = async () => {
        setCompleting(true);
        try {
            await fetch(`${API_BASE}/guilds/${guildId}/onboarding/complete`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('gratonite_access_token') ?? ''}`,
                },
            });
        } catch {
            // Non-blocking — just close the modal even if the API call fails
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

    return (
        <div
            className="modal-overlay"
            onClick={onClose}
            style={{ zIndex: 500 }}
        >
            <div
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

                    {/* Welcome message */}
                    <div style={{
                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                        borderRadius: '10px', padding: '16px', marginBottom: '24px',
                        fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                        {welcomeMessage}
                    </div>

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
