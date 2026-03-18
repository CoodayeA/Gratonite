import { useState, useEffect } from 'react';
import { X, Check, Minus } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

const PERM_BITS: { key: string; label: string; bit: bigint }[] = [
    { key: 'ADD_REACTIONS', label: 'Add Reactions', bit: 1n << 6n },
    { key: 'VIEW_CHANNEL', label: 'View Channel', bit: 1n << 10n },
    { key: 'SEND_MESSAGES', label: 'Send Messages', bit: 1n << 11n },
    { key: 'MANAGE_MESSAGES', label: 'Manage Messages', bit: 1n << 13n },
    { key: 'EMBED_LINKS', label: 'Embed Links', bit: 1n << 14n },
    { key: 'ATTACH_FILES', label: 'Attach Files', bit: 1n << 15n },
    { key: 'READ_MESSAGE_HISTORY', label: 'Read Message History', bit: 1n << 16n },
    { key: 'MENTION_EVERYONE', label: 'Mention Everyone', bit: 1n << 17n },
    { key: 'USE_APPLICATION_COMMANDS', label: 'Use Application Commands', bit: 1n << 31n },
];

type PermState = 'allow' | 'neutral' | 'deny';

interface Role {
    id: string;
    name: string;
    color: string | null;
    permissions: string;
    position: number;
}

interface Override {
    id: string;
    targetId: string;
    targetType: string;
    allow: string;
    deny: string;
}

interface Props {
    channelId: string;
    channelName: string;
    channelTopic?: string;
    channelType?: string;
    guildId: string;
    rateLimitPerUser?: number;
    isNsfw?: boolean;
    userLimit?: number;
    onClose: () => void;
    onUpdate?: (changes: Partial<{ name: string; topic: string; rateLimitPerUser: number; userLimit: number }>) => void;
}

const SLOWMODE_OPTIONS = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600];

function formatSlowmode(s: number): string {
    if (s === 0) return 'Off';
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
}

export function ChannelSettingsModal({ channelId, channelName, channelTopic, channelType, guildId, rateLimitPerUser, isNsfw, userLimit: initialUserLimit, onClose, onUpdate }: Props) {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'overview' | 'permissions'>('overview');

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Overview state
    const [name, setName] = useState(channelName);
    const [topic, setTopic] = useState(channelTopic || '');
    const [slowmode, setSlowmode] = useState(rateLimitPerUser || 0);
    const [nsfw, setNsfw] = useState(isNsfw || false);
    const [isAnnouncement, setIsAnnouncement] = useState(false);
    const [disappearTimer, setDisappearTimer] = useState<number | null>(null);
    const [userLimit, setUserLimit] = useState(initialUserLimit || 0);
    const [isEncrypted, setIsEncrypted] = useState(false);
    const [attachmentsEnabled, setAttachmentsEnabled] = useState(true);
    const [permissionSynced, setPermissionSynced] = useState(true);
    const [parentId, setParentId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [roleSlowmodeOverrides, setRoleSlowmodeOverrides] = useState<Record<string, number>>({});
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
    const [isArchived, setIsArchived] = useState(false);
    const [autoArchiveDays, setAutoArchiveDays] = useState<number | null>(null);
    const isVoice = channelType === 'GUILD_VOICE' || channelType === 'voice' || channelType === 'GUILD_STAGE_VOICE';

    // Permissions state
    const [roles, setRoles] = useState<Role[]>([]);
    const [overrides, setOverrides] = useState<Override[]>([]);
    const [expandedRole, setExpandedRole] = useState<string | null>(null);
    const [viewAsRole, setViewAsRole] = useState<string>('');
    const [permsSaving, setPermsSaving] = useState(false);

    useEffect(() => {
        api.guilds.getRoles(guildId).then((r: any[]) => setRoles(r)).catch(() => {});
        api.channels.getPermissionOverrides(channelId).then((o: any[]) => setOverrides(o)).catch(() => {});
        api.channels.get(channelId).then((ch: any) => {
            if (ch.isAnnouncement) setIsAnnouncement(true);
            if (ch.isEncrypted) setIsEncrypted(true);
            if (ch.attachmentsEnabled === false) setAttachmentsEnabled(false);
            if (ch.parentId) setParentId(ch.parentId);
            if (ch.permissionSynced === false) setPermissionSynced(false);
            if (ch.archived) setIsArchived(true);
            if (ch.autoArchiveDays != null) setAutoArchiveDays(ch.autoArchiveDays);
            if (ch.slowmodeOverrides) setRoleSlowmodeOverrides(ch.slowmodeOverrides);
            if (ch.disappearTimer != null) setDisappearTimer(ch.disappearTimer);
        }).catch(() => {});
    }, [channelId, guildId]);

    function getPermState(roleId: string, bit: bigint): PermState {
        const override = overrides.find(o => o.targetId === roleId);
        if (!override) return 'neutral';
        const allow = BigInt(override.allow);
        const deny = BigInt(override.deny);
        if ((allow & bit) !== 0n) return 'allow';
        if ((deny & bit) !== 0n) return 'deny';
        return 'neutral';
    }

    function cycleOverride(roleId: string, bit: bigint) {
        setOverrides(prev => {
            const existing = prev.find(o => o.targetId === roleId);
            const current = getPermState(roleId, bit);
            const nextState: PermState = current === 'neutral' ? 'allow' : current === 'allow' ? 'deny' : 'neutral';

            let allow = existing ? BigInt(existing.allow) : 0n;
            let deny = existing ? BigInt(existing.deny) : 0n;
            allow = allow & ~bit;
            deny = deny & ~bit;
            if (nextState === 'allow') allow = allow | bit;
            if (nextState === 'deny') deny = deny | bit;

            if (existing) {
                return prev.map(o => o.targetId === roleId ? { ...o, allow: allow.toString(), deny: deny.toString() } : o);
            } else {
                return [...prev, { id: '', targetId: roleId, targetType: 'role', allow: allow.toString(), deny: deny.toString() }];
            }
        });
    }

    async function saveOverview() {
        setSaving(true);
        try {
            await api.channels.update(channelId, { name, topic, rateLimitPerUser: slowmode, nsfw, isAnnouncement, isEncrypted, attachmentsEnabled, permissionSynced, autoArchiveDays, ...(isVoice ? { userLimit } : {}), ...(Object.keys(roleSlowmodeOverrides).length > 0 ? { slowmodeOverrides: roleSlowmodeOverrides } : {}) });
            onUpdate?.({ name, topic, rateLimitPerUser: slowmode, ...(isVoice ? { userLimit } : {}) });
            addToast({ title: 'Channel Updated', variant: 'success' });
            onClose();
        } catch {
            addToast({ title: 'Failed to update channel', variant: 'error' });
        } finally {
            setSaving(false);
        }
    }

    async function savePermissions() {
        setPermsSaving(true);
        try {
            for (const override of overrides) {
                if (override.allow === '0' && override.deny === '0') {
                    if (override.id) {
                        await api.channels.deletePermissionOverride(channelId, override.targetId);
                    }
                } else {
                    await api.channels.setPermissionOverride(channelId, override.targetId, {
                        targetType: override.targetType as 'role' | 'member',
                        allow: override.allow,
                        deny: override.deny,
                    });
                }
            }
            addToast({ title: 'Permissions Updated', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to save permissions', variant: 'error' });
        } finally {
            setPermsSaving(false);
        }
    }

    function computeEffectivePerms(roleId: string): Array<{ key: string; label: string; allowed: boolean }> {
        const role = roles.find(r => r.id === roleId);
        const basePerm = BigInt(role?.permissions || '0');
        const override = overrides.find(o => o.targetId === roleId);
        const allow = BigInt(override?.allow || '0');
        const deny = BigInt(override?.deny || '0');
        const effective = (basePerm | allow) & ~deny;
        return PERM_BITS.map(p => ({ key: p.key, label: p.label, allowed: (effective & p.bit) !== 0n }));
    }

    const tabStyle = (tab: string) => ({
        display: 'block' as const,
        width: '100%',
        textAlign: 'left' as const,
        padding: '8px 12px',
        border: 'none',
        background: activeTab === tab ? 'var(--bg-tertiary)' : 'transparent',
        borderRadius: '6px',
        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: 'pointer' as const,
        fontSize: '14px',
        fontWeight: 500,
        fontFamily: 'inherit',
        transition: 'background 0.1s',
    });

    return (
        <div
            className="modal-backdrop"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={onClose}
        >
            <div
                role="dialog" aria-modal="true"
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    borderRadius: '16px',
                    display: 'flex',
                    width: '740px',
                    maxWidth: '95vw',
                    height: '560px',
                    maxHeight: '85vh',
                    overflow: 'hidden',
                }}
            >
                {/* Sidebar */}
                <div style={{ width: '200px', background: 'var(--bg-secondary)', padding: '16px 8px', borderRadius: '16px 0 0 16px', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '8px 12px', marginBottom: '4px', letterSpacing: '0.5px' }}>
                        # {channelName}
                    </div>
                    <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>Overview</button>
                    <button style={tabStyle('permissions')} onClick={() => setActiveTab('permissions')}>Permissions</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, padding: '24px', overflowY: 'auto', position: 'relative' }}>
                    <button
                        onClick={onClose}
                        style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                    >
                        <X size={20} />
                    </button>

                    {activeTab === 'overview' && (
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 0, marginBottom: '20px' }}>Channel Overview</h2>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Channel Name
                                </label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                                        fontFamily: 'inherit',
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Channel Topic
                                </label>
                                <textarea
                                    value={topic}
                                    onChange={e => setTopic(e.target.value)}
                                    rows={3}
                                    placeholder="Let everyone know how to use this channel!"
                                    style={{
                                        width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical',
                                        fontFamily: 'inherit', boxSizing: 'border-box',
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Slowmode
                                </label>
                                <select
                                    value={slowmode}
                                    onChange={e => setSlowmode(Number(e.target.value))}
                                    style={{
                                        padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit',
                                        width: '100%', boxSizing: 'border-box',
                                    }}
                                >
                                    {SLOWMODE_OPTIONS.map(s => <option key={s} value={s}>{formatSlowmode(s)}</option>)}
                                </select>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '12px' }}>
                                <input type="checkbox" checked={nsfw} onChange={e => setNsfw(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                NSFW Channel
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '12px' }}>
                                <input type="checkbox" checked={isAnnouncement} onChange={e => setIsAnnouncement(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                Announcement Channel
                            </label>

                            {/* Disappearing Messages */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                                    Disappearing Messages
                                </label>
                                <select
                                    value={disappearTimer ?? 0}
                                    onChange={e => {
                                        const val = Number(e.target.value);
                                        const timer = val === 0 ? null : val;
                                        setDisappearTimer(timer);
                                        api.messages.setDisappearTimer(channelId, timer).catch(() => {});
                                    }}
                                    style={{
                                        padding: '8px 12px', background: 'var(--bg-primary)',
                                        border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit',
                                        width: '100%', boxSizing: 'border-box',
                                    }}
                                >
                                    <option value={0}>Off</option>
                                    <option value={300}>5 minutes</option>
                                    <option value={3600}>1 hour</option>
                                    <option value={86400}>24 hours</option>
                                    <option value={604800}>7 days</option>
                                    <option value={2592000}>30 days</option>
                                </select>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    {disappearTimer ? 'New messages will auto-delete after this time.' : 'Messages will not auto-delete.'}
                                </div>
                            </div>

                            {/* Slowmode Role Overrides (Item 27) */}
                            {slowmode > 0 && roles.length > 0 && (
                                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                        Slowmode Role Overrides
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        Trusted roles can have shorter cooldowns. Default: {formatSlowmode(slowmode)}.
                                    </div>
                                    {roles.slice(0, 5).map(role => (
                                        <div key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '12px', color: role.color || 'var(--text-secondary)', fontWeight: 600, width: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {role.name}
                                            </span>
                                            <select
                                                value={roleSlowmodeOverrides[role.id] ?? slowmode}
                                                onChange={e => setRoleSlowmodeOverrides(prev => ({ ...prev, [role.id]: Number(e.target.value) }))}
                                                style={{
                                                    flex: 1, padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                                    borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'inherit',
                                                }}
                                            >
                                                <option value={0}>No slowmode</option>
                                                {SLOWMODE_OPTIONS.filter(s => s > 0 && s <= slowmode).map(s => (
                                                    <option key={s} value={s}>{formatSlowmode(s)}</option>
                                                ))}
                                                <option value={slowmode}>Default ({formatSlowmode(slowmode)})</option>
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Channel Archive Toggle (Item 31) */}
                            {isArchived ? (
                                <div style={{ marginBottom: '24px', padding: '12px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.3)' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#60a5fa', marginBottom: '4px' }}>This channel is archived and read-only.</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                        Members can view messages but cannot send new ones.
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.channels.update(channelId, { archived: false });
                                                setIsArchived(false);
                                                addToast({ title: 'Channel unarchived', variant: 'success' });
                                                onClose();
                                            } catch {
                                                addToast({ title: 'Failed to unarchive', variant: 'error' });
                                            }
                                        }}
                                        style={{
                                            padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                                            background: '#3b82f6', border: 'none',
                                            color: 'white', fontSize: '12px', fontWeight: 600,
                                            cursor: 'pointer', fontFamily: 'inherit',
                                        }}
                                    >
                                        Unarchive Channel
                                    </button>
                                </div>
                            ) : (
                                <div style={{ marginBottom: '24px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                    {showArchiveConfirm ? (
                                        <div style={{ padding: '4px', background: 'rgba(234,179,8,0.08)', borderRadius: '6px' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#facc15', marginBottom: '4px' }}>Are you sure you want to archive this channel?</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                                                Members will be able to view but not send messages.
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await api.channels.update(channelId, { archived: true });
                                                            addToast({ title: 'Channel archived', variant: 'success' });
                                                            onClose();
                                                        } catch {
                                                            addToast({ title: 'Failed to archive', variant: 'error' });
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                                                        background: '#eab308', border: 'none',
                                                        color: '#000', fontSize: '12px', fontWeight: 600,
                                                        cursor: 'pointer', fontFamily: 'inherit',
                                                    }}
                                                >
                                                    Archive
                                                </button>
                                                <button
                                                    onClick={() => setShowArchiveConfirm(false)}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                                                        background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                                        color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                                                        cursor: 'pointer', fontFamily: 'inherit',
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Archive Channel</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    Archived channels are read-only. Members can view but not send messages.
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setShowArchiveConfirm(true)}
                                                style={{
                                                    padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                                                    background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                                    color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                                                    cursor: 'pointer', fontFamily: 'inherit',
                                                }}
                                            >
                                                Archive
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Auto-Archive After */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    Auto-Archive After
                                </label>
                                <select
                                    value={autoArchiveDays ?? 0}
                                    onChange={e => {
                                        const v = Number(e.target.value);
                                        setAutoArchiveDays(v === 0 ? null : v);
                                    }}
                                    style={{
                                        padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit',
                                        width: '100%', boxSizing: 'border-box',
                                    }}
                                >
                                    <option value={0}>Disabled</option>
                                    <option value={7}>7 days of inactivity</option>
                                    <option value={14}>14 days of inactivity</option>
                                    <option value={30}>30 days of inactivity</option>
                                    <option value={60}>60 days of inactivity</option>
                                    <option value={90}>90 days of inactivity</option>
                                </select>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Automatically archive this channel if no messages are sent for the specified period.
                                </div>
                            </div>

                            {isVoice && (
                                <>
                                    <div style={{ marginBottom: '24px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                            User Limit
                                        </label>
                                        <input
                                            type="number"
                                            value={userLimit}
                                            onChange={e => setUserLimit(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                                            min={0}
                                            max={99}
                                            style={{
                                                width: '120px', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                                fontFamily: 'inherit',
                                            }}
                                        />
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            0 = unlimited. Max 99 users.
                                        </div>
                                    </div>

                                    {parentId && (
                                        <div style={{ marginBottom: '24px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '4px' }}>
                                                <input type="checkbox" checked={permissionSynced} onChange={e => setPermissionSynced(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                                Sync Permissions with Category
                                            </label>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '24px' }}>
                                                When enabled, this channel inherits permission overrides from its parent category.
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {!isVoice && (
                                <>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '12px' }}>
                                        <input type="checkbox" checked={attachmentsEnabled} onChange={e => setAttachmentsEnabled(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                        Allow File Attachments
                                    </label>

                                    <div style={{ marginBottom: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '4px' }}>
                                            <input type="checkbox" checked={isEncrypted} onChange={e => setIsEncrypted(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                            Enable End-to-End Encryption
                                        </label>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '24px' }}>
                                            Existing messages won't be retroactively encrypted. New messages will be encrypted.
                                        </div>
                                    </div>

                                    {parentId && (
                                        <div style={{ marginBottom: '24px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '4px' }}>
                                                <input type="checkbox" checked={permissionSynced} onChange={e => setPermissionSynced(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                                Sync Permissions with Category
                                            </label>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '24px' }}>
                                                When enabled, this channel inherits permission overrides from its parent category.
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '10px 20px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: 500, fontFamily: 'inherit',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveOverview}
                                    disabled={saving}
                                    style={{
                                        padding: '10px 20px', background: saving ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none',
                                        borderRadius: '8px', color: saving ? 'var(--text-muted)' : 'white', cursor: saving ? 'default' : 'pointer',
                                        fontSize: '14px', fontWeight: 600, fontFamily: 'inherit',
                                    }}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'permissions' && (
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: 0, marginBottom: '16px' }}>Permissions</h2>

                            {/* View as role */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>
                                    View as Role
                                </label>
                                <select
                                    value={viewAsRole}
                                    onChange={e => setViewAsRole(e.target.value)}
                                    style={{
                                        padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit',
                                        width: '240px',
                                    }}
                                >
                                    <option value="">-- select role --</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>

                            {viewAsRole ? (
                                <div>
                                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                                        Effective permissions for {roles.find(r => r.id === viewAsRole)?.name}
                                    </h3>
                                    {computeEffectivePerms(viewAsRole).map(p => (
                                        <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '14px', color: p.allowed ? 'var(--success, #3ba55c)' : 'var(--error, #ed4245)' }}>
                                            {p.allowed ? <Check size={16} /> : <X size={16} />}
                                            <span>{p.label}</span>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setViewAsRole('')}
                                        style={{
                                            marginTop: '12px', padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                            borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
                                        }}
                                    >
                                        Back to Edit
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    {/* Permission legend */}
                                    <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12} color="var(--success)" /> Allow</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Minus size={12} /> Neutral</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><X size={12} color="var(--error)" /> Deny</span>
                                    </div>

                                    {/* Role list with expandable permission toggles */}
                                    {roles.map(role => (
                                        <div key={role.id} style={{ border: '1px solid var(--stroke)', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
                                            <div
                                                onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                                                style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '10px 12px', cursor: 'pointer',
                                                    background: expandedRole === role.id ? 'var(--bg-tertiary)' : 'transparent',
                                                    transition: 'background 0.1s',
                                                }}
                                            >
                                                <span style={{ fontWeight: 600, fontSize: '14px', color: role.color || 'var(--text-primary)' }}>{role.name}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{expandedRole === role.id ? '\u25B2' : '\u25BC'}</span>
                                            </div>
                                            {expandedRole === role.id && (
                                                <div style={{ padding: '8px 12px', borderTop: '1px solid var(--stroke)' }}>
                                                    {PERM_BITS.map(perm => {
                                                        const state = getPermState(role.id, perm.bit);
                                                        return (
                                                            <div key={perm.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                                                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{perm.label}</span>
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    {(['allow', 'neutral', 'deny'] as const).map(s => (
                                                                        <button
                                                                            key={s}
                                                                            onClick={() => {
                                                                                if (state !== s) {
                                                                                    // Cycle to desired state
                                                                                    // Need to set directly
                                                                                    setOverrides(prev => {
                                                                                        const existing = prev.find(o => o.targetId === role.id);
                                                                                        let allow = existing ? BigInt(existing.allow) : 0n;
                                                                                        let deny = existing ? BigInt(existing.deny) : 0n;
                                                                                        allow = allow & ~perm.bit;
                                                                                        deny = deny & ~perm.bit;
                                                                                        if (s === 'allow') allow = allow | perm.bit;
                                                                                        if (s === 'deny') deny = deny | perm.bit;
                                                                                        if (existing) {
                                                                                            return prev.map(o => o.targetId === role.id ? { ...o, allow: allow.toString(), deny: deny.toString() } : o);
                                                                                        }
                                                                                        return [...prev, { id: '', targetId: role.id, targetType: 'role', allow: allow.toString(), deny: deny.toString() }];
                                                                                    });
                                                                                }
                                                                            }}
                                                                            style={{
                                                                                width: '28px', height: '28px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                background: state === s
                                                                                    ? s === 'allow' ? 'rgba(34, 197, 94, 0.2)' : s === 'deny' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-tertiary)'
                                                                                    : 'var(--bg-elevated)',
                                                                                color: state === s
                                                                                    ? s === 'allow' ? 'var(--success)' : s === 'deny' ? 'var(--error)' : 'var(--text-muted)'
                                                                                    : 'var(--text-muted)',
                                                                                opacity: state === s ? 1 : 0.4,
                                                                                transition: 'all 0.15s',
                                                                            }}
                                                                            title={s.charAt(0).toUpperCase() + s.slice(1)}
                                                                        >
                                                                            {s === 'allow' ? <Check size={14} /> : s === 'deny' ? <X size={14} /> : <Minus size={14} />}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                        <button
                                                            onClick={() => savePermissions()}
                                                            disabled={permsSaving}
                                                            style={{
                                                                padding: '6px 14px', background: permsSaving ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none',
                                                                borderRadius: '6px', color: permsSaving ? 'var(--text-muted)' : 'white', cursor: permsSaving ? 'default' : 'pointer',
                                                                fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                                                            }}
                                                        >
                                                            {permsSaving ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    await api.channels.deletePermissionOverride(channelId, role.id);
                                                                    setOverrides(prev => prev.filter(o => o.targetId !== role.id));
                                                                    addToast({ title: 'Override reset', variant: 'info' });
                                                                } catch {
                                                                    addToast({ title: 'Failed to reset override', variant: 'error' });
                                                                }
                                                            }}
                                                            style={{
                                                                padding: '6px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                                                borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer',
                                                                fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
                                                            }}
                                                        >
                                                            Reset
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {roles.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading roles...</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChannelSettingsModal;
