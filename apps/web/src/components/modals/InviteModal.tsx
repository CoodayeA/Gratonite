import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Clock, Users, Link as LinkIcon, RefreshCw, Loader } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';
import { copyToClipboard } from '../../utils/clipboard';

const EXPIRE_MAP: Record<string, number | null> = {
    '30 minutes': 1800,
    '1 hour': 3600,
    '12 hours': 43200,
    '1 day': 86400,
    '7 days': 604800,
    'Never': null,
};

const USES_MAP: Record<string, number | undefined> = {
    'No limit': undefined,
    '1 use': 1,
    '5 uses': 5,
    '10 uses': 10,
    '25 uses': 25,
    '50 uses': 50,
    '100 uses': 100,
};

const InviteModal = ({ onClose, guildId }: { onClose: () => void; guildId: string | null }) => {
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const [inviteLink, setInviteLink] = useState('');
    const [expireAfter, setExpireAfter] = useState('7 days');
    const [maxUses, setMaxUses] = useState('No limit');
    const [tempMembership, setTempMembership] = useState(false);

    const generateInvite = useCallback(async () => {
        if (!guildId) return;
        setLoading(true);
        try {
            const result = await api.invites.create(guildId, {
                maxUses: USES_MAP[maxUses],
                expiresIn: EXPIRE_MAP[expireAfter] ?? undefined,
            });
            setInviteLink(`${window.location.origin}/app/invite/${result.code}`);
            setCopied(false);
        } catch {
            addToast({ title: 'Failed to create invite', variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [guildId, maxUses, expireAfter, addToast]);

    // Auto-generate on mount
    useEffect(() => {
        generateInvite();
    }, [generateInvite]);

    const handleCopy = () => {
        if (!inviteLink) return;
        copyToClipboard(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
            <div role="dialog" aria-modal="true" aria-label="Invite to server" className="login-box glass-panel" style={{ width: 'min(480px, 95vw)', padding: '32px', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                <h2 style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Invite Friends</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '14px' }}>Share this link with others to grant them access to this server.</p>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Send a Portal Invite Link</label>
                    <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', border: `1px solid ${copied ? 'var(--success)' : 'var(--stroke)'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', background: 'rgba(0,0,0,0.2)' }}>
                            <LinkIcon size={18} color="var(--text-muted)" />
                        </div>
                        <input
                            type="text"
                            readOnly
                            value={loading ? 'Generating...' : inviteLink}
                            style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', padding: '0 16px', fontSize: '15px', outline: 'none' }}
                        />
                        <button
                            onClick={handleCopy}
                            disabled={loading || !inviteLink}
                            style={{
                                background: copied ? 'var(--success)' : 'var(--accent-primary)',
                                border: 'none', color: 'white', padding: '0 24px', fontSize: '14px', fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                transition: 'background 0.2s', opacity: loading ? 0.5 : 1
                            }}
                        >
                            {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy</>}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '32px' }}>
                    <span>Your invite link expires in {expireAfter === 'Never' ? '∞ (never)' : expireAfter}.</span>
                </div>

                <div style={{ height: '1px', background: 'var(--stroke)', marginBottom: '24px', margin: '0 -32px' }}></div>

                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Invite Settings</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                <Clock size={16} />
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>Expire After</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{expireAfter}</div>
                            </div>
                        </div>
                        <select value={expireAfter} onChange={e => setExpireAfter(e.target.value)} className="auth-input" style={{ width: '120px', margin: 0, height: '36px', padding: '0 12px' }}>
                            <option>30 minutes</option>
                            <option>1 hour</option>
                            <option>12 hours</option>
                            <option>1 day</option>
                            <option>7 days</option>
                            <option>Never</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                <Users size={16} />
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>Max Number of Uses</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{maxUses}</div>
                            </div>
                        </div>
                        <select value={maxUses} onChange={e => setMaxUses(e.target.value)} className="auth-input" style={{ width: '120px', margin: 0, height: '36px', padding: '0 12px' }}>
                            <option>No limit</option>
                            <option>1 use</option>
                            <option>5 uses</option>
                            <option>10 uses</option>
                            <option>25 uses</option>
                            <option>50 uses</option>
                            <option>100 uses</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '2px' }}>Grant temporary membership</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Members are automatically kicked when they disconnect unless a role is assigned.</div>
                        </div>
                        <div onClick={() => setTempMembership(!tempMembership)} style={{ width: '40px', height: '24px', background: tempMembership ? 'var(--accent-primary)' : 'var(--bg-elevated)', borderRadius: '12px', position: 'relative', cursor: 'pointer', border: `1px solid ${tempMembership ? 'var(--accent-primary)' : 'var(--stroke)'}`, transition: 'all 0.2s', flexShrink: 0 }}>
                            <div style={{ width: '18px', height: '18px', background: tempMembership ? '#fff' : 'var(--text-muted)', borderRadius: '50%', position: 'absolute', top: '2px', left: tempMembership ? '19px' : '2px', transition: 'all 0.2s' }}></div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={generateInvite}
                    disabled={loading}
                    className="auth-button"
                    style={{ margin: 0, width: '100%', background: 'transparent', border: '1px solid var(--stroke)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.5 : 1 }}
                >
                    {loading ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />} Generate a New Link
                </button>
            </div>
        </div>
    );
};

export default InviteModal;
