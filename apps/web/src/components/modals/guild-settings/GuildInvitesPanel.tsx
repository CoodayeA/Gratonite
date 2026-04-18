import { useState, useEffect, useCallback } from 'react';
import { Link2, Copy, Clock, Users, AlertCircle, RefreshCw, Plus, X, Check } from 'lucide-react';
import { api, API_BASE } from '../../../lib/api';

type AddToastFn = (t: { title: string; description?: string; variant: 'success' | 'error' | 'info' | 'achievement' | 'undo' }) => void;

interface InviteRow {
    code: string;
    inviterName: string;
    inviterAvatar: string | null;
    uses: number;
    maxUses: number | null;
    expiresAt: string | null;
    createdAt: string;
}

interface Channel {
    id: string;
    name: string;
    type: string;
}

const EXPIRY_OPTIONS = [
    { label: '1 hour', value: 3600 },
    { label: '6 hours', value: 21600 },
    { label: '24 hours', value: 86400 },
    { label: '7 days', value: 604800 },
    { label: '30 days', value: 2592000 },
    { label: 'Never', value: 0 },
];

function relativeExpiry(expiresAt: string | null): { text: string; urgent: boolean } {
    if (!expiresAt) return { text: 'Never', urgent: false };
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { text: 'Expired', urgent: true };
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (days >= 1) return { text: `${days} day${days !== 1 ? 's' : ''} left`, urgent: days <= 1 };
    return { text: `${hours} hour${hours !== 1 ? 's' : ''} left`, urgent: true };
}

function formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SkeletonRow() {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 130px 120px 80px', gap: '12px', padding: '12px 16px', alignItems: 'center', borderBottom: '1px solid var(--stroke)' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{ height: '14px', borderRadius: '6px', background: 'var(--bg-tertiary)', opacity: 0.6, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
        </div>
    );
}

function GuildInvitesPanel({ guildId, addToast }: { guildId: string; addToast: AddToastFn }) {
    const [invites, setInvites] = useState<InviteRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
    const [revoking, setRevoking] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // Create invite state
    const [showCreate, setShowCreate] = useState(false);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState('');
    const [selectedExpiry, setSelectedExpiry] = useState(86400);
    const [creating, setCreating] = useState(false);

    const fetchInvites = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const raw = await api.invites.list(guildId) as any[];
            setInvites((Array.isArray(raw) ? raw : []).map((inv: any) => ({
                code: inv.code,
                inviterName: inv.inviter?.displayName || inv.inviter?.username || 'Unknown',
                inviterAvatar: inv.inviter?.avatarHash ?? null,
                uses: inv.uses ?? 0,
                maxUses: inv.maxUses ?? null,
                expiresAt: inv.expiresAt ?? null,
                createdAt: inv.createdAt ?? '',
            })));
        } catch {
            setError('Failed to load invites. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        fetchInvites();
    }, [fetchInvites]);

    useEffect(() => {
        api.channels.getGuildChannels(guildId)
            .then((chs: any[]) => {
                const text = chs.filter((c: any) => c.type === 'GUILD_TEXT' || c.type === 'text');
                setChannels(text.map((c: any) => ({ id: c.id, name: c.name, type: c.type })));
                if (text.length > 0) setSelectedChannel(text[0].id);
            })
            .catch(() => {});
    }, [guildId]);

    const handleCopy = (code: string) => {
        const url = `https://gratonite.chat/invite/${code}`;
        navigator.clipboard.writeText(url).catch(() => {});
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(null), 2000);
        addToast({ title: 'Invite link copied!', variant: 'info' });
    };

    const handleRevoke = async (code: string) => {
        if (revokeConfirm !== code) {
            setRevokeConfirm(code);
            setTimeout(() => setRevokeConfirm(c => c === code ? null : c), 3000);
            return;
        }
        setRevoking(code);
        setRevokeConfirm(null);
        setInvites(prev => prev.filter(i => i.code !== code));
        try {
            await api.invites.delete(code);
            addToast({ title: 'Invite revoked', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to revoke invite', variant: 'error' });
            fetchInvites();
        } finally {
            setRevoking(null);
        }
    };

    const handleCreate = async () => {
        if (!selectedChannel) return;
        setCreating(true);
        try {
            const result = await api.invites.create(guildId, {
                maxUses: 0,
                expiresIn: selectedExpiry > 0 ? selectedExpiry : undefined,
            }) as any;
            addToast({ title: 'Invite created!', variant: 'success' });
            setShowCreate(false);
            await fetchInvites();
            if (result?.code) handleCopy(result.code);
        } catch {
            addToast({ title: 'Failed to create invite', variant: 'error' });
        } finally {
            setCreating(false);
        }
    };

    return (
        <div>
            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px' }}>Invites</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                        Manage active invite links for this server.
                        {!loading && !error && (
                            <span style={{ marginLeft: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                {invites.length} active
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', cursor: 'pointer', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}
                >
                    {showCreate ? <X size={14} /> : <Plus size={14} />}
                    {showCreate ? 'Cancel' : 'Create Invite'}
                </button>
            </div>

            {/* Create Invite Panel */}
            {showCreate && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '20px', animation: 'fadeIn 0.15s ease' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '16px' }}>New Invite</div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {channels.length > 0 && (
                            <div style={{ flex: '1', minWidth: '160px' }}>
                                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Channel</label>
                                <select
                                    value={selectedChannel}
                                    onChange={e => setSelectedChannel(e.target.value)}
                                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                                >
                                    {channels.map(ch => (
                                        <option key={ch.id} value={ch.id}># {ch.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div style={{ flex: '1', minWidth: '160px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Expires after</label>
                            <select
                                value={selectedExpiry}
                                onChange={e => setSelectedExpiry(Number(e.target.value))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                            >
                                {EXPIRY_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleCreate}
                        disabled={creating || (!selectedChannel && channels.length > 0)}
                        style={{ padding: '9px 20px', borderRadius: '8px', background: creating ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none', color: creating ? 'var(--text-muted)' : '#000', cursor: creating ? 'wait' : 'pointer', fontWeight: 600, fontSize: '13px' }}
                    >
                        {creating ? 'Creating...' : 'Generate Invite Link'}
                    </button>
                </div>
            )}

            {/* States */}
            {loading ? (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', overflow: 'hidden' }}>
                    {/* Header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 130px 120px 80px', gap: '12px', padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--stroke)' }}>
                        {['INVITE CODE', 'CREATED BY', 'USES', 'EXPIRES', 'CREATED', ''].map(h => (
                            <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                        ))}
                    </div>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                </div>
            ) : error ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: 'var(--text-muted)', gap: '12px' }}>
                    <AlertCircle size={32} style={{ opacity: 0.5, color: 'var(--error)' }} />
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--error)' }}>{error}</span>
                    <button onClick={fetchInvites} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                        <RefreshCw size={13} /> Retry
                    </button>
                </div>
            ) : invites.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', color: 'var(--text-muted)', gap: '12px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Link2 size={28} style={{ opacity: 0.4 }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px', color: 'var(--text-primary)' }}>No active invites</p>
                        <p style={{ fontSize: '13px', margin: 0 }}>Create an invite above to let others join your server.</p>
                    </div>
                </div>
            ) : (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', overflow: 'hidden' }}>
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 90px 130px 120px 80px', gap: '12px', padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--stroke)' }}>
                        {['INVITE CODE', 'CREATED BY', 'USES', 'EXPIRES', 'CREATED', ''].map(h => (
                            <span key={h} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                        ))}
                    </div>

                    {/* Rows */}
                    {invites.map((inv, idx) => {
                        const expiry = relativeExpiry(inv.expiresAt);
                        const usagePct = inv.maxUses ? Math.min((inv.uses / inv.maxUses) * 100, 100) : null;
                        const isLast = idx === invites.length - 1;
                        const isRevoking = revoking === inv.code;
                        const isConfirming = revokeConfirm === inv.code;

                        return (
                            <div key={inv.code} style={{
                                display: 'grid', gridTemplateColumns: '1fr 140px 90px 130px 120px 80px', gap: '12px',
                                padding: '12px 16px', alignItems: 'center', fontSize: '13px',
                                borderBottom: isLast ? 'none' : '1px solid var(--stroke)',
                                opacity: isRevoking ? 0.4 : 1, transition: 'opacity 0.2s',
                            }}>
                                {/* Code */}
                                <button
                                    onClick={() => handleCopy(inv.code)}
                                    title="Click to copy invite link"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', width: 'fit-content', maxWidth: '100%' }}
                                >
                                    <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontWeight: 700, fontSize: '13px' }}>{inv.code}</span>
                                    {copiedCode === inv.code
                                        ? <Check size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                                        : <Copy size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                                </button>

                                {/* Inviter */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#000', flexShrink: 0, overflow: 'hidden' }}>
                                        {inv.inviterAvatar
                                            ? <img src={`${API_BASE}/files/${inv.inviterAvatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : inv.inviterName.charAt(0).toUpperCase()}
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.inviterName}</span>
                                </div>

                                {/* Uses */}
                                <div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                                        {inv.uses}{inv.maxUses != null ? ` / ${inv.maxUses}` : ''}
                                    </div>
                                    {usagePct !== null && (
                                        <div style={{ height: '4px', borderRadius: '2px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: '2px', background: usagePct >= 90 ? 'var(--error)' : 'var(--accent-primary)', width: `${usagePct}%` }} />
                                        </div>
                                    )}
                                </div>

                                {/* Expiry */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: expiry.urgent ? (expiry.text === 'Expired' ? 'var(--error)' : '#f59e0b') : 'var(--text-muted)', fontSize: '12px' }}>
                                    <Clock size={11} />
                                    {expiry.text}
                                </div>

                                {/* Created */}
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatDate(inv.createdAt)}</span>

                                {/* Revoke */}
                                <button
                                    onClick={() => handleRevoke(inv.code)}
                                    disabled={isRevoking}
                                    style={{
                                        padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: isRevoking ? 'wait' : 'pointer',
                                        background: isConfirming ? 'rgba(239,68,68,0.15)' : 'transparent',
                                        border: `1px solid ${isConfirming ? 'var(--error)' : 'var(--stroke)'}`,
                                        color: isConfirming ? 'var(--error)' : 'var(--text-muted)',
                                        transition: 'all 0.15s', whiteSpace: 'nowrap',
                                    }}
                                >
                                    {isConfirming ? 'Confirm?' : 'Revoke'}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Refresh hint */}
            {!loading && !error && invites.length > 0 && (
                <button
                    onClick={fetchInvites}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', padding: '4px 0' }}
                >
                    <RefreshCw size={11} /> Refresh
                </button>
            )}
        </div>
    );
}

export default GuildInvitesPanel;
