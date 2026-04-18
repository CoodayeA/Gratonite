import { useState, useEffect, useRef, useCallback } from 'react';
import { Coins, Trophy, AlertCircle, Check, Trash2, Gift, Search, Settings2 } from 'lucide-react';
import { api, API_BASE } from '../../../lib/api';

type AddToastFn = (t: { title: string; description?: string; variant: 'success' | 'error' | 'info' | 'achievement' | 'undo' }) => void;

interface CurrencyPanelProps {
    guildId: string;
    addToast: AddToastFn;
}

interface CurrencyConfig {
    name: string;
    emoji: string;
    earnPerMessage: number;
    earnPerReaction: number;
    earnPerVoiceMinute: number;
    enabled: boolean;
}

interface LeaderboardEntry {
    userId: string;
    balance: number;
    lifetimeEarned: number;
}

interface MemberEntry {
    userId: string;
    username: string;
    avatarHash: string | null;
}

const DEFAULT_CONFIG: CurrencyConfig = {
    name: '',
    emoji: '💰',
    earnPerMessage: 1,
    earnPerReaction: 1,
    earnPerVoiceMinute: 2,
    enabled: false,
};

function RankBadge({ rank }: { rank: number }) {
    const palette: Record<number, { bg: string; text: string }> = {
        1: { bg: '#ffd700', text: '#000' },
        2: { bg: '#c0c0c0', text: '#000' },
        3: { bg: '#cd7f32', text: '#fff' },
    };
    const s = palette[rank] ?? { bg: 'var(--bg-tertiary)', text: 'var(--text-muted)' };
    return (
        <span style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: s.bg, color: s.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, flexShrink: 0,
        }}>
            {rank}
        </span>
    );
}

function EarnRule({
    label, description, emoji, value, onChange,
}: {
    label: string; description: string; emoji: string;
    value: number; onChange: (v: number) => void;
}) {
    return (
        <div style={{ padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{description}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={value}
                        onChange={e => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                        style={{ width: '60px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, textAlign: 'center', outline: 'none' }}
                    />
                    <span style={{ fontSize: '16px' }}>{emoji}</span>
                </div>
            </div>
            <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={e => onChange(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                <span>0</span>
                <span>100</span>
            </div>
        </div>
    );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {children}
        </h3>
    );
}

export default function CurrencyPanel({ guildId, addToast }: CurrencyPanelProps) {
    const [config, setConfig] = useState<CurrencyConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [nameTouched, setNameTouched] = useState(false);

    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [lbLoading, setLbLoading] = useState(false);

    const [members, setMembers] = useState<MemberEntry[]>([]);
    const [membersMap, setMembersMap] = useState<Map<string, MemberEntry>>(new Map());

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [awardUserId, setAwardUserId] = useState('');
    const [awardAmount, setAwardAmount] = useState(100);
    const [awarding, setAwarding] = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const filteredMembers = memberSearch.trim()
        ? members.filter(m =>
            m.username.toLowerCase().includes(memberSearch.toLowerCase())
          ).slice(0, 10)
        : [];

    // Load currency config
    useEffect(() => {
        setLoading(true);
        api.get<any>(`/guilds/${guildId}/currency`)
            .then((data: any) => {
                if (data?.enabled || data?.currency) {
                    setConfig({
                        name: data.currency?.name ?? data.name ?? '',
                        emoji: data.currency?.emoji ?? data.emoji ?? '💰',
                        earnPerMessage: data.currency?.earnPerMessage ?? data.earnPerMessage ?? 1,
                        earnPerReaction: data.currency?.earnPerReaction ?? data.earnPerReaction ?? 1,
                        earnPerVoiceMinute: data.currency?.earnPerVoiceMinute ?? data.earnPerVoiceMinute ?? 2,
                        enabled: data.enabled ?? true,
                    });
                } else {
                    setConfig(prev => ({ ...prev, enabled: false }));
                }
            })
            .catch(() => addToast({ title: 'Failed to load currency settings', variant: 'error' }))
            .finally(() => setLoading(false));
    }, [guildId]);

    // Load leaderboard
    const fetchLeaderboard = useCallback(async () => {
        setLbLoading(true);
        try {
            const data: any = await api.get<any>(`/guilds/${guildId}/currency/leaderboard`);
            const rows = Array.isArray(data) ? data : (Array.isArray(data?.entries) ? data.entries : []);
            setLeaderboard(rows.map((e: any) => ({
                userId: e.userId,
                balance: e.balance ?? e.amount ?? 0,
                lifetimeEarned: e.lifetimeEarned ?? 0,
            })));
        } catch { /* silent — board may be empty */ }
        finally { setLbLoading(false); }
    }, [guildId]);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard]);

    // Load members for name resolution and award search
    useEffect(() => {
        api.guilds.getMembers(guildId, { limit: 100 })
            .then((data: any[]) => {
                const entries: MemberEntry[] = data.map((m: any) => ({
                    userId: m.userId ?? m.id,
                    username: m.displayName ?? m.username ?? m.nickname ?? (m.userId ?? m.id ?? '').slice(0, 8),
                    avatarHash: m.avatarHash ?? null,
                }));
                setMembers(entries);
                setMembersMap(new Map(entries.map(e => [e.userId, e])));
            })
            .catch(() => { /* members unavailable — leaderboard will show truncated IDs */ });
    }, [guildId]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setMemberDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const resolveName = (userId: string) =>
        membersMap.get(userId)?.username ?? userId.slice(0, 8) + '…';

    const resolveAvatar = (userId: string) =>
        membersMap.get(userId)?.avatarHash ?? null;

    const handleSave = async () => {
        if (!config.name.trim()) { setNameTouched(true); return; }
        setSaving(true);
        try {
            await api.post(`/guilds/${guildId}/currency`, {
                name: config.name.trim(),
                emoji: config.emoji,
                earnPerMessage: config.earnPerMessage,
                earnPerReaction: config.earnPerReaction,
                earnPerVoiceMinute: config.earnPerVoiceMinute,
            });
            setConfig(prev => ({ ...prev, enabled: true }));
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
            addToast({ title: 'Currency settings saved!', variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Failed to save currency', description: err?.message, variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await api.delete(`/guilds/${guildId}/currency`);
            setConfig(DEFAULT_CONFIG);
            setLeaderboard([]);
            setShowDeleteConfirm(false);
            addToast({ title: 'Server currency deleted', variant: 'info' });
        } catch (err: any) {
            addToast({ title: 'Failed to delete currency', description: err?.message, variant: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    const handleAward = async () => {
        if (!awardUserId) return;
        setAwarding(true);
        try {
            await api.post(`/guilds/${guildId}/currency/award`, { targetUserId: awardUserId, amount: awardAmount });
            addToast({ title: `Awarded ${awardAmount} ${config.emoji} to ${resolveName(awardUserId)}!`, variant: 'success' });
            setAwardUserId('');
            setMemberSearch('');
            setAwardAmount(100);
            await fetchLeaderboard();
        } catch (err: any) {
            addToast({ title: 'Failed to award currency', description: err?.message, variant: 'error' });
        } finally {
            setAwarding(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                Loading currency settings…
            </div>
        );
    }

    return (
        <div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 6px' }}>Server Currency</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 24px' }}>
                Create a custom economy for your server. Members automatically earn currency for activity and compete on the leaderboard.
            </p>

            {/* Setup prompt when currency not yet configured */}
            {!config.enabled && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--stroke)', borderRadius: '16px', padding: '32px 24px', textAlign: 'center', marginBottom: '24px' }}>
                    <Coins size={40} style={{ color: 'var(--accent-primary)', opacity: 0.7, marginBottom: '12px' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                        No currency configured yet
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 0', maxWidth: '360px', marginInline: 'auto' }}>
                        Set a name and emoji below, then click <strong>Enable Currency</strong> to activate your server's economy.
                    </p>
                </div>
            )}

            {/* SECTION 1 — CONFIGURATION */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                <SectionHeader><Settings2 size={14} /> Configuration</SectionHeader>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Currency Name <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{config.name.length}/50</span>
                        </label>
                        <input
                            type="text"
                            value={config.name}
                            maxLength={50}
                            onChange={e => setConfig(prev => ({ ...prev, name: e.target.value }))}
                            onBlur={() => setNameTouched(true)}
                            placeholder="e.g. Server Coins"
                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: `1px solid ${nameTouched && !config.name.trim() ? 'var(--error)' : 'var(--stroke)'}`, color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                        />
                        {nameTouched && !config.name.trim() && (
                            <div style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>Name is required</div>
                        )}
                    </div>
                    <div style={{ width: '80px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emoji</label>
                        <input
                            type="text"
                            value={config.emoji}
                            onChange={e => setConfig(prev => ({ ...prev, emoji: e.target.value.slice(0, 4) }))}
                            style={{ width: '100%', padding: '10px 8px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '20px', textAlign: 'center', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {config.name.trim() && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        <span style={{ fontSize: '16px' }}>{config.emoji}</span>
                        <span style={{ fontWeight: 600 }}>100 {config.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>— preview</span>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={handleSave}
                        disabled={saving || !config.name.trim()}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '10px', background: (saving || !config.name.trim()) ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none', color: (saving || !config.name.trim()) ? 'var(--text-muted)' : '#000', fontWeight: 700, fontSize: '14px', cursor: saving ? 'wait' : 'pointer', opacity: !config.name.trim() ? 0.5 : 1 }}
                    >
                        {saving ? 'Saving…' : config.enabled ? 'Update Currency' : 'Enable Currency'}
                    </button>
                    {saved && !saving && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--success, #10b981)', fontWeight: 600, fontSize: '13px' }}>
                            <Check size={14} /> Saved
                        </span>
                    )}
                </div>
            </div>

            {/* SECTION 2 — EARNING RULES */}
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                <SectionHeader><Coins size={14} /> Earning Rules</SectionHeader>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                    Members automatically earn currency for activity in your server.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <EarnRule
                        label="Per Message"
                        description="Earned each time a member sends a message"
                        emoji={config.emoji}
                        value={config.earnPerMessage}
                        onChange={v => setConfig(prev => ({ ...prev, earnPerMessage: v }))}
                    />
                    <EarnRule
                        label="Per Reaction"
                        description="Earned each time a member adds a reaction"
                        emoji={config.emoji}
                        value={config.earnPerReaction}
                        onChange={v => setConfig(prev => ({ ...prev, earnPerReaction: v }))}
                    />
                    <EarnRule
                        label="Per Voice Minute"
                        description="Earned per minute spent in a voice channel"
                        emoji={config.emoji}
                        value={config.earnPerVoiceMinute}
                        onChange={v => setConfig(prev => ({ ...prev, earnPerVoiceMinute: v }))}
                    />
                </div>
                {config.enabled && (
                    <button
                        onClick={handleSave}
                        disabled={saving || !config.name.trim()}
                        style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', borderRadius: '8px', background: saving ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none', color: saving ? 'var(--text-muted)' : '#000', fontWeight: 600, fontSize: '13px', cursor: saving ? 'wait' : 'pointer' }}
                    >
                        {saving ? 'Saving…' : 'Save Earning Rules'}
                    </button>
                )}
            </div>

            {/* SECTION 3 — LEADERBOARD */}
            {config.enabled && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                    <SectionHeader>
                        <Trophy size={14} style={{ color: '#ffd700' }} /> Leaderboard
                    </SectionHeader>

                    {lbLoading ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
                            Loading leaderboard…
                        </div>
                    ) : leaderboard.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            <Coins size={24} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <p style={{ margin: 0 }}>
                                No balances yet. Members will earn {config.emoji} {config.name} as they participate.
                            </p>
                        </div>
                    ) : (
                        <div>
                            {leaderboard.slice(0, 10).map((entry, idx) => {
                                const avatar = resolveAvatar(entry.userId);
                                const name = resolveName(entry.userId);
                                return (
                                    <div key={entry.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', borderBottom: idx < Math.min(leaderboard.length, 10) - 1 ? '1px solid var(--stroke)' : 'none' }}>
                                        <RankBadge rank={idx + 1} />
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#000', overflow: 'hidden', flexShrink: 0 }}>
                                            {avatar
                                                ? <img src={`${API_BASE}/files/${avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                : name.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {name}
                                            </div>
                                            {entry.lifetimeEarned > 0 && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    {entry.lifetimeEarned.toLocaleString()} earned lifetime
                                                </div>
                                            )}
                                        </div>
                                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)', whiteSpace: 'nowrap' }}>
                                            {entry.balance.toLocaleString()} {config.emoji}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* SECTION 4 — AWARD CURRENCY */}
            {config.enabled && (
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
                    <SectionHeader>
                        <Gift size={14} /> Award Currency
                    </SectionHeader>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                        Manually award currency to a server member.
                    </p>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {/* Member search */}
                        <div ref={dropdownRef} style={{ flex: '1', minWidth: '180px', position: 'relative' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Member</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input
                                    type="text"
                                    value={memberSearch}
                                    onChange={e => { setMemberSearch(e.target.value); setMemberDropdownOpen(true); if (!e.target.value) setAwardUserId(''); }}
                                    onFocus={() => setMemberDropdownOpen(true)}
                                    placeholder="Search member…"
                                    style={{ width: '100%', padding: '9px 12px 9px 30px', borderRadius: '8px', background: 'var(--bg-primary)', border: `1px solid ${awardUserId ? 'var(--accent-primary)' : 'var(--stroke)'}`, color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            {memberDropdownOpen && filteredMembers.length > 0 && (
                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', zIndex: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                                    {filteredMembers.map(m => (
                                        <button
                                            key={m.userId}
                                            onClick={() => { setAwardUserId(m.userId); setMemberSearch(m.username); setMemberDropdownOpen(false); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left', fontSize: '13px' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                        >
                                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#000', overflow: 'hidden', flexShrink: 0 }}>
                                                {m.avatarHash
                                                    ? <img src={`${API_BASE}/files/${m.avatarHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    : m.username.charAt(0).toUpperCase()}
                                            </div>
                                            {m.username}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Amount */}
                        <div style={{ width: '120px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Amount</label>
                            <input
                                type="number"
                                min={1}
                                max={10000}
                                value={awardAmount}
                                onChange={e => setAwardAmount(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                            />
                        </div>

                        <button
                            onClick={handleAward}
                            disabled={awarding || !awardUserId}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', background: (!awardUserId || awarding) ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none', color: (!awardUserId || awarding) ? 'var(--text-muted)' : '#000', fontWeight: 600, fontSize: '13px', cursor: (!awardUserId || awarding) ? 'not-allowed' : 'pointer' }}
                        >
                            <Gift size={13} />
                            {awarding ? 'Awarding…' : `Award ${config.emoji}`}
                        </button>
                    </div>
                </div>
            )}

            {/* Danger zone */}
            {config.enabled && (
                <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '12px', padding: '20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--error)', letterSpacing: '0.05em', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={14} /> Danger Zone
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                        Permanently delete the server currency. All member balances will be lost.
                    </p>
                    {!showDeleteConfirm ? (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                        >
                            <Trash2 size={13} /> Delete Currency
                        </button>
                    ) : (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', color: 'var(--error)', fontWeight: 600 }}>Are you sure? This cannot be undone.</span>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{ padding: '7px 14px', borderRadius: '7px', background: 'var(--error)', border: 'none', color: 'white', fontWeight: 700, cursor: deleting ? 'wait' : 'pointer', fontSize: '13px' }}
                            >
                                {deleting ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{ padding: '7px 14px', borderRadius: '7px', background: 'transparent', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
