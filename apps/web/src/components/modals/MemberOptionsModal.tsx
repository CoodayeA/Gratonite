import { useState, useEffect } from 'react';
import { X, Link2, Bell, BellOff, User, EyeOff, LogOut, Check, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <div
        onClick={() => onChange(!value)}
        style={{
            width: '40px', height: '24px',
            background: value ? 'var(--accent-primary)' : 'var(--bg-elevated)',
            borderRadius: '12px', position: 'relative', cursor: 'pointer',
            border: `1px solid ${value ? 'var(--accent-primary)' : 'var(--stroke)'}`,
            transition: 'all 0.2s', flexShrink: 0,
        }}
    >
        <div style={{
            width: '18px', height: '18px',
            background: value ? '#fff' : 'var(--text-muted)',
            borderRadius: '50%', position: 'absolute', top: '2px',
            left: value ? '19px' : '2px', transition: 'all 0.2s',
        }} />
    </div>
);

const SectionRow = ({ icon, label, sub, right }: { icon: React.ReactNode; label: string; sub?: string; right: React.ReactNode }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                {icon}
            </div>
            <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>{label}</div>
                {sub && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>{sub}</div>}
            </div>
        </div>
        {right}
    </div>
);

const MemberOptionsModal = ({ onClose, guildId, guildName }: { onClose: () => void; guildId: string; guildName: string }) => {
    const { addToast } = useToast();
    const navigate = useNavigate();

    const muteKey = `gratonite:muted:${guildId}`;
    const hideMutedKey = `gratonite:hide-muted-channels:${guildId}`;

    const [muted, setMuted] = useState(() => localStorage.getItem(muteKey) === 'true');
    const [hideMuted, setHideMuted] = useState(() => localStorage.getItem(hideMutedKey) === 'true');
    const [nickname, setNickname] = useState('');
    const [nickSaving, setNickSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [leaveConfirm, setLeaveConfirm] = useState(false);
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    useEffect(() => {
        if (!guildId) return;
        api.profiles.getMemberProfile(guildId, '@me')
            .then((p: any) => { if (p?.nickname) setNickname(p.nickname); })
            .catch(() => {});
    }, [guildId]);

    const handleMuteToggle = (val: boolean) => {
        setMuted(val);
        if (val) localStorage.setItem(muteKey, 'true');
        else localStorage.removeItem(muteKey);
    };

    const handleHideMutedToggle = (val: boolean) => {
        setHideMuted(val);
        if (val) localStorage.setItem(hideMutedKey, 'true');
        else localStorage.removeItem(hideMutedKey);
    };

    const handleCopyInvite = async () => {
        if (!guildId) return;
        try {
            const invite = await api.invites.create(guildId, { channelId: '' });
            const link = `${window.location.origin}/invite/${invite.code}`;
            await navigator.clipboard.writeText(link);
            setCopied(true);
            addToast({ title: 'Invite link copied to clipboard', variant: 'success' });
            setTimeout(() => setCopied(false), 2000);
        } catch {
            addToast({ title: 'Failed to create invite link', variant: 'error' });
        }
    };

    const handleSaveNickname = async () => {
        if (!guildId) return;
        setNickSaving(true);
        try {
            await api.profiles.updateMemberProfile(guildId, { nickname: nickname.trim() || null });
            addToast({ title: 'Nickname updated', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to update nickname', variant: 'error' });
        } finally {
            setNickSaving(false);
        }
    };

    const handleLeave = async () => {
        if (!leaveConfirm) { setLeaveConfirm(true); return; }
        setLeaving(true);
        try {
            await api.guilds.leave(guildId);
            addToast({ title: `Left ${guildName}`, variant: 'info' });
            window.dispatchEvent(new CustomEvent('gratonite:guild-left', { detail: { guildId } }));
            onClose();
            navigate('/');
        } catch {
            addToast({ title: 'Failed to leave server', variant: 'error' });
            setLeaving(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="login-box glass-panel" style={{ width: '480px', padding: '32px', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                <h2 style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Server Options</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '14px' }}>{guildName}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Invite People */}
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Invite People</label>
                    <button
                        onClick={handleCopyInvite}
                        className="auth-button"
                        style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: copied ? 'var(--success)' : 'var(--accent-primary)', color: '#000', border: '3px solid #000', fontWeight: 800 }}
                    >
                        {copied ? <><Check size={16} /> Link Copied!</> : <><Link2 size={16} /> Create Invite Link</>}
                    </button>

                    <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }} />

                    {/* Notifications */}
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Notifications</label>
                    <SectionRow
                        icon={muted ? <BellOff size={16} /> : <Bell size={16} />}
                        label="Mute this Server"
                        sub={muted ? 'Notifications are suppressed' : 'You will receive notifications'}
                        right={<Toggle value={muted} onChange={handleMuteToggle} />}
                    />

                    <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }} />

                    {/* Nickname */}
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Your Profile in {guildName}</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '0 12px' }}>
                            <User size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                            <input
                                type="text"
                                placeholder="Nickname (leave blank to reset)"
                                value={nickname}
                                onChange={e => setNickname(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSaveNickname(); }}
                                style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '10px 0', fontSize: '14px', outline: 'none' }}
                            />
                        </div>
                        <button
                            onClick={handleSaveNickname}
                            disabled={nickSaving}
                            className="auth-button"
                            style={{ margin: 0, padding: '0 16px', whiteSpace: 'nowrap', opacity: nickSaving ? 0.6 : 1 }}
                        >
                            Save
                        </button>
                    </div>

                    <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }} />

                    {/* Hide Muted Channels */}
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '4px' }}>Channel Display</label>
                    <SectionRow
                        icon={<EyeOff size={16} />}
                        label="Hide Muted Channels"
                        sub="Filter out muted channels from the sidebar"
                        right={<Toggle value={hideMuted} onChange={handleHideMutedToggle} />}
                    />

                    <div style={{ height: '1px', background: 'var(--stroke)', margin: '8px 0' }} />

                    {/* Leave Server */}
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--error)', marginBottom: '4px' }}>Danger Zone</label>
                    {leaveConfirm ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleLeave}
                                disabled={leaving}
                                className="auth-button"
                                style={{ margin: 0, flex: 1, background: 'var(--error)', color: '#fff', border: '3px solid #000', fontWeight: 800, opacity: leaving ? 0.7 : 1 }}
                            >
                                {leaving ? 'Leaving...' : 'Yes, Leave Server'}
                            </button>
                            <button
                                onClick={() => setLeaveConfirm(false)}
                                className="auth-button"
                                style={{ margin: 0, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '3px solid #000', fontWeight: 800 }}
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleLeave}
                            className="auth-button"
                            style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'transparent', color: 'var(--error)', border: '2px solid var(--error)', fontWeight: 700 }}
                        >
                            <LogOut size={16} /> Leave Server
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MemberOptionsModal;
