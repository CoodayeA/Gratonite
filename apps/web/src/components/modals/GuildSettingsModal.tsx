import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Shield, Plus, Check, Search, ChevronDown, Trash2, Edit2, Ban, UserPlus, Hash, Mic, Settings, AlertTriangle, Clock, Save, Link2, Copy, RefreshCw, Bot, Power, Sliders, GripVertical, Upload, UserX, Lock, Eye, Type, ExternalLink, ArrowUp, ArrowDown, BookOpen, Activity } from 'lucide-react';
import { useToast } from '../ui/ToastManager';
import { useUser } from '../../contexts/UserContext';
import { api, API_BASE } from '../../lib/api';
import Avatar from '../ui/Avatar';
import { OnboardingFlowEditor } from '../guild/OnboardingFlowEditor';
import { NoCodeBotBuilder } from '../guild/NoCodeBotBuilder';
import { copyToClipboard } from '../../utils/clipboard';

interface Role {
    id: string;
    name: string;
    color: string;
    memberCount: number;
    permissions: Record<string, boolean>;
}

interface Member {
    id: string;
    name: string;
    avatar: string;
    roles: string[];
    status: 'online' | 'idle' | 'dnd' | 'offline';
    joinedAt: string;
}

interface AuditEntry {
    id: string;
    action: string;
    user: string;
    target: string;
    timestamp: string;
    rawTimestamp: string;
    type: 'role' | 'channel' | 'member' | 'settings' | 'message';
}

interface BannedUser {
    userId: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
    reason: string | null;
    bannedAt: string;
}

const permissionsList: { key: string; label: string; desc: string; category?: string }[] = [
    { key: 'administrator', label: 'Administrator', desc: 'Members with this permission have every permission and can bypass channel-specific overrides. This is a dangerous permission to grant.', category: 'advanced' },
    { key: 'manage_channels', label: 'Manage Channels', desc: 'Allows members to create, edit, or delete channels.', category: 'general' },
    { key: 'manage_roles', label: 'Manage Roles', desc: 'Allows members to create new roles and edit or delete roles lower than their highest role.', category: 'general' },
    { key: 'kick_members', label: 'Kick Members', desc: 'Allows members to remove other members from this server.', category: 'moderation' },
    { key: 'ban_members', label: 'Ban Members', desc: 'Allows members to permanently ban other members from this server.', category: 'moderation' },
    { key: 'manage_messages', label: 'Manage Messages', desc: 'Allows members to delete messages by other members or pin/unpin any message.', category: 'moderation' },
    { key: 'send_messages', label: 'Send Messages', desc: 'Allows members to send messages in text channels.', category: 'text' },
    { key: 'embed_links', label: 'Embed Links', desc: 'Allows links posted by this member to be auto-embedded.', category: 'text' },
    { key: 'attach_files', label: 'Attach Files', desc: 'Allows members to upload files or media.', category: 'text' },
    { key: 'connect', label: 'Connect to Voice', desc: 'Allows members to connect to voice channels.', category: 'voice' },
    { key: 'speak', label: 'Speak in Voice', desc: 'Allows members to talk in voice channels.', category: 'voice' },
    { key: 'mute_members', label: 'Mute Members', desc: 'Allows members to mute other members in voice channels.', category: 'voice' },
    { key: 'move_members', label: 'Move Members', desc: 'Allows members to move other members between voice channels.', category: 'voice' },
    { key: 'priority_speaker', label: 'Priority Speaker', desc: 'Allows using priority speaker in voice channels. Others will be heard at reduced volume.', category: 'voice' },
    { key: 'use_voice_activity', label: 'Use Voice Activity', desc: 'Allows members to use voice activity detection instead of push-to-talk.', category: 'voice' },
    { key: 'stream', label: 'Video/Screen Share', desc: 'Allows members to share video, screen share, or stream in voice channels.', category: 'voice' },
];

const defaultPermissions = (): Record<string, boolean> => {
    return Object.fromEntries(permissionsList.map(p => [p.key, false]));
};

// Convert an integer color (e.g. 0xf59e0b) to a hex string like '#f59e0b'
const colorIntToHex = (color: number | null | undefined): string => {
    if (!color) return '#71717a';
    return `#${color.toString(16).padStart(6, '0')}`;
};

// Convert a hex color string like '#f59e0b' to an integer
const colorHexToInt = (hex: string): number => {
    return parseInt(hex.replace('#', ''), 16);
};

// Convert a permissions bitmask integer into a Record<string, boolean> using permissionsList order
const permissionsIntToRecord = (bits: number | null | undefined): Record<string, boolean> => {
    const record: Record<string, boolean> = {};
    permissionsList.forEach((p, i) => {
        record[p.key] = bits != null ? ((bits >> i) & 1) === 1 : false;
    });
    return record;
};

// Convert a Record<string, boolean> back to a permissions bitmask integer
const permissionsRecordToInt = (record: Record<string, boolean>): number => {
    let bits = 0;
    permissionsList.forEach((p, i) => {
        if (record[p.key]) bits |= (1 << i);
    });
    return bits;
};

const accentColors = [
    { color: '#526df5', name: 'Gratonite Blue' },
    { color: '#8b5cf6', name: 'Purple' },
    { color: '#ec4899', name: 'Pink' },
    { color: '#10b981', name: 'Green' },
    { color: '#f59e0b', name: 'Amber' },
    { color: '#ef4444', name: 'Red' },
    { color: '#06b6d4', name: 'Cyan' },
    { color: '#84cc16', name: 'Lime' },
];

const VIEW_CHANNEL_BIT = 1n << 8n;

function CurrencyPanel({ guildId, addToast }: { guildId: string; addToast: (t: { title: string; variant: 'success' | 'error' | 'info' | 'achievement' | 'undo' }) => void }) {
    const [currencyEnabled, setCurrencyEnabled] = useState(false);
    const [currencyName, setCurrencyName] = useState('');
    const [currencyNameTouched, setCurrencyNameTouched] = useState(false);
    const [currencyEmoji, setCurrencyEmoji] = useState('\u{1F4B0}');
    const [currencyEarnMsg, setCurrencyEarnMsg] = useState(1);
    const [currencyEarnReact, setCurrencyEarnReact] = useState(1);
    const [currencyEarnVoice, setCurrencyEarnVoice] = useState(2);
    const [currencySaving, setCurrencySaving] = useState(false);
    const [currencyLeaderboard, setCurrencyLeaderboard] = useState<Array<{ userId: string; balance: number; lifetimeEarned: number }>>([]);

    useEffect(() => {
        api.get<any>(`/guilds/${guildId}/currency`).then((data: any) => {
            if (data.enabled) {
                setCurrencyEnabled(true);
                setCurrencyName(data.currency?.name ?? '');
                setCurrencyEmoji(data.currency?.emoji ?? '\u{1F4B0}');
                setCurrencyEarnMsg(data.currency?.earnPerMessage ?? 1);
                setCurrencyEarnReact(data.currency?.earnPerReaction ?? 1);
                setCurrencyEarnVoice(data.currency?.earnPerVoiceMinute ?? 2);
            } else {
                setCurrencyEnabled(false);
            }
        }).catch(() => { addToast({ title: 'Failed to load currency settings', variant: 'error' }); });
        api.get<any>(`/guilds/${guildId}/currency/leaderboard`).then((data: any) => {
            if (Array.isArray(data)) setCurrencyLeaderboard(data);
        }).catch(() => {});
    }, [guildId]);

    const saveCurrency = async () => {
        if (!currencyName.trim()) {
            addToast({ title: 'Currency name required', variant: 'error' });
            return;
        }
        setCurrencySaving(true);
        try {
            await api.post(`/guilds/${guildId}/currency`, {
                name: currencyName.trim(),
                emoji: currencyEmoji,
                earnPerMessage: currencyEarnMsg,
                earnPerReaction: currencyEarnReact,
                earnPerVoiceMinute: currencyEarnVoice,
            });
            setCurrencyEnabled(true);
            addToast({ title: 'Server currency saved', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to save currency', variant: 'error' });
        } finally {
            setCurrencySaving(false);
        }
    };

    const deleteCurrency = async () => {
        setCurrencySaving(true);
        try {
            await api.delete(`/guilds/${guildId}/currency`);
            setCurrencyEnabled(false);
            setCurrencyName('');
            setCurrencyEmoji('\u{1F4B0}');
            setCurrencyLeaderboard([]);
            addToast({ title: 'Server currency disabled', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to disable currency', variant: 'error' });
        } finally {
            setCurrencySaving(false);
        }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Server Currency</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Create a custom currency for your server. Members earn it by participating and can compete on the leaderboard.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Currency Name</label>
                        <input
                            type="text"
                            value={currencyName}
                            onChange={e => setCurrencyName(e.target.value)}
                            onBlur={() => setCurrencyNameTouched(true)}
                            placeholder="e.g. Server Coins"
                            maxLength={50}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${currencyNameTouched && !currencyName.trim() ? 'var(--error)' : 'var(--stroke)'}`, background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                        />
                        {currencyNameTouched && !currencyName.trim() && (
                            <div style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>Currency name is required</div>
                        )}
                    </div>
                    <div style={{ width: '80px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emoji</label>
                        <input
                            type="text"
                            value={currencyEmoji}
                            onChange={e => setCurrencyEmoji(e.target.value.slice(0, 4))}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '18px', textAlign: 'center', outline: 'none' }}
                        />
                    </div>
                </div>

                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--stroke)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>Earning Rules</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[
                            { label: 'Per Message', value: currencyEarnMsg, setter: setCurrencyEarnMsg },
                            { label: 'Per Reaction', value: currencyEarnReact, setter: setCurrencyEarnReact },
                            { label: 'Per Voice Minute', value: currencyEarnVoice, setter: setCurrencyEarnVoice },
                        ].map(({ label, value, setter }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={value}
                                        onChange={e => setter(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                                        style={{ width: '60px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'center', outline: 'none' }}
                                    />
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currencyEmoji}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={saveCurrency}
                        disabled={currencySaving || !currencyName.trim()}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                            background: 'var(--accent-primary)', color: '#000', fontWeight: 700,
                            cursor: currencySaving ? 'wait' : 'pointer', opacity: !currencyName.trim() ? 0.5 : 1,
                        }}
                    >
                        {currencySaving ? 'Saving...' : currencyEnabled ? 'Update Currency' : 'Enable Currency'}
                    </button>
                    {currencyEnabled && (
                        <button
                            onClick={deleteCurrency}
                            disabled={currencySaving}
                            style={{
                                padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--error)',
                                background: 'transparent', color: 'var(--error)', fontWeight: 600,
                                cursor: currencySaving ? 'wait' : 'pointer',
                            }}
                        >
                            Disable
                        </button>
                    )}
                </div>
            </div>

            {currencyEnabled && currencyLeaderboard.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Leaderboard</h3>
                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                        {currencyLeaderboard.map((entry, i) => (
                            <div key={entry.userId} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 16px',
                                borderBottom: i < currencyLeaderboard.length - 1 ? '1px solid var(--stroke)' : 'none',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--bg-primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '11px', fontWeight: 700, color: i < 3 ? '#111' : 'var(--text-muted)',
                                    }}>
                                        {i + 1}
                                    </span>
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {entry.userId.slice(0, 8)}...
                                    </span>
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                                    {entry.balance.toLocaleString()} {currencyEmoji}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {currencyEnabled && currencyLeaderboard.length === 0 && (
                <div style={{ marginTop: '24px', textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    <p style={{ fontWeight: 600, marginBottom: '4px' }}>No balances yet</p>
                    <p style={{ fontSize: '13px' }}>Members will start earning {currencyEmoji} {currencyName} as they chat and participate.</p>
                </div>
            )}
        </>
    );
}

const GuildSettingsModal = ({ onClose, guildId }: { onClose: () => void; guildId?: string | null }) => {
    const { addToast } = useToast();
    const { user: currentUser } = useUser();
    const navigate = useNavigate();
    const actorName = currentUser.name || currentUser.handle || 'Unknown';
    const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'roles' | 'members' | 'bans' | 'invites' | 'emojis' | 'automod' | 'audit' | 'branding' | 'webhooks' | 'bots' | 'templates' | 'insights' | 'onboarding' | 'wordfilter' | 'security' | 'import' | 'boosts' | 'welcome' | 'currency' | 'stickers' | 'rules' | 'discovery' | 'soundboard' | 'spam' | 'backups' | 'modqueue' | 'highlights'>('overview');
    const [roles, setRoles] = useState<Role[]>([]);
    const [activeRole, setActiveRole] = useState<Role | null>(null);
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [memberSearch, setMemberSearch] = useState('');
    const [auditFilter, setAuditFilter] = useState<string>('all');
    const [auditSearch, setAuditSearch] = useState('');
    const [auditDateFrom, setAuditDateFrom] = useState('');
    const [auditDateTo, setAuditDateTo] = useState('');
    const [serverName, setServerName] = useState('');
    const [serverDesc, setServerDesc] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [rulesChannelId, setRulesChannelId] = useState<string>('');
    const [rolesLoading, setRolesLoading] = useState(false);
    const [membersLoading, setMembersLoading] = useState(false);
    const [rolesSaving, setRolesSaving] = useState(false);
    const [deletingGuild, setDeletingGuild] = useState(false);

    // Confirmation dialog state for destructive actions
    const [confirmDialog, setConfirmDialog] = useState<{title: string; description: string; onConfirm: () => void} | null>(null);

    // Channels tab state
    const [channelsList, setChannelsList] = useState<Array<{ id: string; name: string; type: string; parentId: string | null; position: number; topic: string | null; restricted?: boolean }>>([]);
    const [channelsLoading, setChannelsLoading] = useState(false);
    const [dragChannelId, setDragChannelId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [showCreateCategory, setShowCreateCategory] = useState(false);
    const [showCreateChannelInSettings, setShowCreateChannelInSettings] = useState<{ parentId?: string | null } | null>(null);
    const [newChannelNameInSettings, setNewChannelNameInSettings] = useState('');
    const [newChannelTypeInSettings, setNewChannelTypeInSettings] = useState<'GUILD_TEXT' | 'GUILD_VOICE' | 'GUILD_FORUM' | 'GUILD_ANNOUNCEMENT' | 'GUILD_WIKI' | 'GUILD_QA' | 'GUILD_CONFESSION' | 'GUILD_TASK'>('GUILD_TEXT');
    const [tempChannelEnabled, setTempChannelEnabled] = useState(false);
    const [tempChannelDuration, setTempChannelDuration] = useState('3600');
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');

    const emitGuildUpdated = (detail?: { guildId?: string; iconHash?: string }) => {
        window.dispatchEvent(new CustomEvent('gratonite:guild-updated', { detail }));
    };

    // Fetch guild info (name, description, icon, banner, accent) on mount
    useEffect(() => {
        if (!guildId) return;
        api.guilds.get(guildId).then((g: any) => {
            if (g.ownerId) setGuildOwnerId(g.ownerId);
            if (g.name) setServerName(g.name);
            if (g.description) setServerDesc(g.description);
            setWelcomeMessage(g.welcomeMessage ?? '');
            setRulesChannelId(g.rulesChannelId ?? '');
            if (g.iconHash) {
                setAvatarUrl(`${API_BASE}/files/${g.iconHash}`);
            } else {
                setAvatarUrl('');
            }
            if (g.bannerHash) {
                const url = `${API_BASE}/files/${g.bannerHash}`;
                setBannerUrl(url);
                const isVid = url.endsWith('.mp4') || url.endsWith('.webm');
                setBannerIsVideo(isVid);
            } else {
                setBannerUrl('');
                setBannerIsVideo(false);
            }
            if (g.accentColor) {
                setSelectedAccentColor(g.accentColor);
            }
            if (g.category) setGuildCategory(g.category);
            if (Array.isArray(g.tags)) setGuildTags(g.tags);
            if (g.rulesText) setRulesText(g.rulesText);
            if (g.requireRulesAgreement) setRequireRulesAgreement(true);
            if (g.afkChannelId) setAfkChannelId(g.afkChannelId);
            if (g.afkTimeout != null) setAfkTimeout(g.afkTimeout);
            if (g.verificationLevel) setVerificationLevel(g.verificationLevel);
            if (g.systemChannelId) setSystemChannel(g.systemChannelId);
            if (g.systemMsgJoin != null) setSystemMsgJoin(g.systemMsgJoin);
            if (g.systemMsgBoost != null) setSystemMsgBoost(g.systemMsgBoost);
            if (g.memberScreeningEnabled) setMemberScreeningEnabled(true);
            if (g.boostCount != null) setBoostCount(g.boostCount);
            if (g.boostTier != null) setBoostTier(g.boostTier);
        }).catch(() => { addToast({ title: 'Failed to load boost stats', variant: 'error' }); });
    }, [guildId]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Fetch roles from API
    const fetchRoles = async () => {
        if (!guildId) return;
        setRolesLoading(true);
        try {
            const apiRoles = await api.guilds.getRoles(guildId) as any[];
            const mapped: Role[] = apiRoles
                .sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0))
                .map((r: any) => ({
                    id: r.id,
                    name: r.name,
                    color: colorIntToHex(r.color),
                    memberCount: r.memberCount ?? 0,
                    permissions: permissionsIntToRecord(r.permissions),
                }));
            setRoles(mapped);
            if (mapped.length > 0 && (!activeRole || !mapped.find(r => r.id === activeRole.id))) {
                setActiveRole(mapped[0]);
            }
        } catch {
            addToast({ title: 'Failed to load roles', variant: 'error' });
        } finally {
            setRolesLoading(false);
        }
    };

    // Fetch members from API
    const fetchMembers = async () => {
        if (!guildId) return;
        setMembersLoading(true);
        try {
            const apiMembers = await api.guilds.getMembers(guildId) as any[];
            const userIds = apiMembers.map((m: any) => m.userId);
            let userMap: Record<string, { username: string; displayName: string; avatarHash: string | null }> = {};
            let presenceMap: Record<string, string> = {};

            if (userIds.length > 0) {
                try {
                    const summaries = await api.users.getSummaries(userIds);
                    for (const s of summaries) {
                        userMap[s.id] = { username: s.username, displayName: s.displayName, avatarHash: s.avatarHash };
                    }
                } catch { /* summaries optional */ }

                try {
                    const presences = await api.users.getPresences(userIds);
                    for (const p of presences) {
                        presenceMap[p.userId] = p.status;
                    }
                } catch { /* presences optional */ }
            }

            // Fetch roles for each member
            const memberRolesMap: Record<string, string[]> = {};
            await Promise.allSettled(
                apiMembers.map(async (m: any) => {
                    try {
                        const mRoles = await api.guilds.getMemberRoles(guildId, m.userId) as any[];
                        memberRolesMap[m.userId] = mRoles.map((r: any) => r.name);
                    } catch {
                        memberRolesMap[m.userId] = [];
                    }
                })
            );

            const mapped: Member[] = apiMembers.map((m: any) => {
                const user = userMap[m.userId];
                const name = user?.displayName || user?.username || m.nickname || 'Unknown';
                const status = (presenceMap[m.userId] || 'offline') as Member['status'];
                const joinDate = m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
                return {
                    id: m.userId,
                    name,
                    avatar: name.charAt(0).toUpperCase(),
                    roles: memberRolesMap[m.userId] || [],
                    status: (['online', 'idle', 'dnd', 'offline'].includes(status) ? status : 'offline') as Member['status'],
                    joinedAt: joinDate,
                };
            });
            setMembers(mapped);
        } catch {
            addToast({ title: 'Failed to load members', variant: 'error' });
        } finally {
            setMembersLoading(false);
        }
    };

    // Fetch audit log from API
    const fetchAuditLog = async () => {
        if (!guildId) return;
        try {
            const result = await api.guilds.getAuditLog(guildId, { limit: 50 }) as any;
            const items = result?.items || result || [];
            const mapped: AuditEntry[] = (Array.isArray(items) ? items : []).map((entry: any, idx: number) => ({
                id: entry.id || `${entry.action || entry.actionType || 'audit'}:${entry.createdAt || entry.timestamp || 'unknown'}:${idx}`,
                action: entry.action || entry.actionType || 'Unknown',
                user: entry.userName || entry.user || 'System',
                target: entry.target || entry.targetName || '',
                timestamp: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : (entry.timestamp || ''),
                rawTimestamp: entry.createdAt || entry.timestamp || new Date().toISOString(),
                type: (entry.type || 'settings') as AuditEntry['type'],
            }));
            setAuditLog(mapped);
        } catch { /* audit log optional */ }
    };

    // Fetch channels for channels tab
    const fetchChannels = async () => {
        if (!guildId) return;
        setChannelsLoading(true);
        try {
            const chs = await api.channels.getGuildChannels(guildId) as any[];
            const dedupedChannels = Array.from(
                new Map(
                    chs.map((c: any) => {
                        const normalizedName = (c.name || '').toLowerCase();
                        const key = c.type === 'GUILD_CATEGORY' ? `${c.type}:${normalizedName}` : c.id;
                        return [key, c];
                    }),
                ).values(),
            );
            const mapped = dedupedChannels.map((c: any) => ({
                id: c.id,
                name: c.name,
                type: c.type,
                parentId: c.parentId ?? null,
                position: c.position ?? 0,
                topic: c.topic ?? null,
                restricted: false,
            }));

            const lockByChannelId = new Map<string, boolean>();
            await Promise.allSettled(
                mapped
                    .filter((c: any) => c.type !== 'GUILD_CATEGORY')
                    .map(async (c: any) => {
                        try {
                            const overrides = await api.channels.getPermissionOverrides(c.id);
                            const restricted = overrides.some((ov) => {
                                const deny = BigInt(ov.deny ?? '0');
                                return (deny & VIEW_CHANNEL_BIT) !== 0n;
                            });
                            lockByChannelId.set(c.id, restricted);
                        } catch {
                            lockByChannelId.set(c.id, false);
                        }
                    }),
            );

            setChannelsList(mapped.map((c: any) => ({ ...c, restricted: lockByChannelId.get(c.id) ?? false })));
        } catch {
            addToast({ title: 'Failed to load channels', variant: 'error' });
        } finally {
            setChannelsLoading(false);
        }
    };

    const handleCreateCategory = async () => {
        if (!guildId || !newCategoryName.trim()) return;
        const normalizedName = newCategoryName.trim().toLowerCase().replace(/\s+/g, '-');
        if (channelsList.some(c => c.type === 'GUILD_CATEGORY' && c.name === normalizedName)) {
            setNewCategoryName('');
            setShowCreateCategory(false);
            addToast({ title: 'Category already exists', variant: 'info' });
            return;
        }
        try {
            await api.channels.create(guildId, {
                name: normalizedName,
                type: 'GUILD_CATEGORY',
            });
            setNewCategoryName('');
            setShowCreateCategory(false);
            fetchChannels();
            addToast({ title: 'Category Created', variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Failed to create category', description: err?.message, variant: 'error' });
        }
    };

    const handleCreateChannelInSettings = async () => {
        if (!guildId || !newChannelNameInSettings.trim() || !showCreateChannelInSettings) return;
        try {
            await api.channels.create(guildId, {
                name: newChannelNameInSettings.trim().toLowerCase().replace(/\s+/g, '-'),
                type: newChannelTypeInSettings,
                parentId: showCreateChannelInSettings.parentId ?? undefined,
                ...(tempChannelEnabled ? { temporary: true, temporaryDuration: tempChannelDuration === 'empty' ? 'empty' : Number(tempChannelDuration) } : {}),
            } as any);
            setNewChannelNameInSettings('');
            setShowCreateChannelInSettings(null);
            setNewChannelTypeInSettings('GUILD_TEXT');
            setTempChannelEnabled(false);
            setTempChannelDuration('3600');
            fetchChannels();
            addToast({ title: 'Channel Created', variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Failed to create channel', description: err?.message, variant: 'error' });
        }
    };

    const handleDeleteChannel = async (channelId: string) => {
        if (!guildId) return;
        try {
            await api.channels.delete(channelId);
            fetchChannels();
            // Also trigger sidebar refresh in case socket event is delayed
            window.dispatchEvent(new CustomEvent('gratonite:channel-deleted', { detail: { channelId, guildId } }));
            addToast({ title: 'Channel Deleted', variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Failed to delete channel', description: err?.message, variant: 'error' });
        }
    };

    const handleRenameCategory = async (categoryId: string) => {
        if (!editingCategoryName.trim()) return;
        try {
            await api.channels.update(categoryId, { name: editingCategoryName.trim().toLowerCase().replace(/\s+/g, '-') });
            setEditingCategoryId(null);
            setEditingCategoryName('');
            fetchChannels();
            addToast({ title: 'Category Renamed', variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Failed to rename category', description: err?.message, variant: 'error' });
        }
    };

    const handleChannelDragStart = (channelId: string) => {
        setDragChannelId(channelId);
    };

    const handleChannelDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        setDragOverId(targetId);
    };

    const handleChannelDrop = async (targetId: string) => {
        if (!guildId || !dragChannelId || dragChannelId === targetId) {
            setDragChannelId(null);
            setDragOverId(null);
            return;
        }

        const draggedCh = channelsList.find(c => c.id === dragChannelId);
        const targetCh = channelsList.find(c => c.id === targetId);
        if (!draggedCh || !targetCh) { setDragChannelId(null); setDragOverId(null); return; }

        // If dropping onto a category, move the channel into that category
        // If dropping onto another channel, swap positions
        const newList = [...channelsList];

        if (targetCh.type === 'GUILD_CATEGORY' && draggedCh.type !== 'GUILD_CATEGORY') {
            // Move channel into this category
            const idx = newList.findIndex(c => c.id === dragChannelId);
            newList[idx] = { ...newList[idx], parentId: targetId };
        } else {
            // Swap positions
            const dragIdx = newList.findIndex(c => c.id === dragChannelId);
            const targetIdx = newList.findIndex(c => c.id === targetId);
            const dragPos = newList[dragIdx].position;
            newList[dragIdx] = { ...newList[dragIdx], position: newList[targetIdx].position, parentId: targetCh.parentId };
            newList[targetIdx] = { ...newList[targetIdx], position: dragPos };
        }

        setChannelsList(newList);
        setDragChannelId(null);
        setDragOverId(null);

        // Save to server
        try {
            await api.channels.updatePositions(
                guildId,
                newList.map(c => ({ id: c.id, position: c.position, parentId: c.parentId }))
            );
        } catch {
            addToast({ title: 'Failed to update positions', variant: 'error' });
            fetchChannels(); // revert
        }
    };

    // Load data on mount and when tabs change
    useEffect(() => {
        if (!guildId) return;
        fetchRoles();
        fetchMembers();
        fetchAuditLog();
    }, [guildId]);

    // Bans state
    const [bans, setBans] = useState<BannedUser[]>([]);
    const [bansLoading, setBansLoading] = useState(false);

    const fetchBans = async () => {
        if (!guildId) return;
        setBansLoading(true);
        try {
            const apiBans = await api.guilds.getBans(guildId) as any[];
            const userIds = apiBans.map((b: any) => b.userId).filter(Boolean);
            let userMap: Record<string, { username: string; displayName: string; avatarHash: string | null }> = {};
            if (userIds.length > 0) {
                try {
                    const summaries = await api.users.getSummaries(userIds);
                    for (const s of summaries) {
                        userMap[s.id] = { username: s.username, displayName: s.displayName, avatarHash: s.avatarHash };
                    }
                } catch { /* summaries optional */ }
            }
            const mapped: BannedUser[] = apiBans.map((b: any) => {
                const user = userMap[b.userId];
                return {
                    userId: b.userId,
                    username: user?.username || b.userId?.slice(0, 8) || 'Unknown',
                    displayName: user?.displayName || user?.username || 'Unknown',
                    avatarHash: user?.avatarHash || null,
                    reason: b.reason || null,
                    bannedAt: b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown',
                };
            });
            setBans(mapped);
        } catch {
            addToast({ title: 'Failed to load bans', variant: 'error' });
        } finally {
            setBansLoading(false);
        }
    };

    const handleUnban = async (userId: string) => {
        if (!guildId) return;
        const banned = bans.find(b => b.userId === userId);
        try {
            await api.guilds.unban(guildId, userId);
            setBans(prev => prev.filter(b => b.userId !== userId));
            if (banned) {
                addAuditEntry('Member Unbanned', actorName, banned.displayName, 'member');
                addToast({ title: 'User unbanned', description: `${banned.displayName} can now rejoin the server.`, variant: 'success' });
            }
        } catch {
            addToast({ title: 'Failed to unban user', variant: 'error' });
        }
    };

    const fetchWebhooks = async () => {
        if (!guildId) return;
        try {
            const whs = await api.webhooks.listByGuild(guildId);
            const mapped = whs.map((wh: any) => {
                const ch = channelsList.find(c => c.id === wh.channelId);
                return {
                    id: wh.id,
                    name: wh.name,
                    channel: ch ? `#${ch.name}` : '#unknown',
                    channelId: wh.channelId,
                    token: wh.token,
                    avatar: '#526df5',
                    createdAt: wh.createdAt ? new Date(wh.createdAt).toLocaleDateString() : 'Unknown',
                };
            });
            setWebhooksList(mapped);
        } catch {
            // silent
        }
    };

    const fetchAutomodRules = async () => {
        if (!guildId) return;
        try {
            const wfs = await api.workflows.list(guildId);
            const automodWfs = wfs.filter((wf: any) =>
                wf.triggers?.some((t: any) => t.type === 'message_contains')
            );
            const rules = automodWfs.map((wf: any) => {
                const trigger = wf.triggers?.find((t: any) => t.type === 'message_contains');
                const keywords: string[] = trigger?.config?.keywords || [];
                const action = wf.actions?.[0]?.type || 'delete_message';
                return {
                    id: wf.id,
                    workflowId: wf.id,
                    name: wf.name,
                    desc: `Keywords: ${keywords.join(', ') || 'none'}`,
                    enabled: wf.enabled,
                    action: action === 'delete_message' ? 'Delete Message' : action,
                    isBuiltIn: false,
                    keywords,
                };
            });
            setAutomodRules(rules);
        } catch {
            // silent — workflows API may not be available
        }
    };

    useEffect(() => {
        if (activeTab === 'overview' || activeTab === 'channels' || activeTab === 'webhooks') fetchChannels();
        if (activeTab === 'roles') fetchRoles();
        if (activeTab === 'members') { fetchMembers(); setSelectedMemberIds(new Set()); }
        if (activeTab === 'invites') fetchInvites();
        if (activeTab === 'wordfilter' && guildId) {
            if (roles.length === 0) fetchRoles();
            api.get<any>(`/guilds/${guildId}/word-filter`).then((data: any) => {
                setWordFilterWords(Array.isArray(data.words) ? data.words : []);
                setWordFilterAction(data.action || 'block');
                setWordFilterExemptRoles(Array.isArray(data.exemptRoles) ? data.exemptRoles : []);
                setWordFilterRegexPatterns(Array.isArray(data.regexPatterns) ? data.regexPatterns : []);
            }).catch(() => {});
        }
        if (activeTab === 'security' && guildId) {
            api.guilds.get(guildId).then((g: any) => {
                setRaidProtectionEnabled(!!g.raidProtectionEnabled);
                setPublicStatsEnabled(!!g.publicStatsEnabled);
                setGuildLocked(!!g.lockedAt);
                const d = g.defaultMemberNotificationLevel;
                setDefaultMemberNotificationLevel(
                    d === 'all' || d === 'mentions' || d === 'nothing' ? d : null,
                );
            }).catch(() => {});
        }
        if (activeTab === 'bans') {
            fetchBans();
            if (guildId) {
                setAppealsLoading(true);
                api.get<any[]>(`/guilds/${guildId}/bans/appeals`).then((data: any) => {
                    setBanAppeals(Array.isArray(data) ? data : []);
                }).catch(() => setBanAppeals([])).finally(() => setAppealsLoading(false));
            }
        }
        if (activeTab === 'audit') fetchAuditLog();
        if (activeTab === 'webhooks') fetchWebhooks();
        if (activeTab === 'automod') fetchAutomodRules();
        if (activeTab === 'bots' && guildId) {
            api.get<any[]>(`/guilds/${guildId}/bots`).then((data: any) => {
                const bots = Array.isArray(data) ? data : [];
                setInstalledBots(bots.map((b: any) => ({
                    id: b.id,
                    name: b.name || 'Unknown Bot',
                    prefix: b.prefix || '!',
                    status: b.status || 'active',
                    avatar: b.avatarColor || '#526df5',
                    installedAt: b.installedAt ? new Date(b.installedAt).toLocaleDateString() : 'Unknown',
                    commands: b.commands ?? 0,
                })));
            }).catch(() => { /* bots endpoint may not exist yet */ });
        }
        if (activeTab === 'overview' && guildId) {
            setVanityLoading(true);
            api.guilds.getVanityUrl?.(guildId)?.then?.((data: any) => {
                setVanityCode(data?.code || '');
            }).catch(() => {}).finally(() => setVanityLoading(false));
        }
        if (activeTab === 'templates' && guildId) {
            setTemplatesLoading(true);
            api.guilds.getTemplates?.(guildId)?.then?.((data: any[]) => {
                setTemplates(Array.isArray(data) ? data.map((t: any) => ({
                    id: t.id,
                    name: t.name || 'Untitled',
                    description: t.description || '',
                    code: t.code || t.id,
                    createdAt: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Unknown',
                })) : []);
            }).catch(() => {}).finally(() => setTemplatesLoading(false));
        }
    }, [activeTab]);
    const [editingRoleName, setEditingRoleName] = useState(false);
    const [editRoleNameVal, setEditRoleNameVal] = useState('');
    const [editRoleColorVal, setEditRoleColorVal] = useState('');
    const [editRoleEmojiVal, setEditRoleEmojiVal] = useState('');
    const [savedIndicator, setSavedIndicator] = useState(false);
    const [kickConfirm, setKickConfirm] = useState<string | null>(null);
    const [selectedAccentColor, setSelectedAccentColor] = useState('#526df5');
    const [guildCategory, setGuildCategory] = useState<string>('');
    const [guildTags, setGuildTags] = useState<string[]>([]);
    const [rulesText, setRulesText] = useState('');
    const [requireRulesAgreement, setRequireRulesAgreement] = useState(false);
    const [banAppeals, setBanAppeals] = useState<Array<{ userId: string; username: string; displayName: string; avatarHash: string | null; text: string; status: string; createdAt: string }>>([]);
    const [appealsLoading, setAppealsLoading] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [assignRoleFor, setAssignRoleFor] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<string | null>(null);
    const [editRuleName, setEditRuleName] = useState('');
    const [editRuleAction, setEditRuleAction] = useState('');
    const [editRuleKeywords, setEditRuleKeywords] = useState('');
    const [customEmojis, setCustomEmojis] = useState<Array<{ id?: string; name: string; url: string; categoryId?: string | null }>>([]);
    const [emojiUploading, setEmojiUploading] = useState(false);
    const [emojiNameInput, setEmojiNameInput] = useState('');
    const [emojiFileToUpload, setEmojiFileToUpload] = useState<File | null>(null);
    const [emojiFilePreview, setEmojiFilePreview] = useState<string | null>(null);
    const [emojiCategories, setEmojiCategories] = useState<Array<{ id: string; name: string; sortOrder: number }>>([]);
    const [newCatName, setNewCatName] = useState('');
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [editingCatName, setEditingCatName] = useState('');
    const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('all');

    // Vanity URL state
    const [vanityCode, setVanityCode] = useState('');
    const [vanityLoading, setVanityLoading] = useState(false);
    const [vanitySaving, setVanitySaving] = useState(false);

    // Templates state
    const [templates, setTemplates] = useState<Array<{ id: string; name: string; description: string; code: string; createdAt: string }>>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDesc, setNewTemplateDesc] = useState('');
    const [templateCreating, setTemplateCreating] = useState(false);

    // Invite management state
    const [invites, setInvites] = useState<Array<{ code: string; inviterName: string; uses: number; maxUses: number | null; expiresAt: string | null; createdAt: string }>>([]);
    const [invitesLoading, setInvitesLoading] = useState(false);
    const [inviteRevoking, setInviteRevoking] = useState<string | null>(null);

    // Fetch invites from API
    const fetchInvites = async () => {
        if (!guildId) return;
        setInvitesLoading(true);
        try {
            const apiInvites = await api.invites.list(guildId) as any[];
            const mapped = (Array.isArray(apiInvites) ? apiInvites : []).map((inv: any) => ({
                code: inv.code,
                inviterName: inv.inviter?.displayName || inv.inviter?.username || 'Unknown',
                uses: inv.uses ?? 0,
                maxUses: inv.maxUses ?? null,
                expiresAt: inv.expiresAt ?? null,
                createdAt: inv.createdAt ?? '',
            }));
            setInvites(mapped);
        } catch {
            addToast({ title: 'Failed to load invites', variant: 'error' });
        } finally {
            setInvitesLoading(false);
        }
    };

    const handleRevokeInvite = async (code: string) => {
        setInviteRevoking(code);
        try {
            await api.invites.delete(code);
            setInvites(prev => prev.filter(i => i.code !== code));
            addToast({ title: 'Invite revoked', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to revoke invite', variant: 'error' });
        } finally {
            setInviteRevoking(null);
        }
    };

    // Fetch real server emojis and categories
    useEffect(() => {
        if (!guildId) return;
        api.guilds.getEmojis(guildId).then((emojis: any[]) => {
            setCustomEmojis(emojis.map((e: any) => ({
                id: e.id,
                name: e.name,
                url: e.imageHash ? `${API_BASE}/files/${e.imageHash}` : `https://placehold.co/32/526df5/FFF?text=${e.name.charAt(0).toUpperCase()}`,
                categoryId: e.categoryId || null,
            })));
        }).catch(() => { addToast({ title: 'Failed to load server emojis', variant: 'error' }); });
        api.guilds.getEmojiCategories(guildId).then(setEmojiCategories).catch(() => { addToast({ title: 'Failed to load emoji categories', variant: 'error' }); });
    }, [guildId]);

    const validateEmojiFile = (file: File): string | null => {
        const maxSize = 256 * 1024; // 256KB
        const allowedTypes = ['image/png', 'image/gif', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) return 'File must be PNG, GIF, or JPG.';
        if (file.size > maxSize) return `File is too large (${(file.size / 1024).toFixed(0)}KB). Max is 256KB.`;
        return null;
    };

    const validateEmojiName = (name: string): string | null => {
        if (name.length < 2) return 'Name must be at least 2 characters.';
        if (!/^[a-zA-Z0-9_]+$/.test(name)) return 'Name must be alphanumeric (letters, numbers, underscores only).';
        if (customEmojis.some(e => e.name.toLowerCase() === name.toLowerCase())) return 'An emoji with this name already exists.';
        return null;
    };

    const handleEmojiFileSelect = (file: File) => {
        const error = validateEmojiFile(file);
        if (error) {
            addToast({ title: 'Invalid file', description: error, variant: 'error' });
            return;
        }
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        setEmojiFileToUpload(file);
        setEmojiNameInput(name);
        setEmojiFilePreview(URL.createObjectURL(file));
    };

    const handleUploadEmoji = async () => {
        if (!guildId || !emojiFileToUpload || !emojiNameInput.trim()) return;
        const nameError = validateEmojiName(emojiNameInput.trim());
        if (nameError) {
            addToast({ title: 'Invalid name', description: nameError, variant: 'error' });
            return;
        }
        if (customEmojis.length >= 50) {
            addToast({ title: 'Emoji limit reached', description: 'You can have up to 50 custom emojis per server.', variant: 'error' });
            return;
        }
        setEmojiUploading(true);
        try {
            const emoji = await api.guilds.createEmoji(guildId, { name: emojiNameInput.trim(), file: emojiFileToUpload });
            setCustomEmojis(prev => [...prev, {
                id: (emoji as any).id,
                name: (emoji as any).name,
                url: (emoji as any).imageHash ? `${API_BASE}/files/${(emoji as any).imageHash}` : emojiFilePreview || '',
            }]);
            addToast({ title: 'Emoji uploaded!', description: `:${emojiNameInput.trim()}: is now available.`, variant: 'success' });
            setEmojiFileToUpload(null);
            setEmojiNameInput('');
            setEmojiFilePreview(null);
        } catch (err: any) {
            addToast({ title: 'Upload failed', description: err?.message || 'Could not upload emoji.', variant: 'error' });
        } finally {
            setEmojiUploading(false);
        }
    };

    const handleDeleteEmoji = async (emojiId: string | undefined, emojiName: string) => {
        if (!guildId || !emojiId) {
            setCustomEmojis(prev => prev.filter(e => e.name !== emojiName));
            return;
        }
        try {
            await api.guilds.deleteEmoji(guildId, emojiId);
            setCustomEmojis(prev => prev.filter(e => e.id !== emojiId));
            addToast({ title: 'Emoji deleted', description: `:${emojiName}: has been removed.`, variant: 'info' });
        } catch (err: any) {
            addToast({ title: 'Delete failed', description: err?.message || 'Could not delete emoji.', variant: 'error' });
        }
    };

    // Word filter state
    const [wordFilterWords, setWordFilterWords] = useState<string[]>([]);
    const [wordFilterAction, setWordFilterAction] = useState<'block' | 'delete' | 'warn'>('block');
    const [wordFilterExemptRoles, setWordFilterExemptRoles] = useState<string[]>([]);
    const [wordFilterInput, setWordFilterInput] = useState('');
    const [wordFilterSaving, setWordFilterSaving] = useState(false);
    const [wordFilterRegexPatterns, setWordFilterRegexPatterns] = useState<string[]>([]);
    const [wordFilterRegexInput, setWordFilterRegexInput] = useState('');
    const [wordFilterTestInput, setWordFilterTestInput] = useState('');
    const [wordFilterTestResult, setWordFilterTestResult] = useState<any>(null);

    // Raid protection state
    const [raidProtectionEnabled, setRaidProtectionEnabled] = useState(false);
    const [guildLocked, setGuildLocked] = useState(false);
    const [raidSaving, setRaidSaving] = useState(false);
    const [publicStatsEnabled, setPublicStatsEnabled] = useState(false);
    const [publicStatsSaving, setPublicStatsSaving] = useState(false);
    const [defaultMemberNotificationLevel, setDefaultMemberNotificationLevel] = useState<'all' | 'mentions' | 'nothing' | null>(null);
    const [defaultNotifSaving, setDefaultNotifSaving] = useState(false);
    const [memberScreeningEnabled, setMemberScreeningEnabled] = useState(false);
    const [boostCount, setBoostCount] = useState(0);
    const [boostTier, setBoostTier] = useState(0);

    // Welcome screen builder state
    type WelcomeBlockType = 'message' | 'channels' | 'rules' | 'links';
    interface WelcomeBlock {
        id: string;
        type: WelcomeBlockType;
        enabled: boolean;
        data: Record<string, any>;
    }
    const WELCOME_STORAGE_KEY = 'gratonite-welcome-config';
    const loadWelcomeBlocks = (gid: string): WelcomeBlock[] => {
        try {
            const raw = localStorage.getItem(WELCOME_STORAGE_KEY);
            if (raw) {
                const all = JSON.parse(raw);
                if (all[gid]) return all[gid];
            }
        } catch { /* ignore */ }
        return [
            { id: 'msg', type: 'message', enabled: true, data: { text: '' } },
            { id: 'ch', type: 'channels', enabled: true, data: { channelIds: [] } },
            { id: 'rules', type: 'rules', enabled: false, data: { summary: '' } },
            { id: 'links', type: 'links', enabled: false, data: { items: [] } },
        ];
    };
    const saveWelcomeBlocks = (gid: string, blocks: WelcomeBlock[]) => {
        try {
            const raw = localStorage.getItem(WELCOME_STORAGE_KEY);
            const all = raw ? JSON.parse(raw) : {};
            all[gid] = blocks;
            localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify(all));
        } catch { /* ignore */ }
        // Also persist to API (fire-and-forget)
        try {
            const apiBlocks = blocks.filter(b => b.enabled).map(b => ({
                type: b.type === 'message' ? 'welcome_message' : b.type,
                title: b.data?.title || (b.type === 'message' ? 'Welcome' : b.type === 'channels' ? 'Recommended Channels' : b.type === 'rules' ? 'Rules' : 'Links'),
                content: b.data?.text || b.data?.summary,
                channelIds: b.data?.channelIds,
                links: b.data?.items,
            }));
            api.welcomeScreen.update(gid, { blocks: apiBlocks }).catch(() => {});
        } catch { /* ignore */ }
    };
    const [welcomeBlocks, setWelcomeBlocks] = useState<WelcomeBlock[]>(() => guildId ? loadWelcomeBlocks(guildId) : []);
    const [welcomeEnabled, setWelcomeEnabled] = useState(() => {
        try {
            const raw = localStorage.getItem(WELCOME_STORAGE_KEY);
            if (raw && guildId) {
                const all = JSON.parse(raw);
                return all[`${guildId}_enabled`] !== false;
            }
        } catch { /* ignore */ }
        return true;
    });
    const [welcomePreview, setWelcomePreview] = useState(false);
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

    // Batch moderation state
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [bulkActionConfirm, setBulkActionConfirm] = useState<'kick' | 'ban' | 'timeout' | null>(null);

    const [automodRules, setAutomodRules] = useState<{ id: string; name: string; desc: string; enabled: boolean; action: string; isBuiltIn: boolean; workflowId?: string; keywords?: string[] }[]>([]);

    const [webhooksList, setWebhooksList] = useState<{ id: string; name: string; channel: string; channelId: string; token: string; avatar: string; createdAt: string }[]>([]);
    const [newWebhookName, setNewWebhookName] = useState('');
    const [newWebhookChannel, setNewWebhookChannel] = useState('');
    const [showCreateWebhook, setShowCreateWebhook] = useState(false);
    const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null);
    const [webhookCreating, setWebhookCreating] = useState(false);
    const [viewDeliveriesId, setViewDeliveriesId] = useState<string | null>(null);
    const [deliveryLogs, setDeliveryLogs] = useState<Array<{ id: string; eventType: string; responseStatus: number | null; success: boolean; durationMs: number | null; attemptedAt: string }>>([]);

    const [installedBots, setInstalledBots] = useState<{ id: string; name: string; prefix: string; status: string; avatar: string; installedAt: string; commands: number }[]>([]);

    const bannerInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const emojiInputRef = useRef<HTMLInputElement>(null);
    const [bannerUrl, setBannerUrl] = useState('');
    const [bannerIsVideo, setBannerIsVideo] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState('');
    const [verificationLevel, setVerificationLevel] = useState<'none' | 'low' | 'medium' | 'high' | 'highest'>('medium');
    const [systemChannel, setSystemChannel] = useState('welcome');
    const [systemMsgJoin, setSystemMsgJoin] = useState(true);
    const [systemMsgBoost, setSystemMsgBoost] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');
    const [guildOwnerId, setGuildOwnerId] = useState('');
    const [afkChannelId, setAfkChannelId] = useState<string>('');
    const [afkTimeout, setAfkTimeout] = useState<number>(300);
    const [adminWarning, setAdminWarning] = useState<string | null>(null);
    const [draggedRole, setDraggedRole] = useState<string | null>(null);
    const [dragOverRole, setDragOverRole] = useState<string | null>(null);

    const addAuditEntry = (action: string, user: string, target: string, type: AuditEntry['type']) => {
        const entry: AuditEntry = { id: Date.now().toString(), action, user, target, timestamp: 'just now', rawTimestamp: new Date().toISOString(), type };
        setAuditLog(prev => [entry, ...prev]);
    };

    const togglePermission = async (roleId: string, permKey: string) => {
        const role = roles.find(r => r.id === roleId);
        if (!role || !guildId) return;
        const newPerms = { ...role.permissions, [permKey]: !role.permissions[permKey] };
        const updated = { ...role, permissions: newPerms };
        // Optimistic update
        setRoles(prev => prev.map(r => r.id === roleId ? updated : r));
        if (activeRole?.id === roleId) setActiveRole(updated);
        try {
            await api.guilds.updateRole(guildId, roleId, { permissions: String(permissionsRecordToInt(newPerms)) });
        } catch {
            // Revert on failure
            setRoles(prev => prev.map(r => r.id === roleId ? role : r));
            if (activeRole?.id === roleId) setActiveRole(role);
            addToast({ title: 'Failed to update permission', variant: 'error' });
        }
    };

    const saveRoleEdit = async () => {
        if (!activeRole || !guildId) return;
        setRolesSaving(true);
        const newName = editRoleNameVal || activeRole.name;
        const newColor = editRoleColorVal || activeRole.color || null;
        try {
            await api.guilds.updateRole(guildId, activeRole.id, {
                name: newName,
                ...(newColor ? { color: newColor } : {}),
                ...(editRoleEmojiVal !== undefined ? { unicodeEmoji: editRoleEmojiVal || null } : {}),
            });
            setRoles(prev => prev.map(r => {
                if (r.id === activeRole.id) {
                    const updated = { ...r, name: newName, color: newColor || '' };
                    setActiveRole(updated);
                    return updated;
                }
                return r;
            }));
            addToast({ title: 'Role updated', variant: 'success' });
            addAuditEntry('Role Updated', actorName, `${newName} (name/color changed)`, 'role');
        } catch {
            addToast({ title: 'Failed to update role', variant: 'error' });
        } finally {
            setRolesSaving(false);
            setEditingRoleName(false);
        }
    };

    const toggleAutomodRule = async (ruleId: string) => {
        const rule = automodRules.find(r => r.id === ruleId);
        if (!rule || !guildId) return;
        const newEnabled = !rule.enabled;
        setAutomodRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: newEnabled } : r));
        addAuditEntry(newEnabled ? 'AutoMod Rule Enabled' : 'AutoMod Rule Disabled', actorName, rule.name, 'settings');
        try {
            await api.workflows.update(guildId, ruleId, { enabled: newEnabled });
        } catch {
            setAutomodRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled: !newEnabled } : r));
        }
    };

    const saveRuleEdit = async (ruleId: string) => {
        if (!guildId) return;
        const rule = automodRules.find(r => r.id === ruleId);
        if (!rule) return;
        const newName = editRuleName || rule.name;
        const newAction = editRuleAction || rule.action;
        const keywords = editRuleKeywords.split(',').map(k => k.trim()).filter(Boolean);
        setAutomodRules(prev => prev.map(r =>
            r.id === ruleId ? { ...r, name: newName, action: newAction, keywords, desc: `Keywords: ${keywords.join(', ') || 'none'}` } : r
        ));
        setEditingRule(null);
        try {
            const actionType = newAction === 'Delete Message' ? 'delete_message' : newAction;
            await api.workflows.update(guildId, ruleId, {
                name: newName,
                triggers: [{ type: 'message_contains', config: { keywords } }],
                actions: [{ order: 0, type: actionType }],
            });
        } catch {
            addToast({ title: 'Failed to save automod rule', variant: 'error' });
            setAutomodRules(prev => prev.map(r =>
                r.id === ruleId ? { ...r, name: rule.name, action: rule.action, keywords: rule.keywords, desc: rule.desc } : r
            ));
        }
    };

    const kickMember = async (memberId: string) => {
        if (!guildId) return;
        const member = members.find(m => m.id === memberId);
        try {
            await api.guilds.kickMember(guildId, memberId);
            setMembers(prev => prev.filter(m => m.id !== memberId));
            if (member) {
                addAuditEntry('Member Kicked', actorName, member.name, 'member');
                addToast({ title: 'Member kicked', description: `${member.name} has been removed from the server.`, variant: 'success' });
            }
        } catch {
            addToast({ title: 'Failed to kick member', variant: 'error' });
        }
        setKickConfirm(null);
    };

    const assignRole = async (memberId: string, roleName: string) => {
        if (!guildId) return;
        const role = roles.find(r => r.name === roleName);
        const member = members.find(m => m.id === memberId);
        if (!role) { setAssignRoleFor(null); return; }

        try {
            // Remove existing roles first, then assign new one
            if (member) {
                for (const existingRoleName of member.roles) {
                    const existingRole = roles.find(r => r.name === existingRoleName);
                    if (existingRole) {
                        await api.guilds.removeMemberRole(guildId, memberId, existingRole.id).catch(() => {});
                    }
                }
            }
            await api.guilds.assignMemberRole(guildId, memberId, role.id);
            setMembers(prev => prev.map(m => m.id === memberId ? { ...m, roles: [roleName] } : m));
            if (member) {
                addAuditEntry('Role Assigned', actorName, `${member.name} → ${roleName}`, 'role');
                addToast({ title: 'Role assigned', description: `${member.name} is now ${roleName}.`, variant: 'success' });
            }
        } catch {
            addToast({ title: 'Failed to assign role', variant: 'error' });
        }
        setAssignRoleFor(null);
    };

    const saveOverview = async () => {
        if (!guildId) return;
        try {
            await api.guilds.update(guildId, {
                name: serverName,
                description: serverDesc,
                welcomeMessage: welcomeMessage || null,
                rulesChannelId: rulesChannelId || null,
                category: guildCategory || null,
                tags: guildTags,
                rulesText: rulesText || null,
                requireRulesAgreement,
                verificationLevel,
                systemChannelId: systemChannel || null,
                systemMsgJoin,
                systemMsgBoost,
            } as any);
            addAuditEntry('Portal Settings Changed', actorName, `Name/Description updated`, 'settings');
            emitGuildUpdated();
            setSavedIndicator(true);
            setTimeout(() => setSavedIndicator(false), 2500);
        } catch {
            addToast({ title: 'Failed to save portal settings', variant: 'error' });
        }
    };

    const handleGuildIconUpload = async (file: File) => {
        if (!guildId) return;
        try {
            const result = await api.guilds.uploadIcon(guildId, file);
            setAvatarUrl(`${API_BASE}/files/${result.iconHash}`);
            addToast({ title: 'Server icon updated', variant: 'success' });
            emitGuildUpdated({ guildId, iconHash: result.iconHash });
        } catch (err: any) {
            addToast({ title: 'Failed to upload server icon', description: err?.message || 'Unknown error', variant: 'error' });
        }
    };

    const handleGuildBannerUpload = async (file: File) => {
        if (!guildId) return;
        const isVid = file.type.startsWith('video/') || file.name.endsWith('.mp4') || file.name.endsWith('.webm');
        try {
            const result = await api.guilds.uploadBanner(guildId, file);
            setBannerUrl(`${API_BASE}/files/${result.bannerHash}`);
            setBannerIsVideo(isVid);
            addToast({ title: 'Banner updated', variant: 'success' });
            emitGuildUpdated();
        } catch (err: any) {
            addToast({ title: 'Failed to upload banner', description: err?.message || 'Unknown error', variant: 'error' });
        }
    };

    const handleGuildBannerRemove = async () => {
        if (!guildId) return;
        try {
            await api.guilds.deleteBanner(guildId);
            setBannerUrl('');
            setBannerIsVideo(false);
            addToast({ title: 'Banner removed', variant: 'success' });
            emitGuildUpdated();
        } catch (err: any) {
            addToast({ title: 'Failed to remove banner', description: err?.message || 'Unknown error', variant: 'error' });
        }
    };

    const applyBranding = async () => {
        if (!guildId) return;
        try {
            await api.guilds.update(guildId, { accentColor: selectedAccentColor });
            addAuditEntry('Portal Settings Changed', actorName, `Accent color → ${selectedAccentColor}`, 'settings');
            emitGuildUpdated();
            setSavedIndicator(true);
            setTimeout(() => setSavedIndicator(false), 2500);
        } catch (err: any) {
            addToast({ title: 'Failed to apply branding', description: err?.message || 'Unknown error', variant: 'error' });
        }
    };

    const deleteGuild = async () => {
        if (!guildId || deleteInput !== serverName || deletingGuild) return;

        setDeletingGuild(true);
        try {
            await api.guilds.delete(guildId);
            addAuditEntry('Server Deleted', actorName, serverName, 'settings');
            addToast({ title: 'Server deleted', description: `${serverName} was permanently deleted.`, variant: 'success' });
            emitGuildUpdated();
            window.dispatchEvent(new CustomEvent('gratonite:guild-deleted', { detail: { guildId } }));
            onClose();
            navigate('/');
        } catch (err: any) {
            addToast({
                title: 'Failed to delete server',
                description: err?.message || 'Unknown error',
                variant: 'error',
            });
        } finally {
            setDeletingGuild(false);
        }
    };

    const leaveGuild = async () => {
        if (!guildId) return;
        try {
            await api.guilds.leave(guildId);
            addToast({ title: 'Left Server', description: `You have left ${serverName}.`, variant: 'info' });
            onClose();
            navigate('/');
            window.dispatchEvent(new CustomEvent('gratonite:guild-left', { detail: { guildId } }));
        } catch {
            addToast({ title: 'Failed', description: 'Could not leave the server.', variant: 'error' });
        }
    };

    const statusColors: Record<string, string> = { online: '#57F287', idle: '#FEE75C', dnd: '#ED4245', offline: '#71717a' };

    const auditTypeIcons: Record<string, React.ReactNode> = {
        role: <Shield size={14} />,
        channel: <Hash size={14} />,
        member: <UserPlus size={14} />,
        settings: <Settings size={14} />,
        message: <AlertTriangle size={14} />,
    };

    const filteredMembers = members.filter(m => m.name.toLowerCase().includes(memberSearch.toLowerCase()));
    const filteredAudit = auditLog.filter(a => {
        if (auditFilter !== 'all' && a.type !== auditFilter) return false;
        if (auditSearch) {
            const q = auditSearch.toLowerCase();
            if (!a.user.toLowerCase().includes(q) && !a.action.toLowerCase().includes(q) && !a.target.toLowerCase().includes(q)) return false;
        }
        if (auditDateFrom || auditDateTo) {
            const entryDate = new Date(a.rawTimestamp);
            if (!isNaN(entryDate.getTime())) {
                if (auditDateFrom && entryDate < new Date(auditDateFrom)) return false;
                if (auditDateTo) {
                    const toEnd = new Date(auditDateTo);
                    toEnd.setDate(toEnd.getDate() + 1);
                    if (entryDate >= toEnd) return false;
                }
            }
        }
        return true;
    });
    const onlineCount = members.filter(m => m.status === 'online').length;

    const tabStyle = (tab: string): React.CSSProperties => ({
        padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, marginBottom: '2px',
        background: activeTab === tab ? 'var(--active-overlay)' : hoveredBtn === `tab-${tab}` ? 'var(--hover-overlay)' : 'transparent',
        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
    });

    return (
        <>
        <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div role="dialog" aria-modal="true" aria-label="Server settings" onClick={e => e.stopPropagation()} style={{ width: 'min(900px, 95vw)', height: 'min(650px, 90vh)', display: 'flex', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
                {/* Left Sidebar */}
                <div className="settings-sidebar" style={{ width: '220px', background: 'var(--bg-elevated)', padding: '32px 16px', borderRight: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                    <div>
                        <div style={{ padding: '0 8px', marginBottom: '16px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
                            {serverName}
                        </div>
                        {(['overview', 'channels', 'roles', 'members', 'invites', 'templates', 'import'] as const).map(tab => (
                            <div key={tab} onClick={() => setActiveTab(tab)}
                                onMouseEnter={() => setHoveredBtn(`tab-${tab}`)} onMouseLeave={() => setHoveredBtn(null)}
                                style={tabStyle(tab)}
                            >{tab.charAt(0).toUpperCase() + tab.slice(1)}</div>
                        ))}
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', padding: '0 12px', marginBottom: '8px' }}>CUSTOMIZATION</div>
                        {(['emojis', 'stickers', 'branding'] as const).map(tab => (
                            <div key={tab} onClick={() => setActiveTab(tab)}
                                onMouseEnter={() => setHoveredBtn(`tab-${tab}`)} onMouseLeave={() => setHoveredBtn(null)}
                                style={tabStyle(tab)}
                            >{tab === 'emojis' ? 'Emojis' : tab === 'stickers' ? 'Stickers' : 'Brand Identity'}</div>
                        ))}
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', padding: '0 12px', marginBottom: '8px' }}>INTEGRATIONS</div>
                        {(['webhooks', 'bots'] as const).map(tab => (
                            <div key={tab} onClick={() => setActiveTab(tab)}
                                onMouseEnter={() => setHoveredBtn(`tab-${tab}`)} onMouseLeave={() => setHoveredBtn(null)}
                                style={tabStyle(tab)}
                            >{tab === 'webhooks' ? 'Webhooks' : 'Installed Bots'}</div>
                        ))}
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', padding: '0 12px', marginBottom: '8px' }}>PREMIUM</div>
                        <div onClick={() => setActiveTab('boosts')}
                            onMouseEnter={() => setHoveredBtn('tab-boosts')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('boosts')}
                        >Server Boosts</div>
                        <div onClick={() => setActiveTab('currency')}
                            onMouseEnter={() => setHoveredBtn('tab-currency')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('currency')}
                        >Server Currency</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', padding: '0 12px', marginBottom: '8px' }}>MODERATION</div>
                        {(['automod', 'wordfilter', 'spam', 'bans', 'audit', 'modqueue', 'security'] as const).map(tab => (
                            <div key={tab} onClick={() => setActiveTab(tab)}
                                onMouseEnter={() => setHoveredBtn(`tab-${tab}`)} onMouseLeave={() => setHoveredBtn(null)}
                                style={tabStyle(tab)}
                            >{tab === 'automod' ? 'AutoMod' : tab === 'wordfilter' ? 'Word Filter' : tab === 'spam' ? 'Spam Detection' : tab === 'bans' ? 'Bans' : tab === 'modqueue' ? 'Mod Queue' : tab === 'security' ? 'Security' : 'Audit Log'}</div>
                        ))}
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', padding: '0 12px', marginBottom: '8px' }}>ANALYTICS</div>
                        <div onClick={() => setActiveTab('insights')}
                            onMouseEnter={() => setHoveredBtn('tab-insights')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('insights')}
                        >Insights</div>
                        <div onClick={() => setActiveTab('onboarding')}
                            onMouseEnter={() => setHoveredBtn('tab-onboarding')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('onboarding')}
                        >Onboarding</div>
                        <div onClick={() => setActiveTab('rules')}
                            onMouseEnter={() => setHoveredBtn('tab-rules')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('rules')}
                        >Server Rules</div>
                        <div onClick={() => setActiveTab('discovery')}
                            onMouseEnter={() => setHoveredBtn('tab-discovery')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('discovery')}
                        >Discovery Tags</div>
                        <div onClick={() => setActiveTab('welcome')}
                            onMouseEnter={() => setHoveredBtn('tab-welcome')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('welcome')}
                        >Welcome Screen</div>
                        <div onClick={() => setActiveTab('highlights')}
                            onMouseEnter={() => setHoveredBtn('tab-highlights')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('highlights')}
                        >Highlights</div>
                        <div onClick={() => setActiveTab('soundboard')}
                            onMouseEnter={() => setHoveredBtn('tab-soundboard')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('soundboard')}
                        >Soundboard</div>
                        <div onClick={() => setActiveTab('backups')}
                            onMouseEnter={() => setHoveredBtn('tab-backups')} onMouseLeave={() => setHoveredBtn(null)}
                            style={tabStyle('backups')}
                        >Backups</div>
                    </div>
                </div>

                {/* Mobile Tab Pills */}
                <div className="settings-tabs-mobile">
                    <button onClick={onClose} style={{ marginRight: 'auto', padding: '6px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '16px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                        <X size={14} /> Close
                    </button>
                    {(['overview', 'channels', 'roles', 'members', 'invites', 'templates', 'import', 'emojis', 'stickers', 'branding', 'webhooks', 'bots', 'automod', 'wordfilter', 'spam', 'bans', 'audit', 'modqueue', 'security', 'insights', 'onboarding', 'rules', 'discovery', 'welcome', 'boosts', 'currency', 'soundboard', 'backups', 'highlights'] as const).map(tab => (
                        <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                            {tab === 'emojis' ? 'Emojis' : tab === 'stickers' ? 'Stickers' : tab === 'branding' ? 'Brand' : tab === 'webhooks' ? 'Webhooks' : tab === 'bots' ? 'Bots' : tab === 'automod' ? 'AutoMod' : tab === 'wordfilter' ? 'Word Filter' : tab === 'audit' ? 'Audit Log' : tab === 'welcome' ? 'Welcome' : tab === 'rules' ? 'Server Rules' : tab === 'discovery' ? 'Discovery' : tab === 'boosts' ? 'Boosts' : tab === 'currency' ? 'Currency' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Right Panel */}
                <div className="settings-content-panel" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', position: 'relative' }}>
                    <button className="settings-close-btn" onClick={onClose}
                        onMouseEnter={() => setHoveredBtn('close')} onMouseLeave={() => setHoveredBtn(null)}
                        style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', color: hoveredBtn === 'close' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>

                    {/* ===================== OVERVIEW ===================== */}
                    {activeTab === 'overview' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Server Overview</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Configure the basic information of your server.</p>

                            <div style={{ display: 'flex', gap: '32px', marginBottom: '32px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                    <div onClick={() => avatarInputRef.current?.click()}
                                        style={{ width: '96px', height: '96px', borderRadius: '24px', background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'linear-gradient(135deg, rgba(82, 109, 245, 0.3), rgba(139, 92, 246, 0.3))', border: '2px dashed var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)' }}
                                    >{!avatarUrl && serverName.charAt(0)}</div>
                                    <button onMouseEnter={() => setHoveredBtn('change-avatar')} onMouseLeave={() => setHoveredBtn(null)}
                                        onClick={() => avatarInputRef.current?.click()}
                                        style={{ background: hoveredBtn === 'change-avatar' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '6px 16px', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                    >Change Icon</button>
                                    <input
                                        type="file"
                                        ref={avatarInputRef}
                                        hidden
                                        accept="image/*"
                                        onChange={e => {
                                            const f = e.target.files?.[0];
                                            if (f) {
                                                handleGuildIconUpload(f);
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>SERVER NAME</label>
                                        <input type="text" value={serverName} onChange={e => setServerName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>SERVER DESCRIPTION</label>
                                        <textarea value={serverDesc} onChange={e => setServerDesc(e.target.value)} rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>WELCOME MESSAGE</label>
                                        <textarea
                                            value={welcomeMessage}
                                            onChange={e => setWelcomeMessage(e.target.value)}
                                            rows={3}
                                            placeholder="Welcome to our server!"
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                        />
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Shown to new members when they join. Leave empty to disable.</div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>RULES CHANNEL</label>
                                        <select
                                            value={rulesChannelId}
                                            onChange={e => setRulesChannelId(e.target.value)}
                                            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}
                                        >
                                            <option value="">None</option>
                                            {channelsList
                                                .filter(ch => ch.type === 'GUILD_TEXT' || ch.type === 'text')
                                                .map(ch => (
                                                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                                                ))
                                            }
                                        </select>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>A "Go to #rules" button will appear in the welcome modal.</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ height: '1px', background: 'var(--stroke)', marginBottom: '24px' }} />

                            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Server Banner</h3>
                            <div style={{ width: '100%', height: '140px', borderRadius: '12px', background: !bannerUrl ? 'linear-gradient(135deg, rgba(82, 109, 245, 0.2), rgba(0,0,0,0.5))' : 'var(--bg-tertiary)', border: '2px dashed var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '12px', overflow: 'hidden', position: 'relative' }} onClick={() => bannerInputRef.current?.click()}>
                                {bannerUrl ? (
                                    bannerIsVideo ? (
                                        <video src={bannerUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
                                    ) : (
                                        <img src={bannerUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                    )
                                ) : null}
                                <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500, position: 'relative', zIndex: 1, background: bannerUrl ? 'rgba(0,0,0,0.5)' : 'transparent', padding: bannerUrl ? '4px 12px' : '0', borderRadius: '6px' }}>{bannerUrl ? 'Click to change' : 'Click to upload banner (960×540 recommended)'}</span>
                            </div>
                            <input
                                type="file"
                                ref={bannerInputRef}
                                hidden
                                accept="image/*,video/mp4,.gif"
                                onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) handleGuildBannerUpload(f);
                                    e.target.value = '';
                                }}
                            />

                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '24px 0' }} />

                            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Quick Stats</h3>
                            <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                                {[
                                    { label: 'Total Members', value: members.length.toString(), color: 'var(--accent-primary)' },
                                    { label: 'Online Now', value: onlineCount.toString(), color: '#57F287' },
                                    { label: 'Roles', value: roles.length.toString(), color: '#f59e0b' },
                                ].map(stat => (
                                    <div key={stat.label} style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '20px', border: '1px solid var(--stroke)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '28px', fontWeight: 700, color: stat.color, marginBottom: '4px' }}>{stat.value}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Category & Tags */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>CATEGORY</label>
                                <select
                                    value={guildCategory}
                                    onChange={e => setGuildCategory(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: guildCategory ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}
                                >
                                    <option value=''>None (not categorized)</option>
                                    <option value='gaming'>Gaming</option>
                                    <option value='music'>Music</option>
                                    <option value='art'>Art</option>
                                    <option value='tech'>Tech</option>
                                    <option value='community'>Community</option>
                                    <option value='anime'>Anime</option>
                                    <option value='education'>Education</option>
                                    <option value='other'>Other</option>
                                </select>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Category helps users find your server in Discovery.</p>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>TAGS</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                    {guildTags.map(tag => (
                                        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: '999px', border: '1px solid var(--stroke)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {tag}
                                            <button
                                                onClick={() => setGuildTags(prev => prev.filter(t => t !== tag))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={e => {
                                            if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                                                e.preventDefault();
                                                const newTag = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
                                                if (newTag && !guildTags.includes(newTag) && guildTags.length < 10) {
                                                    setGuildTags(prev => [...prev, newTag]);
                                                }
                                                setTagInput('');
                                            }
                                        }}
                                        placeholder="Type a tag and press Enter (max 10)"
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}
                                    />
                                    <button
                                        onClick={() => {
                                            const newTag = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
                                            if (newTag && !guildTags.includes(newTag) && guildTags.length < 10) {
                                                setGuildTags(prev => [...prev, newTag]);
                                            }
                                            setTagInput('');
                                        }}
                                        style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                    >
                                        Add
                                    </button>
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Up to 10 tags. Tags help users discover your server.</p>
                            </div>

                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '24px 0' }} />
                            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Server Rules</h3>
                            <div style={{ marginBottom: '16px' }}>
                                <textarea
                                    value={rulesText}
                                    onChange={e => setRulesText(e.target.value)}
                                    rows={5}
                                    placeholder="Enter your server rules here..."
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' as const }}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Rules shown to new members when they join.</div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '24px' }}>
                                <input type="checkbox" checked={requireRulesAgreement} onChange={e => setRequireRulesAgreement(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                Require agreement to rules before chatting
                            </label>

                            <button onClick={saveOverview} onMouseEnter={() => setHoveredBtn('save-overview')} onMouseLeave={() => setHoveredBtn(null)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', background: savedIndicator ? '#10b981' : 'var(--accent-primary)', border: 'none', color: savedIndicator ? 'white' : '#000', fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: 'background 0.3s' }}
                            >
                                {savedIndicator ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
                            </button>

                            {/* Vanity URL */}
                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '24px 0' }} />
                            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Vanity URL</h3>
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '8px' }}>
                                    <span style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: '14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>gratonite.chat/app/invite/</span>
                                    <input
                                        type="text"
                                        value={vanityCode}
                                        onChange={e => setVanityCode(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())}
                                        placeholder="your-code"
                                        disabled={vanityLoading}
                                        style={{ flex: 1, padding: '10px 14px', borderRadius: '0 8px 8px 0', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!guildId || !vanityCode.trim()) return;
                                        setVanitySaving(true);
                                        try {
                                            await api.guilds.updateVanityUrl(guildId, vanityCode.trim());
                                            addToast({ title: 'Vanity URL saved', variant: 'success' });
                                        } catch (err: any) {
                                            addToast({ title: 'Failed to save vanity URL', description: err?.message || 'Code may be taken.', variant: 'error' });
                                        } finally {
                                            setVanitySaving(false);
                                        }
                                    }}
                                    disabled={vanitySaving || !vanityCode.trim()}
                                    style={{ padding: '8px 20px', borderRadius: '6px', background: vanityCode.trim() && !vanitySaving ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: 'none', color: vanityCode.trim() && !vanitySaving ? '#000' : 'var(--text-muted)', fontWeight: 600, fontSize: '13px', cursor: vanityCode.trim() && !vanitySaving ? 'pointer' : 'default' }}
                                >
                                    {vanitySaving ? 'Saving...' : 'Save Vanity URL'}
                                </button>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Custom invite URL for your server. Only alphanumeric characters and hyphens.</p>
                            </div>

                            {/* Safety & Verification */}
                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '24px 0' }} />

                            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Safety & Verification</h3>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>VERIFICATION LEVEL</label>
                                <select value={verificationLevel} onChange={e => setVerificationLevel(e.target.value as any)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}>
                                    <option value="none">None — Unrestricted</option>
                                    <option value="low">Low — Verified email required</option>
                                    <option value="medium">Medium — Registered for 5+ minutes</option>
                                    <option value="high">High — Member of server for 10+ minutes</option>
                                    <option value="highest">Highest — Verified phone number required</option>
                                </select>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    Members must meet these requirements before they can send messages or join voice.
                                </p>
                            </div>

                            {/* System Messages Channel */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>SYSTEM MESSAGES CHANNEL</label>
                                <select value={systemChannel} onChange={e => setSystemChannel(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}>
                                    {channelsList.filter(c => c.type === 'GUILD_TEXT' || c.type === 'text').length === 0 ? (
                                        <option value="">No text channels</option>
                                    ) : (
                                        channelsList.filter(c => c.type === 'GUILD_TEXT' || c.type === 'text').map(c => (
                                            <option key={c.id} value={c.id}>#{c.name}</option>
                                        ))
                                    )}
                                </select>
                                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        <input type="checkbox" checked={systemMsgJoin} onChange={e => setSystemMsgJoin(e.target.checked)} />
                                        Send a message when someone joins this server
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                        <input type="checkbox" checked={systemMsgBoost} onChange={e => setSystemMsgBoost(e.target.checked)} />
                                        Send a message when someone boosts this server
                                    </label>
                                </div>
                            </div>

                            {/* AFK Channel */}
                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '24px 0' }} />
                            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>AFK Channel</h3>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>AFK VOICE CHANNEL</label>
                                <select
                                    value={afkChannelId}
                                    onChange={e => setAfkChannelId(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}
                                >
                                    <option value="">None</option>
                                    {channelsList
                                        .filter(ch => ch.type === 'GUILD_VOICE' || ch.type === 'voice')
                                        .map(ch => (
                                            <option key={ch.id} value={ch.id}>{ch.name}</option>
                                        ))
                                    }
                                </select>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Members idle longer than the timeout will be moved to this channel.</div>
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>AFK TIMEOUT</label>
                                <select
                                    value={afkTimeout}
                                    onChange={e => setAfkTimeout(Number(e.target.value))}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}
                                >
                                    <option value={60}>1 minute</option>
                                    <option value={300}>5 minutes</option>
                                    <option value={900}>15 minutes</option>
                                    <option value={1800}>30 minutes</option>
                                    <option value={3600}>1 hour</option>
                                </select>
                            </div>
                            <button
                                onClick={async () => {
                                    if (!guildId) return;
                                    try {
                                        await api.guilds.update(guildId, { afkChannelId: afkChannelId || null, afkTimeout } as any);
                                        addToast({ title: 'AFK settings saved', variant: 'success' });
                                    } catch {
                                        addToast({ title: 'Failed to save AFK settings', variant: 'error' });
                                    }
                                }}
                                style={{ padding: '8px 20px', borderRadius: '6px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, fontSize: '13px', cursor: 'pointer', marginBottom: '8px' }}
                            >
                                Save AFK Settings
                            </button>

                            {/* Danger Zone */}
                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '24px 0' }} />

                            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--error)', fontWeight: 600, marginBottom: '16px' }}>Danger Zone</h3>

                            {currentUser.id === guildOwnerId ? (
                                !deleteConfirm ? (
                                    <button onClick={() => setDeleteConfirm(true)} style={{ background: 'transparent', border: '1px solid var(--error)', padding: '10px 24px', borderRadius: '8px', color: 'var(--error)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                                        Delete Server
                                    </button>
                                ) : (
                                    <div style={{ background: 'rgba(237,66,69,0.1)', border: '1px solid var(--error)', borderRadius: '12px', padding: '24px' }}>
                                        <h4 style={{ color: 'var(--error)', marginBottom: '8px' }}>Are you sure? This cannot be undone.</h4>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Type the server name to confirm: <strong>{serverName}</strong></p>
                                        <input type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="Type server name..." style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const, marginBottom: '16px' }} />
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                disabled={deleteInput !== serverName || deletingGuild}
                                                onClick={deleteGuild}
                                                style={{ background: deleteInput === serverName ? 'var(--error)' : 'var(--bg-tertiary)', border: 'none', padding: '10px 24px', borderRadius: '8px', color: deleteInput === serverName ? 'white' : 'var(--text-muted)', fontWeight: 700, fontSize: '14px', cursor: deleteInput === serverName ? 'pointer' : 'not-allowed' }}
                                            >
                                                {deletingGuild ? 'Deleting...' : 'Delete Server'}
                                            </button>
                                            <button onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '10px 24px', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <button onClick={leaveGuild} style={{ background: 'transparent', border: '1px solid var(--error)', padding: '10px 24px', borderRadius: '8px', color: 'var(--error)', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                                    Leave Server
                                </button>
                            )}
                        </>
                    )}

                    {/* ===================== CHANNELS ===================== */}
                    {activeTab === 'channels' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Channels</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Manage channels and categories. Drag to reorder.</p>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                                <button
                                    onClick={() => setShowCreateCategory(true)}
                                    onMouseEnter={() => setHoveredBtn('create-cat')} onMouseLeave={() => setHoveredBtn(null)}
                                    style={{ padding: '8px 16px', background: hoveredBtn === 'create-cat' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Plus size={14} /> Create Category
                                </button>
                                <button
                                    onClick={() => setShowCreateChannelInSettings({ parentId: null })}
                                    onMouseEnter={() => setHoveredBtn('create-ch')} onMouseLeave={() => setHoveredBtn(null)}
                                    style={{ padding: '8px 16px', background: hoveredBtn === 'create-ch' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <Plus size={14} /> Create Channel
                                </button>
                            </div>

                            {/* Create Category Inline */}
                            {showCreateCategory && (
                                <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        autoFocus
                                        placeholder="category-name"
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory(); if (e.key === 'Escape') { setShowCreateCategory(false); setNewCategoryName(''); } }}
                                        style={{ flex: 1, background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                    />
                                    <button onClick={handleCreateCategory} disabled={!newCategoryName.trim()} style={{ padding: '6px 12px', background: newCategoryName.trim() ? 'var(--accent-primary)' : 'var(--bg-elevated)', color: newCategoryName.trim() ? '#000' : 'var(--text-muted)', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: newCategoryName.trim() ? 'pointer' : 'default' }}>Create</button>
                                    <button onClick={() => { setShowCreateCategory(false); setNewCategoryName(''); }} style={{ padding: '6px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                                </div>
                            )}

                            {/* Create Channel Inline */}
                            {showCreateChannelInSettings && (
                                <div style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <select
                                            value={newChannelTypeInSettings}
                                            onChange={e => setNewChannelTypeInSettings(e.target.value as any)}
                                            style={{ background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        >
                                            <option value="GUILD_TEXT">Text Channel</option>
                                            <option value="GUILD_VOICE">Voice Channel</option>
                                            <option value="GUILD_FORUM">Forum Channel</option>
                                            <option value="GUILD_ANNOUNCEMENT">Announcement Channel</option>
                                            <option value="GUILD_WIKI">Wiki Channel</option>
                                            <option value="GUILD_QA">Q&A Channel</option>
                                            <option value="GUILD_CONFESSION">Confession Channel</option>
                                            <option value="GUILD_TASK">Task Board (Kanban)</option>
                                        </select>
                                        <select
                                            value={showCreateChannelInSettings.parentId ?? ''}
                                            onChange={e => setShowCreateChannelInSettings({ parentId: e.target.value || null })}
                                            style={{ background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        >
                                            <option value="">No Category</option>
                                            {channelsList.filter(c => c.type === 'GUILD_CATEGORY').map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            autoFocus
                                            placeholder="channel-name"
                                            value={newChannelNameInSettings}
                                            onChange={e => setNewChannelNameInSettings(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleCreateChannelInSettings(); if (e.key === 'Escape') { setShowCreateChannelInSettings(null); setNewChannelNameInSettings(''); } }}
                                            style={{ flex: 1, background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        />
                                        <button onClick={handleCreateChannelInSettings} disabled={!newChannelNameInSettings.trim()} style={{ padding: '6px 12px', background: newChannelNameInSettings.trim() ? 'var(--accent-primary)' : 'var(--bg-elevated)', color: newChannelNameInSettings.trim() ? '#000' : 'var(--text-muted)', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: newChannelNameInSettings.trim() ? 'pointer' : 'default' }}>Create</button>
                                        <button onClick={() => { setShowCreateChannelInSettings(null); setNewChannelNameInSettings(''); }} style={{ padding: '6px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                    {/* Temporary Channel option (Item 37) */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={tempChannelEnabled} onChange={e => setTempChannelEnabled(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                            Temporary channel
                                        </label>
                                        <select
                                            value={tempChannelDuration}
                                            onChange={e => setTempChannelDuration(e.target.value)}
                                            disabled={!tempChannelEnabled}
                                            style={{
                                                padding: '4px 8px', background: 'var(--bg-app)', border: '1px solid var(--stroke)',
                                                borderRadius: '4px', color: 'var(--text-primary)', fontSize: '11px',
                                                opacity: tempChannelEnabled ? 1 : 0.5,
                                            }}
                                        >
                                            <option value="3600">1 hour</option>
                                            <option value="21600">6 hours</option>
                                            <option value="86400">24 hours</option>
                                            <option value="604800">1 week</option>
                                            <option value="empty">Until empty</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {channelsLoading ? (
                                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading channels...</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {/* Uncategorized channels */}
                                    {channelsList
                                        .filter(c => c.type !== 'GUILD_CATEGORY' && !c.parentId)
                                        .sort((a, b) => a.position - b.position)
                                        .map(ch => (
                                            <div
                                                key={ch.id}
                                                draggable
                                                onDragStart={() => handleChannelDragStart(ch.id)}
                                                onDragOver={e => handleChannelDragOver(e, ch.id)}
                                                onDrop={() => handleChannelDrop(ch.id)}
                                                onDragEnd={() => { setDragChannelId(null); setDragOverId(null); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                                    background: dragOverId === ch.id ? 'var(--active-overlay)' : 'var(--bg-tertiary)',
                                                    borderRadius: '6px', cursor: 'grab',
                                                    opacity: dragChannelId === ch.id ? 0.5 : 1,
                                                    border: dragOverId === ch.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                                }}
                                            >
                                                <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                {ch.type === 'GUILD_VOICE' ? <Mic size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <Hash size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                                                {ch.restricted ? <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : null}
                                                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{ch.name}</span>
                                                <button onClick={() => setConfirmDialog({ title: 'Delete Channel', description: `Are you sure you want to delete #${ch.name}? This cannot be undone.`, onConfirm: () => handleDeleteChannel(ch.id) })} aria-label="Delete channel" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Trash2 size={14} /></button>
                                            </div>
                                        ))}

                                    {/* Categories with children */}
                                    {channelsList
                                        .filter(c => c.type === 'GUILD_CATEGORY')
                                        .sort((a, b) => a.position - b.position)
                                        .map(cat => {
                                            const children = channelsList
                                                .filter(c => c.parentId === cat.id && c.type !== 'GUILD_CATEGORY')
                                                .sort((a, b) => a.position - b.position);
                                            return (
                                                <div key={cat.id} style={{ marginTop: '12px' }}>
                                                    <div
                                                        draggable
                                                        onDragStart={() => handleChannelDragStart(cat.id)}
                                                        onDragOver={e => handleChannelDragOver(e, cat.id)}
                                                        onDrop={() => handleChannelDrop(cat.id)}
                                                        onDragEnd={() => { setDragChannelId(null); setDragOverId(null); }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
                                                            background: dragOverId === cat.id ? 'var(--active-overlay)' : 'transparent',
                                                            borderRadius: '6px', cursor: 'grab',
                                                            opacity: dragChannelId === cat.id ? 0.5 : 1,
                                                            border: dragOverId === cat.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                                        }}
                                                    >
                                                        <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                        {editingCategoryId === cat.id ? (
                                                            <input
                                                                autoFocus
                                                                value={editingCategoryName}
                                                                onChange={e => setEditingCategoryName(e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(cat.id); if (e.key === 'Escape') { setEditingCategoryId(null); setEditingCategoryName(''); } }}
                                                                onBlur={() => { setEditingCategoryId(null); setEditingCategoryName(''); }}
                                                                style={{ flex: 1, background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '4px', padding: '2px 6px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', outline: 'none' }}
                                                            />
                                                        ) : (
                                                            <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat.name}</span>
                                                        )}
                                                        <button onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }} aria-label="Edit category" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Edit2 size={12} /></button>
                                                        <button onClick={() => setShowCreateChannelInSettings({ parentId: cat.id })} aria-label="Add channel" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Plus size={12} /></button>
                                                        <button onClick={() => setConfirmDialog({ title: 'Delete Category', description: `Are you sure you want to delete "${cat.name}" and all its channels? This cannot be undone.`, onConfirm: () => handleDeleteChannel(cat.id) })} aria-label="Delete channel" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Trash2 size={12} /></button>
                                                    </div>
                                                    <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                                        {children.map(ch => (
                                                            <div
                                                                key={ch.id}
                                                                draggable
                                                                onDragStart={() => handleChannelDragStart(ch.id)}
                                                                onDragOver={e => handleChannelDragOver(e, ch.id)}
                                                                onDrop={() => handleChannelDrop(ch.id)}
                                                                onDragEnd={() => { setDragChannelId(null); setDragOverId(null); }}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                                                                    background: dragOverId === ch.id ? 'var(--active-overlay)' : 'var(--bg-tertiary)',
                                                                    borderRadius: '6px', cursor: 'grab',
                                                                    opacity: dragChannelId === ch.id ? 0.5 : 1,
                                                                    border: dragOverId === ch.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                                                }}
                                                            >
                                                                <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                                {ch.type === 'GUILD_VOICE' ? <Mic size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <Hash size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                                                                {ch.restricted ? <Lock size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : null}
                                                                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{ch.name}</span>
                                                                <button onClick={() => setConfirmDialog({ title: 'Delete Channel', description: `Are you sure you want to delete #${ch.name}? This cannot be undone.`, onConfirm: () => handleDeleteChannel(ch.id) })} aria-label="Delete channel" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Trash2 size={14} /></button>
                                                            </div>
                                                        ))}
                                                        {children.length === 0 && (
                                                            <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>No channels in this category</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </>
                    )}

                    {/* ===================== ROLES ===================== */}
                    {activeTab === 'roles' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Roles</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Use roles to group your server members and assign permissions. Higher roles override lower ones.</p>

                            <div style={{ display: 'flex', gap: '32px', height: '450px' }}>
                                <div style={{ width: '240px', display: 'flex', flexDirection: 'column', gap: '8px', borderRight: '1px solid var(--stroke)', paddingRight: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>All Roles</span>
                                        <button onMouseEnter={() => setHoveredBtn('create-role')} onMouseLeave={() => setHoveredBtn(null)}
                                            onClick={async () => {
                                                if (!guildId) return;
                                                try {
                                                    const created = await api.guilds.createRole(guildId, { name: 'New Role', color: '#71717a' }) as any;
                                                    const newRole: Role = {
                                                        id: created.id,
                                                        name: created.name || 'New Role',
                                                        color: colorIntToHex(created.color),
                                                        memberCount: 0,
                                                        permissions: permissionsIntToRecord(created.permissions),
                                                    };
                                                    setRoles(prev => [...prev, newRole]);
                                                    setActiveRole(newRole);
                                                    addAuditEntry('Role Created', actorName, newRole.name, 'role');
                                                    addToast({ title: 'Role created', variant: 'success' });
                                                } catch {
                                                    addToast({ title: 'Failed to create role', variant: 'error' });
                                                }
                                            }}
                                            style={{ background: 'transparent', border: 'none', color: hoveredBtn === 'create-role' ? 'var(--text-primary)' : 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                        ><Plus size={14} /> Create</button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
                                        {roles.map(role => (
                                            <div key={role.id}
                                                onClick={() => setActiveRole(role)}
                                                draggable={role.id !== '1'}
                                                onDragStart={() => setDraggedRole(role.id)}
                                                onDragOver={(e) => { e.preventDefault(); setDragOverRole(role.id); }}
                                                onDrop={() => {
                                                    if (draggedRole && draggedRole !== role.id && role.id !== '1') {
                                                        setRoles(prev => {
                                                            const newRoles = [...prev];
                                                            const dragIdx = newRoles.findIndex(r => r.id === draggedRole);
                                                            const dropIdx = newRoles.findIndex(r => r.id === role.id);
                                                            if (dragIdx !== -1 && dropIdx !== -1) {
                                                                const [moved] = newRoles.splice(dragIdx, 1);
                                                                newRoles.splice(dropIdx, 0, moved);
                                                            }
                                                            // Persist new role order to server
                                                            if (guildId) {
                                                                const positions = newRoles.map((r, i) => ({ id: r.id, position: newRoles.length - i }));
                                                                api.patch(`/guilds/${guildId}/roles/positions`, { positions }).catch(() => {
                                                                    addToast({ title: 'Failed to save role order', variant: 'error' });
                                                                    fetchRoles();
                                                                });
                                                            }
                                                            return newRoles;
                                                        });
                                                    }
                                                    setDraggedRole(null);
                                                    setDragOverRole(null);
                                                }}
                                                onDragEnd={() => { setDraggedRole(null); setDragOverRole(null); }}
                                                onMouseEnter={() => setHoveredBtn(`role-${role.id}`)} onMouseLeave={() => setHoveredBtn(null)}
                                                style={{ padding: '10px 12px', borderRadius: '6px', background: activeRole?.id === role.id ? 'var(--bg-tertiary)' : hoveredBtn === `role-${role.id}` ? 'var(--hover-overlay)' : 'transparent', border: `1px solid ${activeRole?.id === role.id ? 'var(--stroke)' : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', opacity: draggedRole === role.id ? 0.5 : 1, borderTop: dragOverRole === role.id && draggedRole !== role.id ? '2px solid var(--accent-primary)' : undefined }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {role.id !== '1' && <GripVertical size={14} style={{ color: 'var(--text-muted)', cursor: 'grab', flexShrink: 0 }} />}
                                                    <Shield size={16} color={role.color} />
                                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{role.name}</span>
                                                </div>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{role.memberCount}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: '12px' }}>
                                    {rolesLoading && roles.length === 0 ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '14px' }}>Loading roles...</div>
                                    ) : !activeRole ? (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '14px' }}>Select a role to edit permissions</div>
                                    ) : (<>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                                        <div>
                                            {editingRoleName ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                                    <input type="text" value={editRoleNameVal} onChange={e => setEditRoleNameVal(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600, outline: 'none' }} autoFocus />
                                                    <input type="color" value={editRoleColorVal} onChange={e => setEditRoleColorVal(e.target.value)} style={{ width: '32px', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                                                    <input type="text" value={editRoleEmojiVal} onChange={e => setEditRoleEmojiVal(e.target.value)} placeholder="Emoji" title="Role icon emoji" style={{ width: '48px', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '16px', textAlign: 'center', outline: 'none' }} maxLength={4} />
                                                    <button onClick={saveRoleEdit} style={{ background: 'var(--accent-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Save</button>
                                                    <button onClick={() => setEditingRoleName(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '6px 12px', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{activeRole.name}</h3>
                                                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: activeRole.color }} />
                                                    <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>{activeRole.memberCount} Members</span>
                                                    {activeRole.id !== '1' && (
                                                        <button onClick={() => { setEditingRoleName(true); setEditRoleNameVal(activeRole.name); setEditRoleColorVal(activeRole.color || '#99aab5'); }}
                                                            onMouseEnter={() => setHoveredBtn('edit-role')} onMouseLeave={() => setHoveredBtn(null)}
                                                            style={{ background: 'none', border: 'none', color: hoveredBtn === 'edit-role' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                                                            <Edit2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {activeRole.id !== '1' && activeRole.id !== '4' && (
                                            <button onMouseEnter={() => setHoveredBtn('delete-role')} onMouseLeave={() => setHoveredBtn(null)}
                                                onClick={async () => {
                                                    if (!guildId || !activeRole) return;
                                                    try {
                                                        await api.guilds.deleteRole(guildId, activeRole.id);
                                                        const filtered = roles.filter(r => r.id !== activeRole.id);
                                                        addAuditEntry('Role Deleted', actorName, activeRole.name, 'role');
                                                        setRoles(filtered);
                                                        setActiveRole(filtered[0] || null);
                                                        addToast({ title: 'Role deleted', variant: 'success' });
                                                    } catch {
                                                        addToast({ title: 'Failed to delete role', variant: 'error' });
                                                    }
                                                }}
                                                style={{ background: hoveredBtn === 'delete-role' ? 'rgba(237,66,69,0.1)' : 'transparent', border: '1px solid var(--stroke)', padding: '6px 12px', borderRadius: '6px', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}
                                            ><Trash2 size={14} /> Delete</button>
                                        )}
                                    </div>

                                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Permissions</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        {Object.entries(
                                            permissionsList.reduce<Record<string, typeof permissionsList>>((acc, perm) => {
                                                const cat = perm.category || 'general';
                                                if (!acc[cat]) acc[cat] = [];
                                                acc[cat].push(perm);
                                                return acc;
                                            }, {})
                                        ).map(([category, perms]) => (
                                            <div key={category}>
                                                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '12px', marginTop: '16px', letterSpacing: '0.05em' }}>
                                                    {category === 'advanced' ? 'Dangerous' : category === 'general' ? 'General Server' : category === 'moderation' ? 'Moderation' : category === 'text' ? 'Text Channel' : 'Voice Channel'} Permissions
                                                </h4>
                                                {perms.map(perm => {
                                                    const isEnabled = activeRole.permissions[perm.key];
                                                    const isOwner = activeRole.id === '1';
                                                    const isAdmin = perm.key === 'administrator';
                                                    return (
                                                        <div key={perm.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid var(--stroke)' }}>
                                                            <div>
                                                                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', color: isAdmin ? 'var(--error)' : undefined }}>{perm.label}</div>
                                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{perm.desc}</div>
                                                            </div>
                                                            <div onClick={() => {
                                                                if (isOwner) return;
                                                                if (isAdmin && !isEnabled) {
                                                                    setAdminWarning(activeRole.id);
                                                                } else {
                                                                    togglePermission(activeRole.id, perm.key);
                                                                }
                                                            }}
                                                                style={{ width: '40px', height: '24px', background: isEnabled ? (isAdmin ? 'var(--error)' : 'var(--success)') : 'var(--bg-elevated)', borderRadius: '12px', position: 'relative', cursor: isOwner ? 'not-allowed' : 'pointer', opacity: isOwner ? 0.6 : 1, flexShrink: 0 }}>
                                                                <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', transition: 'left 0.2s', left: isEnabled ? '19px' : '3px' }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                    {adminWarning && (
                                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--error)', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                    <AlertTriangle size={20} color="var(--error)" />
                                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--error)' }}>Grant Administrator?</h3>
                                                </div>
                                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
                                                    This grants ALL permissions and bypasses all channel overrides. Members with this permission can do everything, including managing other members' roles.
                                                </p>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => setAdminWarning(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '8px 16px', borderRadius: '8px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                                                    <button onClick={() => { togglePermission(adminWarning, 'administrator'); setAdminWarning(null); }} style={{ background: 'var(--error)', border: 'none', padding: '8px 16px', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Grant Administrator</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    </>)}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ===================== MEMBERS ===================== */}
                    {activeTab === 'members' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Members</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                                {membersLoading ? 'Loading members...' : `Manage all ${members.length} server members. ${onlineCount} currently online.`}
                            </p>

                            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
                                    <input type="text" placeholder="Search members..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <button onMouseEnter={() => setHoveredBtn('invite-member')} onMouseLeave={() => setHoveredBtn(null)}
                                    onClick={() => {
                                        addToast({ title: 'Invite link copied', description: 'Share this link to invite members to the server.', variant: 'success' });
                                    }}
                                    style={{ background: hoveredBtn === 'invite-member' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '0 16px', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                                ><UserPlus size={16} /> Invite</button>
                                <button
                                    onClick={async () => {
                                        if (!guildId) return;
                                        const days = prompt('Prune members inactive for how many days? (default: 30)', '30');
                                        if (!days) return;
                                        const d = parseInt(days) || 30;
                                        try {
                                            const preview = await api.get<{ count: number }>(`/guilds/${guildId}/prune/preview?days=${d}`);
                                            if (confirm(`This will remove ${(preview as any).count ?? 0} inactive members. Continue?`)) {
                                                const result = await api.post<{ pruned: number }>(`/guilds/${guildId}/prune`, { days: d });
                                                addToast({ title: `Pruned ${(result as any).pruned ?? 0} members`, variant: 'success' });
                                                fetchMembers();
                                            }
                                        } catch {
                                            addToast({ title: 'Failed to prune members', variant: 'error' });
                                        }
                                    }}
                                    style={{
                                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        padding: '0 16px', borderRadius: '8px', color: 'var(--text-secondary)',
                                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                                    }}
                                ><UserX size={16} /> Prune</button>
                            </div>

                            {kickConfirm && (
                                <div style={{ background: 'rgba(237,66,69,0.1)', border: '1px solid var(--error)', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                                        Remove <strong>{members.find(m => m.id === kickConfirm)?.name}</strong> from this server?
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => kickMember(kickConfirm)} style={{ background: 'var(--error)', border: 'none', padding: '6px 14px', borderRadius: '6px', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Kick</button>
                                        <button onClick={() => setKickConfirm(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '6px 14px', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* Bulk action bar */}
                            {selectedMemberIds.size > 0 && (
                                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{selectedMemberIds.size} member{selectedMemberIds.size !== 1 ? 's' : ''} selected</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => setBulkActionConfirm('kick')} style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Kick</button>
                                        <button onClick={() => setBulkActionConfirm('ban')} style={{ padding: '6px 14px', borderRadius: '6px', background: 'rgba(237,66,69,0.1)', border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Ban</button>
                                        <button onClick={() => setSelectedMemberIds(new Set())} style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Clear</button>
                                    </div>
                                </div>
                            )}

                            {/* Bulk action confirmation */}
                            {bulkActionConfirm && (
                                <div style={{ background: 'rgba(237,66,69,0.1)', border: '1px solid var(--error)', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                                        {bulkActionConfirm === 'kick' ? 'Kick' : 'Ban'} <strong>{selectedMemberIds.size}</strong> selected member{selectedMemberIds.size !== 1 ? 's' : ''}?
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={async () => {
                                            if (!guildId) return;
                                            const ids = Array.from(selectedMemberIds);
                                            try {
                                                const endpoint = bulkActionConfirm === 'kick' ? 'bulk-kick' : 'bulk-ban';
                                                const result = await api.post<{ processed: number; failed: string[] }>(`/guilds/${guildId}/members/${endpoint}`, { userIds: ids });
                                                setMembers(prev => prev.filter(m => !ids.includes(m.id) || result.failed.includes(m.id)));
                                                setSelectedMemberIds(new Set());
                                                addToast({ title: `${bulkActionConfirm === 'kick' ? 'Kicked' : 'Banned'} ${result.processed} member${result.processed !== 1 ? 's' : ''}`, variant: 'success' });
                                            } catch {
                                                addToast({ title: `Failed to ${bulkActionConfirm}`, variant: 'error' });
                                            }
                                            setBulkActionConfirm(null);
                                        }} style={{ background: 'var(--error)', border: 'none', padding: '6px 14px', borderRadius: '6px', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Confirm</button>
                                        <button onClick={() => setBulkActionConfirm(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '6px 14px', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '28px 2fr 1fr 1fr 1fr 80px', padding: '8px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                    <input type="checkbox" checked={selectedMemberIds.size > 0 && selectedMemberIds.size === filteredMembers.filter(m => m.roles[0] !== 'Owner').length} onChange={e => {
                                        if (e.target.checked) {
                                            setSelectedMemberIds(new Set(filteredMembers.filter(m => m.roles[0] !== 'Owner').map(m => m.id)));
                                        } else {
                                            setSelectedMemberIds(new Set());
                                        }
                                    }} style={{ accentColor: 'var(--accent-primary)' }} />
                                    <span>Member</span><span>Role</span><span>Status</span><span>Joined</span><span />
                                </div>
                                {filteredMembers.map(member => (
                                    <div key={member.id} onMouseEnter={() => setHoveredBtn(`member-${member.id}`)} onMouseLeave={() => setHoveredBtn(null)}
                                        style={{ display: 'grid', gridTemplateColumns: '28px 2fr 1fr 1fr 1fr 80px', padding: '12px 16px', borderRadius: '8px', alignItems: 'center', background: selectedMemberIds.has(member.id) ? 'rgba(82, 109, 245, 0.1)' : hoveredBtn === `member-${member.id}` ? 'var(--hover-overlay)' : 'transparent' }}
                                    >
                                        <input type="checkbox" checked={selectedMemberIds.has(member.id)} disabled={member.roles[0] === 'Owner'} onChange={e => {
                                            setSelectedMemberIds(prev => {
                                                const next = new Set(prev);
                                                if (e.target.checked) next.add(member.id); else next.delete(member.id);
                                                return next;
                                            });
                                        }} style={{ accentColor: 'var(--accent-primary)' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, position: 'relative', flexShrink: 0 }}>
                                                {member.avatar}
                                                <div style={{ position: 'absolute', bottom: -1, right: -1, width: '12px', height: '12px', borderRadius: '50%', background: statusColors[member.status], border: '2px solid var(--bg-primary)' }} />
                                            </div>
                                            <span style={{ fontWeight: 500, fontSize: '14px', color: (() => { const memberRole = member.roles[0]; const role = roles.find(r => r.name === memberRole); return role?.color && role.color !== '#71717a' ? role.color : 'var(--text-primary)'; })() }}>{member.name}</span>
                                        </div>
                                        <div style={{ position: 'relative' }}>
                                            {assignRoleFor === member.id && (
                                                <div style={{ position: 'absolute', top: -4, left: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', zIndex: 10, minWidth: '130px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
                                                    {roles.map(role => (
                                                        <div key={role.id} onClick={() => assignRole(member.id, role.name)}
                                                            className="hover-bg-overlay"
                                                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                        >
                                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                                                            {role.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <button onClick={() => setAssignRoleFor(assignRoleFor === member.id ? null : member.id)}
                                                disabled={member.roles[0] === 'Owner'}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: member.roles[0] === 'Owner' ? 'default' : 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                                            >
                                                <Shield size={12} color={roles.find(r => r.name === member.roles[0])?.color || 'var(--text-muted)'} />
                                                {member.roles[0]}
                                                {member.roles[0] !== 'Owner' && <ChevronDown size={10} />}
                                            </button>
                                        </div>
                                        <span style={{ fontSize: '12px', color: statusColors[member.status], fontWeight: 600, textTransform: 'capitalize' }}>{member.status}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.joinedAt}</span>
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                            {member.roles[0] !== 'Owner' && (
                                                <button onMouseEnter={() => setHoveredBtn(`kick-${member.id}`)} onMouseLeave={() => setHoveredBtn(null)}
                                                    onClick={() => setKickConfirm(member.id)} title="Kick member"
                                                    style={{ background: hoveredBtn === `kick-${member.id}` ? 'rgba(237,66,69,0.1)' : 'transparent', border: '1px solid var(--stroke)', width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: hoveredBtn === `kick-${member.id}` ? 'var(--error)' : 'var(--text-muted)' }}
                                                ><Ban size={12} /></button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ===================== AUTOMOD ===================== */}
                    {activeTab === 'automod' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Auto-Moderation</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Automatically detect and block unwanted content before it's posted.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {automodRules.map(rule => (
                                    <div key={rule.id} style={{ background: 'var(--bg-elevated)', border: `1px solid ${rule.enabled ? 'var(--success)' : 'var(--stroke)'}`, borderRadius: '12px', padding: '24px', transition: 'border-color 0.2s' }}>
                                        {editingRule === rule.id ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div>
                                                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Rule Name</label>
                                                    <input type="text" value={editRuleName} onChange={e => setEditRuleName(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} autoFocus />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Keywords (comma-separated)</label>
                                                    <input type="text" value={editRuleKeywords} onChange={e => setEditRuleKeywords(e.target.value)} placeholder="e.g. spam, scam, phishing" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Action</label>
                                                    <select value={editRuleAction} onChange={e => setEditRuleAction(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}>
                                                        <option value="Delete Message">Delete Message</option>
                                                    </select>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => saveRuleEdit(rule.id)} style={{ background: 'var(--accent-primary)', border: 'none', padding: '8px 20px', borderRadius: '6px', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Save Rule</button>
                                                    <button onClick={() => setEditingRule(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '8px 20px', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                                                    <button onClick={async () => { if (guildId) { try { await api.workflows.delete(guildId, rule.id); } catch {} } setAutomodRules(prev => prev.filter(r => r.id !== rule.id)); setEditingRule(null); }} style={{ background: 'transparent', border: '1px solid var(--error)', padding: '8px 16px', borderRadius: '6px', color: 'var(--error)', fontWeight: 600, cursor: 'pointer', fontSize: '13px', marginLeft: 'auto' }}>Delete</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                    <div>
                                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            {rule.name}
                                                            {!rule.isBuiltIn && <span style={{ fontSize: '11px', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)' }}>Custom</span>}
                                                        </h3>
                                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{rule.desc}</p>
                                                    </div>
                                                    <div onClick={() => toggleAutomodRule(rule.id)}
                                                        style={{ width: '40px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer', flexShrink: 0, background: rule.enabled ? 'var(--success)' : 'var(--bg-tertiary)', boxShadow: rule.enabled ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none', transition: 'background 0.2s' }}>
                                                        <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', transition: 'left 0.2s', left: rule.enabled ? '19px' : '3px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                                                    </div>
                                                </div>
                                                <div style={{ background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '8px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div><span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Action:</span> {rule.action}</div>
                                                    {!rule.isBuiltIn && (
                                                        <button onClick={() => { setEditingRule(rule.id); setEditRuleName(rule.name); setEditRuleAction(rule.action); setEditRuleKeywords((rule.keywords || []).join(', ')); }}
                                                            onMouseEnter={() => setHoveredBtn(`edit-rule-${rule.id}`)} onMouseLeave={() => setHoveredBtn(null)}
                                                            style={{ background: 'none', border: 'none', color: hoveredBtn === `edit-rule-${rule.id}` ? 'var(--text-primary)' : 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
                                                        ><Edit2 size={12} /> Edit</button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                <button onMouseEnter={() => setHoveredBtn('create-rule')} onMouseLeave={() => setHoveredBtn(null)}
                                    onClick={async () => {
                                        if (!guildId) return;
                                        try {
                                            const created = await api.workflows.create(guildId, {
                                                name: 'New AutoMod Rule',
                                                triggers: [{ type: 'message_contains', config: { keywords: [] } }],
                                                actions: [{ order: 0, type: 'delete_message' }],
                                            });
                                            const newRule = { id: created.id, workflowId: created.id, name: created.name, desc: 'Keywords: none', enabled: created.enabled, action: 'Delete Message', isBuiltIn: false, keywords: [] as string[] };
                                            setAutomodRules(prev => [...prev, newRule]);
                                            setEditingRule(created.id);
                                            setEditRuleName(newRule.name);
                                            setEditRuleAction(newRule.action);
                                            setEditRuleKeywords('');
                                        } catch {
                                            addToast({ title: 'Failed to create rule', variant: 'error' });
                                        }
                                    }}
                                    style={{ padding: '14px', borderRadius: '12px', background: hoveredBtn === 'create-rule' ? 'var(--hover-overlay)' : 'transparent', border: '1px dashed var(--stroke)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600, fontSize: '14px' }}
                                ><Plus size={16} /> Create Custom Rule</button>
                            </div>
                        </>
                    )}

                    {/* ===================== WORD FILTER ===================== */}
                    {activeTab === 'wordfilter' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Word Filter</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Block or filter messages containing specific words or phrases.</p>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>BLOCKED WORDS</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                    {wordFilterWords.map((word, i) => (
                                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: '999px', border: '1px solid var(--stroke)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {word}
                                            <button onClick={() => setWordFilterWords(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>x</button>
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={wordFilterInput}
                                        onChange={e => setWordFilterInput(e.target.value)}
                                        onKeyDown={e => {
                                            if ((e.key === 'Enter' || e.key === ',') && wordFilterInput.trim()) {
                                                e.preventDefault();
                                                const newWord = wordFilterInput.trim().toLowerCase();
                                                if (newWord && !wordFilterWords.includes(newWord)) {
                                                    setWordFilterWords(prev => [...prev, newWord]);
                                                }
                                                setWordFilterInput('');
                                            }
                                        }}
                                        placeholder="Type a word and press Enter"
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}
                                    />
                                    <button
                                        onClick={() => {
                                            const newWord = wordFilterInput.trim().toLowerCase();
                                            if (newWord && !wordFilterWords.includes(newWord)) {
                                                setWordFilterWords(prev => [...prev, newWord]);
                                            }
                                            setWordFilterInput('');
                                        }}
                                        style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                    >Add</button>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>ACTION</label>
                                <select
                                    value={wordFilterAction}
                                    onChange={e => setWordFilterAction(e.target.value as any)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }}
                                >
                                    <option value="block">Block message</option>
                                    <option value="delete">Delete after sending</option>
                                    <option value="warn">Warn user</option>
                                </select>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>What happens when a message contains a blocked word.</p>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>EXEMPT ROLES</label>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Members with these roles will bypass the word filter.</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {roles.map(role => (
                                        <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 0' }}>
                                            <input
                                                type="checkbox"
                                                checked={wordFilterExemptRoles.includes(role.id)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setWordFilterExemptRoles(prev => [...prev, role.id]);
                                                    } else {
                                                        setWordFilterExemptRoles(prev => prev.filter(id => id !== role.id));
                                                    }
                                                }}
                                                style={{ accentColor: 'var(--accent-primary)' }}
                                            />
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                                            {role.name}
                                        </label>
                                    ))}
                                    {roles.length === 0 && (
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No roles loaded. Switch to Roles tab first.</span>
                                    )}
                                </div>
                            </div>

                            {/* Regex Patterns */}
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>REGEX PATTERNS</label>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Advanced: use regular expressions for complex matching.</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                                    {(wordFilterRegexPatterns || []).map((pat: string, i: number) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <code style={{ flex: 1, padding: '6px 10px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--stroke)', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{pat}</code>
                                            <button onClick={() => setWordFilterRegexPatterns((prev: string[]) => prev.filter((_: string, idx: number) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px' }}>x</button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={wordFilterRegexInput || ''}
                                        onChange={e => setWordFilterRegexInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && wordFilterRegexInput?.trim()) {
                                                e.preventDefault();
                                                try {
                                                    new RegExp(wordFilterRegexInput.trim());
                                                    setWordFilterRegexPatterns((prev: string[]) => [...(prev || []), wordFilterRegexInput.trim()]);
                                                    setWordFilterRegexInput('');
                                                } catch {
                                                    addToast({ title: 'Invalid regex pattern', variant: 'error' });
                                                }
                                            }
                                        }}
                                        placeholder="/pattern/ — press Enter to add"
                                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' as const }}
                                    />
                                    <button
                                        onClick={() => {
                                            if (!wordFilterRegexInput?.trim()) return;
                                            try {
                                                new RegExp(wordFilterRegexInput.trim());
                                                setWordFilterRegexPatterns((prev: string[]) => [...(prev || []), wordFilterRegexInput.trim()]);
                                                setWordFilterRegexInput('');
                                            } catch {
                                                addToast({ title: 'Invalid regex pattern', variant: 'error' });
                                            }
                                        }}
                                        style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                                    >Add</button>
                                </div>

                                {/* Test regex */}
                                <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                    <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>TEST YOUR PATTERNS</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input
                                            type="text"
                                            value={wordFilterTestInput || ''}
                                            onChange={e => setWordFilterTestInput(e.target.value)}
                                            placeholder="Enter sample text to test..."
                                            style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' as const }}
                                        />
                                        <button
                                            onClick={async () => {
                                                if (!guildId || !wordFilterTestInput?.trim()) return;
                                                try {
                                                    const result = await api.wordFilterTest.test(guildId, wordFilterTestInput.trim(), wordFilterTestInput.trim());
                                                    setWordFilterTestResult(result);
                                                } catch {
                                                    addToast({ title: 'Test failed', variant: 'error' });
                                                }
                                            }}
                                            style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--accent-primary)', border: 'none', color: '#000', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                        >Test</button>
                                    </div>
                                    {wordFilterTestResult && (
                                        <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '6px', background: wordFilterTestResult.blocked ? 'rgba(237,66,69,0.1)' : 'rgba(87,242,135,0.1)', fontSize: '12px', color: wordFilterTestResult.blocked ? 'var(--error)' : '#57f287' }}>
                                            {wordFilterTestResult.blocked ? `Blocked — matched: ${wordFilterTestResult.matchedWords?.join(', ') || wordFilterTestResult.matchedPattern || 'unknown'}` : 'Passed — no matches found'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                disabled={wordFilterSaving}
                                onClick={async () => {
                                    if (!guildId) return;
                                    setWordFilterSaving(true);
                                    try {
                                        await api.put(`/guilds/${guildId}/word-filter`, { words: wordFilterWords, action: wordFilterAction, exemptRoles: wordFilterExemptRoles, regexPatterns: wordFilterRegexPatterns || [] });
                                        addToast({ title: 'Word filter saved', variant: 'success' });
                                    } catch {
                                        addToast({ title: 'Failed to save word filter', variant: 'error' });
                                    } finally {
                                        setWordFilterSaving(false);
                                    }
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', background: wordFilterSaving ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none', color: wordFilterSaving ? 'var(--text-muted)' : '#000', fontWeight: 700, fontSize: '14px', cursor: wordFilterSaving ? 'default' : 'pointer' }}
                            >
                                <Save size={16} /> {wordFilterSaving ? 'Saving...' : 'Save Word Filter'}
                            </button>
                        </>
                    )}

                    {/* ===================== SECURITY (Raid Protection) ===================== */}
                    {activeTab === 'security' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Security</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Protect your server from raids and automated attacks.</p>

                            {guildLocked && (
                                <div style={{ background: 'rgba(237,66,69,0.1)', border: '1px solid var(--error)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Lock size={20} color="var(--error)" />
                                        <div>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--error)' }}>Server is Locked</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No new members can join until the lockdown is lifted.</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!guildId) return;
                                            try {
                                                await api.delete(`/guilds/${guildId}/lock`);
                                                setGuildLocked(false);
                                                addToast({ title: 'Server unlocked', variant: 'success' });
                                            } catch {
                                                addToast({ title: 'Failed to unlock', variant: 'error' });
                                            }
                                        }}
                                        style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                                    >Unlock Server</button>
                                </div>
                            )}

                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Default notifications for new members</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    When someone joins, their per-server notification level is set to this if they have not chosen one yet. Members can always override in the channel list.
                                </p>
                                <select
                                    value={defaultMemberNotificationLevel ?? ''}
                                    disabled={defaultNotifSaving}
                                    onChange={async (e) => {
                                        if (!guildId) return;
                                        const raw = e.target.value;
                                        const next = raw === '' ? null : (raw as 'all' | 'mentions' | 'nothing');
                                        setDefaultNotifSaving(true);
                                        setDefaultMemberNotificationLevel(next);
                                        try {
                                            await api.guilds.update(guildId, { defaultMemberNotificationLevel: next } as any);
                                            addToast({ title: next ? `Default set to ${next === 'all' ? 'all messages' : next === 'mentions' ? 'mentions only' : 'nothing'}` : 'Server default cleared', variant: 'success' });
                                        } catch {
                                            addToast({ title: 'Failed to update default notifications', variant: 'error' });
                                            api.guilds.get(guildId).then((g: any) => {
                                                const d = g.defaultMemberNotificationLevel;
                                                setDefaultMemberNotificationLevel(
                                                    d === 'all' || d === 'mentions' || d === 'nothing' ? d : null,
                                                );
                                            }).catch(() => {});
                                        } finally {
                                            setDefaultNotifSaving(false);
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        maxWidth: '320px',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--stroke)',
                                        background: 'var(--bg-tertiary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '14px',
                                    }}
                                >
                                    <option value="">No server default (use client default)</option>
                                    <option value="all">All messages</option>
                                    <option value="mentions">Only @mentions</option>
                                    <option value="nothing">Nothing</option>
                                </select>
                            </div>

                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Public Server Stats</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Allow anyone to view server statistics at a public URL. Shows member count, message activity, and more.</p>
                                    </div>
                                    <div
                                        onClick={async () => {
                                            if (!guildId || publicStatsSaving) return;
                                            setPublicStatsSaving(true);
                                            const newVal = !publicStatsEnabled;
                                            setPublicStatsEnabled(newVal);
                                            try {
                                                await api.guilds.update(guildId, { publicStatsEnabled: newVal } as any);
                                                addToast({ title: newVal ? 'Public stats enabled' : 'Public stats disabled', variant: 'success' });
                                            } catch {
                                                setPublicStatsEnabled(!newVal);
                                                addToast({ title: 'Failed to update', variant: 'error' });
                                            } finally {
                                                setPublicStatsSaving(false);
                                            }
                                        }}
                                        style={{ width: '40px', height: '24px', borderRadius: '12px', position: 'relative', cursor: publicStatsSaving ? 'wait' : 'pointer', flexShrink: 0, background: publicStatsEnabled ? 'var(--success)' : 'var(--bg-tertiary)', transition: 'background 0.2s' }}
                                    >
                                        <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', transition: 'left 0.2s', left: publicStatsEnabled ? '19px' : '3px' }} />
                                    </div>
                                </div>
                                {publicStatsEnabled && (
                                    <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        Stats page: <a href={`/app/guild/${guildId}/stats`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>/guild/{guildId}/stats</a>
                                    </div>
                                )}
                            </div>

                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Raid Protection</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Automatically lock the server if more than 10 users join within 10 seconds.</p>
                                    </div>
                                    <div
                                        onClick={async () => {
                                            if (!guildId || raidSaving) return;
                                            setRaidSaving(true);
                                            const newVal = !raidProtectionEnabled;
                                            setRaidProtectionEnabled(newVal);
                                            try {
                                                await api.guilds.update(guildId, { raidProtectionEnabled: newVal } as any);
                                                addToast({ title: newVal ? 'Raid protection enabled' : 'Raid protection disabled', variant: 'success' });
                                            } catch {
                                                setRaidProtectionEnabled(!newVal);
                                                addToast({ title: 'Failed to update', variant: 'error' });
                                            } finally {
                                                setRaidSaving(false);
                                            }
                                        }}
                                        style={{ width: '40px', height: '24px', borderRadius: '12px', position: 'relative', cursor: raidSaving ? 'wait' : 'pointer', flexShrink: 0, background: raidProtectionEnabled ? 'var(--success)' : 'var(--bg-tertiary)', transition: 'background 0.2s' }}
                                    >
                                        <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', transition: 'left 0.2s', left: raidProtectionEnabled ? '19px' : '3px' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Raid Protection Status Indicator (Item 36) */}
                            {raidProtectionEnabled && (
                                <div style={{
                                    background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)',
                                    borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                }}>
                                    <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>Raid Protection Active</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            Auto-verification for new joins enabled. Slowmode activated on all channels during raids.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Verification Requirements (Item 29) */}
                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Verification Requirements</h3>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Set minimum verification level required to participate.</p>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {[
                                        { level: 0, label: 'None', desc: 'Unrestricted' },
                                        { level: 1, label: 'Low', desc: 'Email verified' },
                                        { level: 2, label: 'Medium', desc: 'Registered > 5 min' },
                                        { level: 3, label: 'High', desc: 'Member > 10 min' },
                                    ].map(v => (
                                        <div key={v.level} style={{
                                            padding: '8px 14px', borderRadius: '8px', cursor: 'pointer',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                            textAlign: 'center',
                                        }}>
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{v.label}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{v.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Emergency Lockdown (Item 35 - enhanced) */}
                            {!guildLocked && (
                                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--error)' }}>Emergency Lockdown</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                        Immediately lock the server. Non-admin members will be unable to send messages. New joins will be blocked.
                                    </p>
                                    <button
                                        onClick={async () => {
                                            if (!guildId) return;
                                            if (!confirm('Are you sure you want to lock down the server? Non-admin messaging will be disabled.')) return;
                                            try {
                                                await api.post(`/guilds/${guildId}/lock`, {});
                                                setGuildLocked(true);
                                                addToast({ title: 'Server locked', description: 'Emergency lockdown activated.', variant: 'success' });
                                            } catch {
                                                addToast({ title: 'Failed to lock server', variant: 'error' });
                                            }
                                        }}
                                        style={{
                                            padding: '10px 24px', borderRadius: '8px',
                                            background: 'var(--error)', border: 'none', color: '#fff',
                                            fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                        }}
                                    >
                                        <Lock size={16} /> Activate Lockdown
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* ===================== AUDIT LOG ===================== */}
                    {activeTab === 'audit' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Audit Log</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Track every action taken in your server. {auditLog.length} entries recorded.</p>

                            {/* Enhanced Audit Log Filters (Item 34) */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                {(['all', 'role', 'channel', 'member', 'settings', 'message'] as const).map(filter => (
                                    <button key={filter} onClick={() => setAuditFilter(filter)}
                                        onMouseEnter={() => setHoveredBtn(`filter-${filter}`)} onMouseLeave={() => setHoveredBtn(null)}
                                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', border: 'none', background: auditFilter === filter ? 'var(--accent-primary)' : hoveredBtn === `filter-${filter}` ? 'var(--hover-overlay)' : 'var(--bg-tertiary)', color: auditFilter === filter ? '#000' : 'var(--text-secondary)' }}
                                    >{filter === 'all' ? `All (${auditLog.length})` : filter}</button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ position: 'relative', flex: 1, minWidth: '160px' }}>
                                    <Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: 'var(--text-muted)' }} />
                                    <input type="text" placeholder="Search by user or action..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} style={{
                                        width: '100%', padding: '6px 8px 6px 28px', borderRadius: '6px',
                                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box',
                                    }} />
                                </div>
                                <input type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} style={{
                                    padding: '6px 8px', borderRadius: '6px',
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                    color: 'var(--text-primary)', fontSize: '12px',
                                }} />
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
                                <input type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} style={{
                                    padding: '6px 8px', borderRadius: '6px',
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                    color: 'var(--text-primary)', fontSize: '12px',
                                }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {filteredAudit.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '14px' }}>No entries for this filter yet.</div>
                                )}
                                {filteredAudit.map(entry => (
                                    <div key={entry.id} onMouseEnter={() => setHoveredBtn(`audit-${entry.id}`)} onMouseLeave={() => setHoveredBtn(null)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px', borderRadius: '10px', background: hoveredBtn === `audit-${entry.id}` ? 'var(--hover-overlay)' : 'var(--bg-elevated)', border: '1px solid var(--stroke)' }}
                                    >
                                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
                                            {auditTypeIcons[entry.type]}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                                <span style={{ color: 'var(--accent-primary)' }}>{entry.user}</span>
                                                <span style={{ color: 'var(--text-secondary)' }}> — {entry.action}</span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.target}</div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                            <Clock size={12} /> {entry.timestamp}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ===================== BANS ===================== */}
                    {activeTab === 'bans' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Bans</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                                View and manage banned users. {bans.length} user{bans.length !== 1 ? 's' : ''} currently banned.
                            </p>

                            {bansLoading ? (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    <div style={{ marginBottom: '12px', opacity: 0.5 }}><RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
                                    Loading bans...
                                </div>
                            ) : bans.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}><UserX size={40} /></div>
                                    <p style={{ fontSize: '14px', fontWeight: 500 }}>No banned users</p>
                                    <p style={{ fontSize: '12px', marginTop: '4px' }}>When you ban a member, they will appear here.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {bans.map(ban => (
                                        <div key={ban.userId}
                                            onMouseEnter={() => setHoveredBtn(`ban-${ban.userId}`)}
                                            onMouseLeave={() => setHoveredBtn(null)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 16px',
                                                borderRadius: '10px', border: '1px solid var(--stroke)',
                                                background: hoveredBtn === `ban-${ban.userId}` ? 'var(--hover-overlay)' : 'var(--bg-elevated)',
                                            }}
                                        >
                                            <Avatar
                                                userId={ban.userId}
                                                avatarHash={ban.avatarHash}
                                                displayName={ban.displayName}
                                                size={36}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{ban.displayName}</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{ban.username}</span>
                                                </div>
                                                {ban.reason && (
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        Reason: {ban.reason}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={12} /> {ban.bannedAt}
                                                </span>
                                                <button
                                                    onClick={() => setConfirmDialog({ title: 'Unban Member', description: `Are you sure you want to unban ${ban.displayName}? They will be able to rejoin the server.`, onConfirm: () => handleUnban(ban.userId) })}
                                                    onMouseEnter={() => setHoveredBtn(`unban-${ban.userId}`)}
                                                    onMouseLeave={() => setHoveredBtn(`ban-${ban.userId}`)}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                                                        cursor: 'pointer', border: 'none',
                                                        background: hoveredBtn === `unban-${ban.userId}` ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                        color: hoveredBtn === `unban-${ban.userId}` ? '#000' : 'var(--text-secondary)',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    Unban
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pending Ban Appeals */}
                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '24px 0' }} />
                            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Pending Appeals</h3>
                            {appealsLoading ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading appeals...</div>
                            ) : banAppeals.filter(a => a.status === 'pending').length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>No pending ban appeals.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {banAppeals.filter(a => a.status === 'pending').map(appeal => (
                                        <div key={appeal.userId} style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--stroke)', background: 'var(--bg-elevated)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                <Avatar userId={appeal.userId} avatarHash={appeal.avatarHash} displayName={appeal.displayName} size={32} />
                                                <div>
                                                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{appeal.displayName}</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>@{appeal.username}</span>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                                                {appeal.text}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await api.patch(`/guilds/${guildId}/bans/${appeal.userId}/appeal`, { status: 'approved' });
                                                            setBanAppeals(prev => prev.map(a => a.userId === appeal.userId ? { ...a, status: 'approved' } : a));
                                                            addToast({ title: 'Appeal approved', variant: 'success' });
                                                        } catch { addToast({ title: 'Failed to approve appeal', variant: 'error' }); }
                                                    }}
                                                    style={{ padding: '6px 14px', borderRadius: '6px', background: '#10b981', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await api.patch(`/guilds/${guildId}/bans/${appeal.userId}/appeal`, { status: 'denied' });
                                                            setBanAppeals(prev => prev.map(a => a.userId === appeal.userId ? { ...a, status: 'denied' } : a));
                                                            addToast({ title: 'Appeal denied', variant: 'info' });
                                                        } catch { addToast({ title: 'Failed to deny appeal', variant: 'error' }); }
                                                    }}
                                                    style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                >
                                                    Deny
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ===================== EMOJIS ===================== */}
                    {activeTab === 'emojis' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Custom Emojis</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                                Add custom emojis that anyone in this server can use with <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>:name:</code> syntax. ({customEmojis.length}/50 used)
                            </p>

                            {/* Upload Section */}
                            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>Upload Emoji</div>

                                {!emojiFileToUpload ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <button
                                            onClick={() => emojiInputRef.current?.click()}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--accent-primary)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                                        >
                                            <Upload size={14} /> Upload Image
                                        </button>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            PNG, GIF, or JPG. Max 256KB, 128x128px recommended.
                                        </div>
                                        <input type="file" ref={emojiInputRef} hidden accept="image/png,image/gif,image/jpeg,image/jpg" onChange={e => {
                                            const f = e.target.files?.[0];
                                            if (f) handleEmojiFileSelect(f);
                                            e.target.value = '';
                                        }} />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                        {/* Preview */}
                                        <div style={{ width: '64px', height: '64px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                            {emojiFilePreview && <img src={emojiFilePreview} alt="preview" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                                                Emoji Name (alphanumeric, 2+ chars)
                                            </label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px' }}>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>:</span>
                                                <input
                                                    type="text"
                                                    value={emojiNameInput}
                                                    onChange={e => setEmojiNameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                                                    placeholder="emoji_name"
                                                    style={{ flex: 1, height: '34px', background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                                                />
                                                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>:</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={handleUploadEmoji}
                                                    disabled={emojiUploading || !emojiNameInput.trim()}
                                                    style={{ padding: '8px 16px', background: emojiNameInput.trim() && !emojiUploading ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: emojiNameInput.trim() && !emojiUploading ? '#000' : 'var(--text-muted)', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: emojiNameInput.trim() && !emojiUploading ? 'pointer' : 'default' }}
                                                >
                                                    {emojiUploading ? 'Uploading...' : 'Upload'}
                                                </button>
                                                <button
                                                    onClick={() => { setEmojiFileToUpload(null); setEmojiNameInput(''); setEmojiFilePreview(null); }}
                                                    style={{ padding: '8px 16px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{50 - customEmojis.length} slots remaining</span>
                                    <span>Members need "Manage Emojis" permission to upload</span>
                                </div>
                            </div>

                            {/* Category Management */}
                            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>Emoji Categories</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                    {emojiCategories.map(cat => (
                                        <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '4px 10px', fontSize: '13px' }}>
                                            {editingCatId === cat.id ? (
                                                <input
                                                    value={editingCatName}
                                                    onChange={e => setEditingCatName(e.target.value)}
                                                    onBlur={async () => {
                                                        if (editingCatName.trim() && editingCatName.trim() !== cat.name && guildId) {
                                                            await api.guilds.updateEmojiCategory(guildId, cat.id, { name: editingCatName.trim() });
                                                            setEmojiCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: editingCatName.trim() } : c));
                                                        }
                                                        setEditingCatId(null);
                                                    }}
                                                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                    autoFocus
                                                    style={{ width: '100px', height: '24px', background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '4px', color: 'var(--text-primary)', padding: '0 6px', fontSize: '12px', outline: 'none' }}
                                                />
                                            ) : (
                                                <span
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                                                    title="Click to rename"
                                                >{cat.name}</span>
                                            )}
                                            <button
                                                onClick={() => setConfirmDialog({ title: 'Delete Emoji Category', description: `Are you sure you want to delete the "${cat.name}" category? Emojis in this category will become uncategorized.`, onConfirm: async () => {
                                                    if (!guildId) return;
                                                    await api.guilds.deleteEmojiCategory(guildId, cat.id);
                                                    setEmojiCategories(prev => prev.filter(c => c.id !== cat.id));
                                                    setCustomEmojis(prev => prev.map(e => e.categoryId === cat.id ? { ...e, categoryId: null } : e));
                                                    addToast({ title: `Category "${cat.name}" deleted`, variant: 'success' });
                                                } })}
                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', display: 'flex' }}
                                                title="Delete category"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={newCatName}
                                        onChange={e => setNewCatName(e.target.value)}
                                        placeholder="New category name..."
                                        maxLength={32}
                                        style={{ flex: 1, height: '32px', background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                                        onKeyDown={async e => {
                                            if (e.key === 'Enter' && newCatName.trim() && guildId) {
                                                const cat = await api.guilds.createEmojiCategory(guildId, { name: newCatName.trim() });
                                                setEmojiCategories(prev => [...prev, cat]);
                                                setNewCatName('');
                                                addToast({ title: `Category "${cat.name}" created`, variant: 'success' });
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!newCatName.trim() || !guildId) return;
                                            const cat = await api.guilds.createEmojiCategory(guildId, { name: newCatName.trim() });
                                            setEmojiCategories(prev => [...prev, cat]);
                                            setNewCatName('');
                                            addToast({ title: `Category "${cat.name}" created`, variant: 'success' });
                                        }}
                                        disabled={!newCatName.trim()}
                                        style={{ padding: '6px 14px', background: newCatName.trim() ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: 'none', borderRadius: '6px', color: newCatName.trim() ? '#000' : 'var(--text-muted)', fontSize: '13px', fontWeight: 600, cursor: newCatName.trim() ? 'pointer' : 'default' }}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Category Filter Tabs */}
                            {emojiCategories.length > 0 && customEmojis.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => setSelectedEmojiCategory('all')}
                                        style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: selectedEmojiCategory === 'all' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: selectedEmojiCategory === 'all' ? '#000' : 'var(--text-secondary)' }}
                                    >All</button>
                                    <button
                                        onClick={() => setSelectedEmojiCategory('uncategorized')}
                                        style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: selectedEmojiCategory === 'uncategorized' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: selectedEmojiCategory === 'uncategorized' ? '#000' : 'var(--text-secondary)' }}
                                    >Uncategorized</button>
                                    {emojiCategories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedEmojiCategory(cat.id)}
                                            style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: selectedEmojiCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: selectedEmojiCategory === cat.id ? '#000' : 'var(--text-secondary)' }}
                                        >{cat.name}</button>
                                    ))}
                                </div>
                            )}

                            {/* Existing Emojis Grid */}
                            {customEmojis.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>😶</div>
                                    <p style={{ fontSize: '14px', fontWeight: 500 }}>No custom emojis yet</p>
                                    <p style={{ fontSize: '12px' }}>Upload some to give your server personality!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                                    {customEmojis
                                        .filter(emoji => {
                                            if (selectedEmojiCategory === 'all') return true;
                                            if (selectedEmojiCategory === 'uncategorized') return !emoji.categoryId;
                                            return emoji.categoryId === selectedEmojiCategory;
                                        })
                                        .map(emoji => (
                                        <div key={emoji.id || emoji.name} onMouseEnter={() => setHoveredBtn(`emoji-${emoji.name}`)} onMouseLeave={() => setHoveredBtn(null)}
                                            style={{ background: hoveredBtn === `emoji-${emoji.name}` ? 'var(--hover-overlay)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative', transition: 'background 0.15s' }}
                                        >
                                            <img src={emoji.url} alt={emoji.name} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'contain' }} />
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>:{emoji.name}:</div>
                                            {/* Category selector */}
                                            {emojiCategories.length > 0 && (
                                                <select
                                                    value={emoji.categoryId || ''}
                                                    onChange={async e => {
                                                        const newCatId = e.target.value || null;
                                                        if (!guildId || !emoji.id) return;
                                                        await api.guilds.updateEmoji(guildId, emoji.id, { categoryId: newCatId });
                                                        setCustomEmojis(prev => prev.map(em => em.id === emoji.id ? { ...em, categoryId: newCatId } : em));
                                                    }}
                                                    onClick={e => e.stopPropagation()}
                                                    style={{ width: '100%', fontSize: '10px', background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '4px', color: 'var(--text-secondary)', padding: '2px 4px', outline: 'none', cursor: 'pointer' }}
                                                >
                                                    <option value="">Uncategorized</option>
                                                    {emojiCategories.map(cat => (
                                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {hoveredBtn === `emoji-${emoji.name}` && (
                                                <button onClick={() => setConfirmDialog({ title: 'Delete Emoji', description: `Are you sure you want to delete :${emoji.name}:? This cannot be undone.`, onConfirm: () => handleDeleteEmoji(emoji.id, emoji.name) })}
                                                    aria-label="Delete emoji"
                                                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(237,66,69,0.85)', border: 'none', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                                                    <X size={10} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ===================== WEBHOOKS ===================== */}
                    {activeTab === 'webhooks' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Webhooks</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Create webhooks to post automated messages from external services into your channels.</p>

                            <button onClick={() => setShowCreateWebhook(!showCreateWebhook)}
                                onMouseEnter={() => setHoveredBtn('create-wh')} onMouseLeave={() => setHoveredBtn(null)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', background: showCreateWebhook ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none', color: showCreateWebhook ? 'var(--text-primary)' : '#000', fontWeight: 600, fontSize: '13px', cursor: 'pointer', marginBottom: '24px' }}
                            >
                                <Plus size={16} /> {showCreateWebhook ? 'Cancel' : 'Create Webhook'}
                            </button>

                            {showCreateWebhook && (
                                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Webhook Name</label>
                                            <input type="text" value={newWebhookName} onChange={e => setNewWebhookName(e.target.value)} placeholder="e.g. GitHub Alerts" style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px' }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Channel</label>
                                            <select value={newWebhookChannel} onChange={e => setNewWebhookChannel(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', appearance: 'none' }}>
                                                {channelsList.filter(c => c.type === 'GUILD_TEXT' || c.type === 'text').length === 0 ? (
                                                    <option value="">No text channels</option>
                                                ) : (
                                                    channelsList.filter(c => c.type === 'GUILD_TEXT' || c.type === 'text').map(c => (
                                                        <option key={c.id} value={`#${c.name}`}>#{c.name}</option>
                                                    ))
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                    <button onClick={async () => {
                                        if (!newWebhookName.trim()) return;
                                        const channelName = newWebhookChannel.replace(/^#/, '');
                                        const channel = channelsList.find(c => c.name === channelName);
                                        if (!channel) return;
                                        setWebhookCreating(true);
                                        try {
                                            const created = await api.webhooks.create({ channelId: channel.id, name: newWebhookName });
                                            const newWh = { id: created.id ?? `wh${Date.now()}`, name: created.name ?? newWebhookName, channel: newWebhookChannel, channelId: channel.id, token: created.token ?? 'Token generated by server', avatar: '#526df5', createdAt: 'Just now' };
                                            setWebhooksList(prev => [...prev, newWh]);
                                            addAuditEntry('Webhook Created', actorName, newWebhookName, 'settings');
                                            setNewWebhookName(''); setShowCreateWebhook(false);
                                        } catch (err: any) {
                                            addToast({ title: 'Failed to create webhook', description: err?.message || 'Could not create webhook.', variant: 'error' });
                                        } finally {
                                            setWebhookCreating(false);
                                        }
                                    }} disabled={webhookCreating} style={{ padding: '10px 24px', borderRadius: '6px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, fontSize: '13px', cursor: webhookCreating ? 'not-allowed' : 'pointer', opacity: webhookCreating ? 0.6 : 1 }}>
                                        {webhookCreating ? 'Creating...' : 'Create'}
                                    </button>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {webhooksList.map(wh => (
                                    <div key={wh.id}>
                                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: wh.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Link2 size={20} color="white" />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{wh.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Posts to {wh.channel} &middot; Created {wh.createdAt}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{`${API_BASE}/webhooks/${wh.id}/${'•'.repeat(12)}`}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => { const apiHost = API_BASE; const url = `${apiHost}/webhooks/${wh.id}/${wh.token}`; copyToClipboard(url); setCopiedWebhookId(wh.id); setTimeout(() => setCopiedWebhookId(null), 2000); }}
                                                title="Copy Webhook URL"
                                                aria-label="Copy webhook URL"
                                                style={{ padding: '8px', borderRadius: '6px', background: copiedWebhookId === wh.id ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: copiedWebhookId === wh.id ? 'var(--success)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                                {copiedWebhookId === wh.id ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                            <button onClick={() => { addToast({ title: 'Token Regeneration', description: 'Webhook tokens are managed by the server. Delete and recreate the webhook to get a new token.', variant: 'info' }); }}
                                                title="Regenerate Token"
                                                aria-label="Regenerate token"
                                                style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                                <RefreshCw size={16} />
                                            </button>
                                            <button onClick={async () => {
                                                if (viewDeliveriesId === wh.id) { setViewDeliveriesId(null); return; }
                                                try {
                                                    const logs = await api.webhooks.getDeliveries(wh.id);
                                                    setDeliveryLogs(logs);
                                                    setViewDeliveriesId(wh.id);
                                                } catch { setDeliveryLogs([]); setViewDeliveriesId(wh.id); }
                                            }}
                                                title="View Delivery Logs"
                                                aria-label="View delivery logs"
                                                style={{ padding: '8px', borderRadius: '6px', background: viewDeliveriesId === wh.id ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: viewDeliveriesId === wh.id ? 'var(--accent-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                                <Activity size={16} />
                                            </button>
                                            <button onClick={() => setConfirmDialog({ title: 'Delete Webhook', description: `Are you sure you want to delete the webhook "${wh.name}"? Any integrations using this webhook will stop working.`, onConfirm: async () => { try { await api.webhooks.delete(wh.id); } catch {} setWebhooksList(prev => prev.filter(w => w.id !== wh.id)); addAuditEntry('Webhook Deleted', actorName, wh.name, 'settings'); } })}
                                                title="Delete Webhook"
                                                aria-label="Delete webhook"
                                                style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    {viewDeliveriesId === wh.id && (
                                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--stroke)', borderRadius: '0 0 12px 12px', marginTop: '-12px', padding: '16px 20px' }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Recent Deliveries</div>
                                            {deliveryLogs.length === 0 ? (
                                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No delivery logs yet.</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflow: 'auto' }}>
                                                    {deliveryLogs.map(log => (
                                                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '12px' }}>
                                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: log.success ? 'var(--success, #22c55e)' : 'var(--error, #ed4245)', flexShrink: 0 }} />
                                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '100px' }}>{log.eventType}</span>
                                                            <span style={{ color: 'var(--text-muted)' }}>{log.responseStatus ?? '---'}</span>
                                                            <span style={{ color: 'var(--text-muted)' }}>{log.durationMs != null ? `${log.durationMs}ms` : ''}</span>
                                                            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(log.attemptedAt).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    </div>
                                ))}

                                {webhooksList.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                        <Link2 size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                        <p style={{ fontSize: '14px', fontWeight: 600 }}>No webhooks yet</p>
                                        <p style={{ fontSize: '13px', marginTop: '4px' }}>Create one to start receiving external notifications.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ===================== INSTALLED BOTS ===================== */}
                    {activeTab === 'bots' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Installed Bots</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Manage bots installed in this guild. Visit the Bot Store to discover and add new bots.</p>

                            <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
                                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{installedBots.length}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Installed</div>
                                </div>
                                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--success)' }}>{installedBots.filter(b => b.status === 'active').length}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active</div>
                                </div>
                                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{installedBots.reduce((sum, b) => sum + b.commands, 0)}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Commands</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {installedBots.map(bot => (
                                    <div key={bot.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: bot.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Bot size={24} color="white" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '15px' }}>{bot.name}</span>
                                                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: bot.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: bot.status === 'active' ? 'var(--success)' : '#f59e0b' }}>
                                                    {bot.status === 'active' ? 'Active' : 'Paused'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                Prefix: <code style={{ background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono, monospace)' }}>{bot.prefix}</code> &middot; {bot.commands} commands &middot; Installed {bot.installedAt}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => setInstalledBots(prev => prev.map(b => b.id === bot.id ? { ...b, status: b.status === 'active' ? 'paused' : 'active' } : b))}
                                                title={bot.status === 'active' ? 'Pause Bot' : 'Activate Bot'}
                                                style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: bot.status === 'active' ? 'var(--warning)' : 'var(--success)', display: 'flex', alignItems: 'center' }}>
                                                <Power size={16} />
                                            </button>
                                            <button title="Configure"
                                                onClick={() => addAuditEntry('Bot Configuration Opened', actorName, bot.name, 'settings')}
                                                style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                                <Sliders size={16} />
                                            </button>
                                            <button onClick={() => { setInstalledBots(prev => prev.filter(b => b.id !== bot.id)); addAuditEntry('Bot Uninstalled', actorName, bot.name, 'settings'); }}
                                                title="Uninstall Bot"
                                                style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {installedBots.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                        <Bot size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                        <p style={{ fontSize: '14px', fontWeight: 600 }}>No bots installed</p>
                                        <p style={{ fontSize: '13px', marginTop: '4px' }}>Use /invite to add bots to this server.</p>
                                    </div>
                                )}
                            </div>

                            {/* No-Code Bot Builder (Item 100) */}
                            <div style={{ marginTop: '32px', borderTop: '1px solid var(--stroke)', paddingTop: '24px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>No-Code Automations</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Create auto-responses and welcome messages without writing code.</p>
                                {guildId && <NoCodeBotBuilder guildId={guildId} channels={channelsList} roles={roles} onSave={async (config) => {
                                    try {
                                        await api.put(`/guilds/${guildId}/bot-config`, config);
                                        addToast({ title: 'Bot configuration saved', variant: 'success' });
                                    } catch {
                                        addToast({ title: 'Failed to save configuration', variant: 'error' });
                                    }
                                }} />}
                            </div>
                        </>
                    )}

                    {/* ===================== INVITES ===================== */}
                    {activeTab === 'invites' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Invites</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Manage active invite links for this server.</p>

                            {invitesLoading ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    <RefreshCw size={16} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                                    Loading invites...
                                </div>
                            ) : invites.length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                    <Link2 size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>No active invites</span>
                                    <span style={{ fontSize: '12px', marginTop: '4px' }}>Create an invite from a channel to get started.</span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {/* Header row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 100px 140px 140px 80px', gap: '12px', padding: '8px 12px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', borderBottom: '1px solid var(--stroke)' }}>
                                        <span>Invite Code</span>
                                        <span>Created By</span>
                                        <span>Uses</span>
                                        <span>Expires</span>
                                        <span>Created</span>
                                        <span></span>
                                    </div>
                                    {invites.map(inv => (
                                        <div key={inv.code}
                                            onMouseEnter={() => setHoveredBtn(`invite-${inv.code}`)}
                                            onMouseLeave={() => setHoveredBtn(null)}
                                            style={{
                                                display: 'grid', gridTemplateColumns: '1fr 120px 100px 140px 140px 80px', gap: '12px', padding: '10px 12px', alignItems: 'center',
                                                borderRadius: '6px', fontSize: '13px',
                                                background: hoveredBtn === `invite-${inv.code}` ? 'var(--hover-overlay)' : 'transparent',
                                            }}
                                        >
                                            <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '13px' }}>{inv.code}</span>
                                            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.inviterName}</span>
                                            <span style={{ color: 'var(--text-secondary)' }}>{inv.uses}{inv.maxUses != null ? ` / ${inv.maxUses}` : ''}</span>
                                            <span style={{ color: inv.expiresAt ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: '12px' }}>
                                                {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                                            </span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                                {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                            </span>
                                            <button
                                                onClick={() => handleRevokeInvite(inv.code)}
                                                disabled={inviteRevoking === inv.code}
                                                onMouseEnter={() => setHoveredBtn(`revoke-${inv.code}`)}
                                                onMouseLeave={() => setHoveredBtn(`invite-${inv.code}`)}
                                                style={{
                                                    background: hoveredBtn === `revoke-${inv.code}` ? 'rgba(239,68,68,0.15)' : 'transparent',
                                                    border: '1px solid var(--stroke)', borderRadius: '4px', padding: '4px 10px',
                                                    color: 'var(--error)', cursor: inviteRevoking === inv.code ? 'not-allowed' : 'pointer',
                                                    fontSize: '12px', fontWeight: 600, opacity: inviteRevoking === inv.code ? 0.5 : 1,
                                                    transition: 'background 0.15s',
                                                }}
                                            >
                                                {inviteRevoking === inv.code ? '...' : 'Revoke'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ===================== TEMPLATES ===================== */}
                    {activeTab === 'templates' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Server Templates</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Create templates from your server that others can use to create new servers.</p>

                            {/* Create Template Form */}
                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>Create Template</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <input
                                        type="text"
                                        value={newTemplateName}
                                        onChange={e => setNewTemplateName(e.target.value)}
                                        placeholder="Template name"
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                    <textarea
                                        value={newTemplateDesc}
                                        onChange={e => setNewTemplateDesc(e.target.value)}
                                        placeholder="Description (optional)"
                                        rows={2}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!guildId || !newTemplateName.trim()) return;
                                            setTemplateCreating(true);
                                            try {
                                                const created = await api.guilds.createTemplate(guildId, {
                                                    name: newTemplateName.trim(),
                                                    description: newTemplateDesc.trim() || undefined,
                                                });
                                                setTemplates(prev => [...prev, {
                                                    id: created.id,
                                                    name: created.name || newTemplateName.trim(),
                                                    description: created.description || newTemplateDesc.trim(),
                                                    code: created.code || created.id,
                                                    createdAt: 'Just now',
                                                }]);
                                                setNewTemplateName('');
                                                setNewTemplateDesc('');
                                                addToast({ title: 'Template created', variant: 'success' });
                                            } catch (err: any) {
                                                addToast({ title: 'Failed to create template', description: err?.message, variant: 'error' });
                                            } finally {
                                                setTemplateCreating(false);
                                            }
                                        }}
                                        disabled={templateCreating || !newTemplateName.trim()}
                                        style={{ alignSelf: 'flex-start', padding: '10px 24px', borderRadius: '8px', background: newTemplateName.trim() && !templateCreating ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: 'none', color: newTemplateName.trim() && !templateCreating ? '#000' : 'var(--text-muted)', fontWeight: 600, fontSize: '13px', cursor: newTemplateName.trim() && !templateCreating ? 'pointer' : 'default' }}
                                    >
                                        {templateCreating ? 'Creating...' : 'Create Template'}
                                    </button>
                                </div>
                            </div>

                            {/* Template List */}
                            {templatesLoading ? (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    <RefreshCw size={16} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                                    Loading templates...
                                </div>
                            ) : templates.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                    <p style={{ fontSize: '14px', fontWeight: 500 }}>No templates yet</p>
                                    <p style={{ fontSize: '12px', marginTop: '4px' }}>Create one above to let others clone your server structure.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {templates.map(tmpl => (
                                        <div key={tmpl.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <div>
                                                    <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{tmpl.name}</h3>
                                                    {tmpl.description && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{tmpl.description}</p>}
                                                </div>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tmpl.createdAt}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: '6px', marginBottom: '12px' }}>
                                                <code style={{ flex: 1, fontSize: '13px', fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{tmpl.code}</code>
                                                <button
                                                    onClick={() => { copyToClipboard(tmpl.code); addToast({ title: 'Template code copied', variant: 'info' }); }}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <Copy size={14} />
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={async () => {
                                                        if (!guildId) return;
                                                        try {
                                                            await api.guilds.syncTemplate(guildId, tmpl.code);
                                                            addToast({ title: 'Template synced', variant: 'success' });
                                                        } catch { addToast({ title: 'Failed to sync', variant: 'error' }); }
                                                    }}
                                                    style={{ padding: '6px 16px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                >Sync</button>
                                                <button
                                                    onClick={() => setConfirmDialog({ title: 'Delete Template', description: `Are you sure you want to delete the template "${tmpl.name}"? This cannot be undone.`, onConfirm: async () => {
                                                        if (!guildId) return;
                                                        try {
                                                            await api.guilds.deleteTemplate(guildId, tmpl.code);
                                                            setTemplates(prev => prev.filter(t => t.code !== tmpl.code));
                                                            addToast({ title: 'Template deleted', variant: 'success' });
                                                        } catch { addToast({ title: 'Failed to delete', variant: 'error' }); }
                                                    } })}
                                                    style={{ padding: '6px 16px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                >Delete</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* ===================== BRANDING ===================== */}
                    {activeTab === 'branding' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Brand Identity</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Customize the visual appearance of your Guild.</p>

                            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Guild Banner Background</h3>
                            <div style={{ display: 'flex', gap: '24px', marginBottom: '40px' }}>
                                <div style={{ width: '280px', height: '120px', background: !bannerUrl ? 'linear-gradient(135deg, rgba(82, 109, 245, 0.2), rgba(0,0,0,0.5))' : 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                                    {bannerUrl ? (
                                        bannerIsVideo ? (
                                            <video src={bannerUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                                        ) : (
                                            <img src={bannerUrl} alt="Banner preview" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                                        )
                                    ) : (
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Banner Preview</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', flex: 1 }}>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>We recommend an image of at least 960x540. You can upload a PNG, JPG, animated GIF, or MP4 video under 10MB.</p>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onMouseEnter={() => setHoveredBtn('upload-banner')} onMouseLeave={() => setHoveredBtn(null)}
                                            onClick={() => bannerInputRef.current?.click()}
                                            style={{ background: hoveredBtn === 'upload-banner' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '8px 24px', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                                        >Upload Banner</button>
                                        {bannerUrl && (
                                            <button onClick={handleGuildBannerRemove} style={{ background: 'transparent', border: '1px solid var(--stroke)', padding: '8px 16px', borderRadius: '6px', color: 'var(--error)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Remove</button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Guild Accent Color</h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>This color will be used for buttons, links, and highlights throughout your Guild.</p>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
                                {accentColors.map(accent => (
                                    <div key={accent.name} onClick={() => setSelectedAccentColor(accent.color)} title={accent.name}
                                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: accent.color, border: selectedAccentColor === accent.color ? '3px solid white' : '3px solid transparent', boxShadow: selectedAccentColor === accent.color ? `0 0 0 2px ${accent.color}` : 'none', transition: 'all 0.15s' }} />
                                        <span style={{ fontSize: '10px', color: selectedAccentColor === accent.color ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>{accent.name}</span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={applyBranding}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', background: savedIndicator ? '#10b981' : 'var(--accent-primary)', border: 'none', color: savedIndicator ? 'white' : '#000', fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: 'background 0.3s' }}
                            >
                                {savedIndicator ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Apply Branding</>}
                            </button>
                        </>
                    )}

                    {activeTab === 'insights' && guildId && (
                        <GuildInsightsPanel guildId={guildId} />
                    )}

                    {/* Sticker Management — Item 21 */}
                    {activeTab === 'stickers' && guildId && (
                        <GuildStickersPanel guildId={guildId} addToast={addToast} />
                    )}

                    {/* Server Rules Gate — Item 19 */}
                    {activeTab === 'rules' && guildId && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Server Rules</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                                Define server rules that new members must agree to before participating.
                            </p>
                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>RULES TEXT</label>
                                <textarea
                                    value={rulesText}
                                    onChange={e => setRulesText(e.target.value)}
                                    placeholder="Enter your server rules here. One rule per line recommended."
                                    rows={10}
                                    style={{ width: '100%', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' as const, lineHeight: '1.6' }}
                                />
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '24px' }}>
                                <input type="checkbox" checked={requireRulesAgreement} onChange={e => setRequireRulesAgreement(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                Require new members to accept rules before chatting
                            </label>
                            <button
                                onClick={async () => {
                                    try {
                                        await api.patch(`/guilds/${guildId}`, { rulesText: rulesText || null, requireRulesAgreement });
                                        addToast({ title: 'Server rules saved', variant: 'success' });
                                    } catch {
                                        addToast({ title: 'Failed to save rules', variant: 'error' });
                                    }
                                }}
                                style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
                            >
                                Save Rules
                            </button>
                        </>
                    )}

                    {/* Discovery Tags — Item 25 */}
                    {activeTab === 'discovery' && guildId && (
                        <GuildDiscoveryTagsPanel guildId={guildId} addToast={addToast} guildTags={guildTags} setGuildTags={setGuildTags} guildCategory={guildCategory} setGuildCategory={setGuildCategory} />
                    )}

                    {activeTab === 'onboarding' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Onboarding</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                                Configure how new members are welcomed to your server.
                            </p>

                            {/* Member Screening Toggle */}
                            <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--stroke)', marginBottom: '24px' }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Member Screening</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                    New members must complete onboarding before sending messages.
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={memberScreeningEnabled} onChange={e => {
                                        const newVal = e.target.checked;
                                        setMemberScreeningEnabled(newVal);
                                        if (guildId) {
                                            api.patch(`/guilds/${guildId}`, { memberScreeningEnabled: newVal }).catch(() => {
                                                setMemberScreeningEnabled(!newVal);
                                                addToast({ title: 'Failed to update member screening', variant: 'error' });
                                            });
                                        }
                                    }} style={{ accentColor: 'var(--accent-primary)' }} />
                                    Enable member screening
                                </label>
                            </div>

                            {/* Onboarding Flow Editor (Item 105) */}
                            <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--stroke)' }}>
                                {guildId && <OnboardingFlowEditor guildId={guildId} roles={roles} channels={channelsList} addToast={addToast} />}
                            </div>
                        </>
                    )}

                    {activeTab === 'boosts' && (() => {
                        const TIERS = [
                            { tier: 0, name: 'No Tier', min: 0, color: '#72767d', perks: ['Base server features'] },
                            { tier: 1, name: 'Tier 1', min: 2, color: '#ff73fa', perks: ['50 emoji slots', '128 Kbps audio', 'Custom server invite background', 'Animated server icon'] },
                            { tier: 2, name: 'Tier 2', min: 7, color: '#ff73fa', perks: ['100 emoji slots', '256 Kbps audio', '50 MB upload limit', 'Server banner', 'Custom role icons'] },
                            { tier: 3, name: 'Tier 3', min: 14, color: '#ffd700', perks: ['250 emoji slots', '384 Kbps audio', '100 MB upload limit', 'Vanity invite URL', 'Animated server banner', 'Custom sticker slots'] },
                        ];
                        const currentTierData = TIERS[boostTier] || TIERS[0];
                        const nextTierData = boostTier < 3 ? TIERS[boostTier + 1] : null;
                        const progressToNext = nextTierData ? Math.min((boostCount / nextTierData.min) * 100, 100) : 100;
                        return (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Server Boosts</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                                    Boost your server to unlock perks and features for everyone.
                                </p>

                                {/* Current Status */}
                                <div style={{ background: `linear-gradient(135deg, ${currentTierData.color}22, var(--bg-tertiary))`, padding: '24px', borderRadius: '12px', border: `1px solid ${currentTierData.color}44`, marginBottom: '20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '28px', fontWeight: 800, color: currentTierData.color }}>{currentTierData.name}</div>
                                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>{boostCount} boost{boostCount !== 1 ? 's' : ''} active</div>
                                        </div>
                                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: `${currentTierData.color}20`, border: `2px solid ${currentTierData.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                                            {boostTier === 0 ? '\u26A1' : boostTier === 1 ? '\u26A1' : boostTier === 2 ? '\u26A1\u26A1' : '\u26A1\u26A1\u26A1'}
                                        </div>
                                    </div>

                                    {nextTierData && (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                                                <span>{boostCount} / {nextTierData.min} boosts</span>
                                                <span>{nextTierData.name}</span>
                                            </div>
                                            <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: '4px', background: `linear-gradient(90deg, ${currentTierData.color}, ${nextTierData.color})`, width: `${progressToNext}%`, transition: 'width 0.5s ease' }} />
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                {nextTierData.min - boostCount} more boost{nextTierData.min - boostCount !== 1 ? 's' : ''} needed for {nextTierData.name}
                                            </div>
                                        </div>
                                    )}
                                    {!nextTierData && (
                                        <div style={{ fontSize: '13px', color: currentTierData.color, fontWeight: 600 }}>
                                            Maximum tier reached!
                                        </div>
                                    )}
                                </div>

                                {/* Tier Cards */}
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Tier Perks</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {TIERS.filter(t => t.tier > 0).map(t => {
                                        const isUnlocked = boostTier >= t.tier;
                                        const isCurrent = boostTier === t.tier;
                                        return (
                                            <div key={t.tier} style={{
                                                padding: '16px', borderRadius: '10px',
                                                background: isCurrent ? `${t.color}10` : 'var(--bg-tertiary)',
                                                border: isCurrent ? `1px solid ${t.color}55` : '1px solid var(--stroke)',
                                                opacity: isUnlocked ? 1 : 0.6,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '14px', color: isUnlocked ? t.color : 'var(--text-muted)' }}>{t.name}</span>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px' }}>{t.min} boosts</span>
                                                    </div>
                                                    {isUnlocked && (
                                                        <span style={{ fontSize: '11px', fontWeight: 600, color: t.color, background: `${t.color}15`, padding: '3px 8px', borderRadius: '6px' }}>
                                                            {isCurrent ? 'Current' : 'Unlocked'}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {t.perks.map((perk, i) => (
                                                        <span key={i} style={{
                                                            fontSize: '12px', color: isUnlocked ? 'var(--text-secondary)' : 'var(--text-muted)',
                                                            background: 'var(--bg-primary)', padding: '3px 8px', borderRadius: '6px',
                                                        }}>
                                                            {isUnlocked ? '\u2713' : '\u2022'} {perk}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        );
                    })()}

                    {activeTab === 'currency' && guildId && <CurrencyPanel guildId={guildId} addToast={addToast} />}

                    {activeTab === 'welcome' && (() => {
                        const BLOCK_META: Record<WelcomeBlockType, { label: string; icon: React.ReactNode; desc: string }> = {
                            message: { label: 'Welcome Message', icon: <Type size={16} />, desc: 'Greeting text shown at the top' },
                            channels: { label: 'Recommended Channels', icon: <Hash size={16} />, desc: 'Highlight channels for new members' },
                            rules: { label: 'Rules Summary', icon: <BookOpen size={16} />, desc: 'Quick overview of server rules' },
                            links: { label: 'Resource Links', icon: <ExternalLink size={16} />, desc: 'Useful links for newcomers' },
                        };
                        const updateBlock = (id: string, patch: Partial<WelcomeBlock>) => {
                            setWelcomeBlocks(prev => {
                                const next = prev.map(b => b.id === id ? { ...b, ...patch } : b);
                                if (guildId) saveWelcomeBlocks(guildId, next);
                                return next;
                            });
                        };
                        const moveBlock = (idx: number, dir: -1 | 1) => {
                            setWelcomeBlocks(prev => {
                                const next = [...prev];
                                const target = idx + dir;
                                if (target < 0 || target >= next.length) return prev;
                                [next[idx], next[target]] = [next[target], next[idx]];
                                if (guildId) saveWelcomeBlocks(guildId, next);
                                return next;
                            });
                        };
                        const toggleWelcomeEnabled = () => {
                            const next = !welcomeEnabled;
                            setWelcomeEnabled(next);
                            try {
                                const raw = localStorage.getItem(WELCOME_STORAGE_KEY);
                                const all = raw ? JSON.parse(raw) : {};
                                all[`${guildId}_enabled`] = next;
                                localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify(all));
                            } catch { /* ignore */ }
                        };
                        const wTextChannels = channelsList.filter(ch => ch.type === 'GUILD_TEXT' || ch.type === 'text');
                        return (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Welcome Screen Builder</h2>
                                    <button onClick={() => setWelcomePreview(!welcomePreview)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: welcomePreview ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: welcomePreview ? '#fff' : 'var(--text-secondary)', border: welcomePreview ? 'none' : '1px solid var(--stroke)' }}>
                                        <Eye size={14} /> {welcomePreview ? 'Close Preview' : 'Preview'}
                                    </button>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Design the welcome screen new members see when they join. Reorder blocks with the arrows.</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1 }}>
                                        <input type="checkbox" checked={welcomeEnabled} onChange={toggleWelcomeEnabled} style={{ accentColor: 'var(--accent-primary)' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>Enable Welcome Screen</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Show a customized welcome screen to new members</div>
                                        </div>
                                    </label>
                                </div>
                                {welcomePreview ? (
                                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', overflow: 'hidden', maxWidth: '460px', margin: '0 auto' }}>
                                        <div style={{ height: '100px', background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)' }} />
                                        <div style={{ padding: '20px 24px 24px' }}>
                                            <div style={{ marginTop: '-40px', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                                                <div style={{ width: '56px', height: '56px', borderRadius: '14px', border: '3px solid var(--bg-elevated)', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '22px', fontWeight: 700 }}>{serverName.charAt(0).toUpperCase() || 'S'}</div>
                                            </div>
                                            <h3 style={{ textAlign: 'center', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Welcome to {serverName}!</h3>
                                            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Preview Mode</p>
                                            {welcomeBlocks.filter(b => b.enabled).map(block => (
                                                <div key={block.id} style={{ marginBottom: '12px' }}>
                                                    {block.type === 'message' && (block.data.text || welcomeMessage) && (<div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{block.data.text || welcomeMessage}</div>)}
                                                    {block.type === 'channels' && (block.data.channelIds?.length > 0 || wTextChannels.length > 0) && (
                                                        <div>
                                                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>Recommended Channels</div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                {(block.data.channelIds?.length > 0 ? block.data.channelIds.map((cid: string) => wTextChannels.find(c => c.id === cid)).filter(Boolean) : wTextChannels.slice(0, 3)).map((ch: any) => (
                                                                    <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '13px' }}>
                                                                        <Hash size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /><span style={{ fontWeight: 500 }}>{ch.name}</span>
                                                                        {ch.topic && <span style={{ color: 'var(--text-muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}> - {ch.topic}</span>}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {block.type === 'rules' && block.data.summary && (
                                                        <div>
                                                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>Server Rules</div>
                                                            <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{block.data.summary}</div>
                                                        </div>
                                                    )}
                                                    {block.type === 'links' && block.data.items?.length > 0 && (
                                                        <div>
                                                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>Resources</div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                {block.data.items.map((item: { label: string; url: string }, li: number) => (
                                                                    <div key={li} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '13px', color: 'var(--accent-primary)' }}><ExternalLink size={14} style={{ flexShrink: 0 }} /><span>{item.label || item.url}</span></div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            <button style={{ width: '100%', padding: '10px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'default', marginTop: '8px' }}>Let's go!</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {welcomeBlocks.map((block, idx) => {
                                            const meta = BLOCK_META[block.type];
                                            const isBlockEditing = editingBlockId === block.id;
                                            return (
                                                <div key={block.id} style={{ background: block.enabled ? 'var(--bg-tertiary)' : 'var(--bg-secondary)', border: isBlockEditing ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)', borderRadius: '10px', padding: '14px 16px', opacity: block.enabled ? 1 : 0.6 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: isBlockEditing ? '12px' : 0 }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <button onClick={() => moveBlock(idx, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', padding: 0, cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--bg-secondary)' : 'var(--text-muted)', display: 'flex' }}><ArrowUp size={12} /></button>
                                                            <button onClick={() => moveBlock(idx, 1)} disabled={idx === welcomeBlocks.length - 1} style={{ background: 'none', border: 'none', padding: 0, cursor: idx === welcomeBlocks.length - 1 ? 'default' : 'pointer', color: idx === welcomeBlocks.length - 1 ? 'var(--bg-secondary)' : 'var(--text-muted)', display: 'flex' }}><ArrowDown size={12} /></button>
                                                        </div>
                                                        <div style={{ color: 'var(--text-muted)' }}>{meta.icon}</div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{meta.label}</div>
                                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{meta.desc}</div>
                                                        </div>
                                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                                            <input type="checkbox" checked={block.enabled} onChange={e => updateBlock(block.id, { enabled: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                                                        </label>
                                                        <button onClick={() => setEditingBlockId(isBlockEditing ? null : block.id)} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: isBlockEditing ? 'var(--accent-primary)' : 'var(--text-muted)', display: 'flex' }}><Edit2 size={14} /></button>
                                                    </div>
                                                    {isBlockEditing && block.type === 'message' && (
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>WELCOME TEXT</label>
                                                            <textarea value={block.data.text || ''} onChange={e => updateBlock(block.id, { data: { ...block.data, text: e.target.value } })} rows={3} placeholder={welcomeMessage || 'Welcome to our server!'} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Leave empty to use the server welcome message.</div>
                                                        </div>
                                                    )}
                                                    {isBlockEditing && block.type === 'channels' && (
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>SELECT CHANNELS TO HIGHLIGHT</label>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                                                                {wTextChannels.map(ch => {
                                                                    const sel = (block.data.channelIds || []).includes(ch.id);
                                                                    return (
                                                                        <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', background: sel ? 'var(--active-overlay)' : 'transparent', fontSize: '13px' }}>
                                                                            <input type="checkbox" checked={sel} onChange={() => { const ids = block.data.channelIds || []; const nxt = sel ? ids.filter((id: string) => id !== ch.id) : [...ids, ch.id]; updateBlock(block.id, { data: { ...block.data, channelIds: nxt } }); }} style={{ accentColor: 'var(--accent-primary)' }} />
                                                                            <Hash size={14} style={{ color: 'var(--text-muted)' }} />{ch.name}
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                            {wTextChannels.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' }}>No text channels found.</div>}
                                                        </div>
                                                    )}
                                                    {isBlockEditing && block.type === 'rules' && (
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>RULES SUMMARY</label>
                                                            <textarea value={block.data.summary || ''} onChange={e => updateBlock(block.id, { data: { ...block.data, summary: e.target.value } })} rows={4} placeholder={"1. Be respectful\n2. No spam\n3. Stay on topic"} style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Brief rules summary shown on the welcome screen.</div>
                                                        </div>
                                                    )}
                                                    {isBlockEditing && block.type === 'links' && (
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>RESOURCE LINKS</label>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                                                                {(block.data.items || []).map((item: { label: string; url: string }, li: number) => (
                                                                    <div key={li} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                        <input value={item.label} onChange={e => { const items = [...(block.data.items || [])]; items[li] = { ...items[li], label: e.target.value }; updateBlock(block.id, { data: { ...block.data, items } }); }} placeholder="Label" style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                                                                        <input value={item.url} onChange={e => { const items = [...(block.data.items || [])]; items[li] = { ...items[li], url: e.target.value }; updateBlock(block.id, { data: { ...block.data, items } }); }} placeholder="https://..." style={{ flex: 2, padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                                                                        <button onClick={() => { const items = (block.data.items || []).filter((_: any, j: number) => j !== li); updateBlock(block.id, { data: { ...block.data, items } }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}><Trash2 size={14} /></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <button onClick={() => { const items = [...(block.data.items || []), { label: '', url: '' }]; updateBlock(block.id, { data: { ...block.data, items } }); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}><Plus size={12} /> Add Link</button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        );
                    })()}

                    {activeTab === 'import' && (
                        <ImportWizard guildId={guildId!} addToast={addToast} />
                    )}

                    {/* ===================== SPAM DETECTION (Item 93) ===================== */}
                    {activeTab === 'spam' && guildId && (
                        <SpamConfigPanel guildId={guildId} addToast={addToast} />
                    )}

                    {/* ===================== MOD QUEUE (Item 109) ===================== */}
                    {activeTab === 'modqueue' && guildId && (
                        <ModQueuePanel guildId={guildId} addToast={addToast} />
                    )}

                    {/* ===================== SOUNDBOARD (Item 97) ===================== */}
                    {activeTab === 'soundboard' && guildId && (
                        <SoundboardPanel guildId={guildId} addToast={addToast} />
                    )}

                    {/* ===================== BACKUPS (Item 108) ===================== */}
                    {activeTab === 'backups' && guildId && (
                        <BackupsPanel guildId={guildId} addToast={addToast} />
                    )}

                    {/* ===================== HIGHLIGHTS (Item 103) ===================== */}
                    {activeTab === 'highlights' && guildId && (
                        <HighlightsPanel guildId={guildId} addToast={addToast} />
                    )}
                </div>
            </div>
        </div>

        {/* Confirmation Dialog for destructive actions */}
        {confirmDialog && (
            <div
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
                onClick={() => setConfirmDialog(null)}
                onKeyDown={e => { if (e.key === 'Escape') setConfirmDialog(null); }}
                tabIndex={-1}
                ref={el => el?.focus()}
            >
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90vw', border: '1px solid var(--stroke)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                    onClick={e => e.stopPropagation()}
                >
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{confirmDialog.title}</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>{confirmDialog.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            onClick={() => setConfirmDialog(null)}
                            style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                        >Cancel</button>
                        <button
                            onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
                            style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--error)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                        >Confirm</button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

function GuildInsightsPanel({ guildId }: { guildId: string }) {
    const [data, setData] = useState<{ memberCount: number; memberGrowth7d: number; messages7d: number; topChannels: { channelId: string; name: string; messages: number }[] } | null>(null);
    const [prevData, setPrevData] = useState<{ memberCount: number; messages7d: number } | null>(null);

    useEffect(() => {
        api.get<any>(`/guilds/${guildId}/insights`).then(d => {
            setData(d);
            setPrevData({ memberCount: Math.max(0, (d.memberCount || 0) - (d.memberGrowth7d || 0)), messages7d: Math.round((d.messages7d || 0) * 0.9) });
        }).catch(() => {});
    }, [guildId]);

    if (!data) return <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading insights...</div>;

    const msgTrend = prevData && prevData.messages7d > 0
        ? Math.round(((data.messages7d - prevData.messages7d) / prevData.messages7d) * 100)
        : 0;
    const msgTrendUp = msgTrend >= 0;
    const topMax = data.topChannels.length > 0 ? data.topChannels[0].messages : 1;

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Server Insights</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Analytics for the past 7 days.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#6366f1' }} />
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{data.memberCount.toLocaleString()}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Members</div>
                    <div style={{ color: data.memberGrowth7d >= 0 ? '#43b581' : '#f04747', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                        {data.memberGrowth7d >= 0 ? '\u2191' : '\u2193'} {data.memberGrowth7d >= 0 ? '+' : ''}{data.memberGrowth7d} this week
                    </div>
                </div>
                <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f59e0b' }} />
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{data.messages7d.toLocaleString()}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Messages (7d)</div>
                    <div style={{ color: msgTrendUp ? '#43b581' : '#f04747', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                        {msgTrendUp ? '\u2191' : '\u2193'} {msgTrendUp ? '+' : ''}{msgTrend}% vs prior week
                    </div>
                </div>
            </div>
            {data.topChannels.length > 0 && (
                <>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 12 }}>Top Channels</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {data.topChannels.map((ch, i) => {
                            const pct = topMax > 0 ? (ch.messages / topMax) * 100 : 0;
                            const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ec4899', '#10b981'];
                            const barColor = colors[i % colors.length];
                            return (
                                <div key={ch.channelId} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: 6, border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: barColor, opacity: 0.1, borderRadius: 6 }} />
                                    <span style={{ position: 'relative', zIndex: 1 }}>
                                        <span style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}>#{i + 1}</span>
                                        #{ch.name}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', position: 'relative', zIndex: 1, fontWeight: 600, fontSize: 13 }}>{ch.messages.toLocaleString()}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// ImportWizard — Upload server/workspace export JSON and import channels & roles
// ---------------------------------------------------------------------------
function ImportWizard({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
    const [source, setSource] = useState<'discord' | 'slack'>('discord');
    const [parsedData, setParsedData] = useState<{ channels: any[]; roles: any[] } | null>(null);
    const [result, setResult] = useState<{ categories: number; channels: number; roles: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                // Server exports have guild.channels and guild.roles, or top-level channels/roles
                const channels = json.channels || json.guild?.channels || [];
                const roles = json.roles || json.guild?.roles || [];
                if (channels.length === 0 && roles.length === 0) {
                    setError('No channels or roles found in the export file. Make sure the file is a valid server or workspace export.');
                    return;
                }
                setParsedData({ channels, roles });
                setStep('preview');
            } catch {
                setError('Invalid JSON file. Please upload a valid export file.');
            }
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!parsedData) return;
        setStep('importing');
        setError(null);
        try {
            const res = await api.guilds.importServer(guildId, {
                source,
                channels: parsedData.channels,
                roles: parsedData.roles,
            });
            setResult(res.created);
            setStep('done');
            addToast({ title: 'Import complete!', variant: 'success' });
        } catch (err: any) {
            setError(err?.message || 'Import failed');
            setStep('preview');
        }
    };

    const discordTypeNames: Record<number, string> = { 0: 'Text', 2: 'Voice', 4: 'Category', 5: 'Announcement', 13: 'Stage', 15: 'Forum' };

    if (step === 'done' && result) {
        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Import Complete</h2>
                <div style={{ background: 'var(--bg-tertiary)', padding: '24px', borderRadius: '12px', border: '1px solid var(--stroke)', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#10003;</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Successfully imported</div>
                    <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        <div><strong>{result.categories}</strong> categories</div>
                        <div><strong>{result.channels}</strong> channels</div>
                        <div><strong>{result.roles}</strong> roles</div>
                    </div>
                    <button onClick={() => { setStep('upload'); setParsedData(null); setResult(null); }}
                        style={{ marginTop: '20px', padding: '8px 20px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                        Import Another
                    </button>
                </div>
            </>
        );
    }

    if (step === 'importing') {
        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Importing...</h2>
                <div style={{ background: 'var(--bg-tertiary)', padding: '40px', borderRadius: '12px', border: '1px solid var(--stroke)', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Creating channels and roles, please wait...</div>
                </div>
            </>
        );
    }

    if (step === 'preview' && parsedData) {
        const categories = parsedData.channels.filter((c: any) => (typeof c.type === 'number' ? c.type : parseInt(c.type)) === 4);
        const textChannels = parsedData.channels.filter((c: any) => { const t = typeof c.type === 'number' ? c.type : parseInt(c.type); return t === 0 || t === 5 || t === 15; });
        const voiceChannels = parsedData.channels.filter((c: any) => { const t = typeof c.type === 'number' ? c.type : parseInt(c.type); return t === 2 || t === 13; });
        const filteredRoles = parsedData.roles.filter((r: any) => r.name !== '@everyone');

        return (
            <>
                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Preview Import</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>
                    Review what will be imported from your {source === 'discord' ? 'server' : 'workspace'} export.
                </p>
                {error && <div style={{ background: 'var(--error)', color: 'white', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>Channels ({parsedData.channels.length})</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {categories.length} categories, {textChannels.length} text, {voiceChannels.length} voice
                        </div>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>Roles ({filteredRoles.length})</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {filteredRoles.slice(0, 5).map((r: any) => r.name).join(', ')}{filteredRoles.length > 5 ? ` +${filteredRoles.length - 5} more` : ''}
                        </div>
                    </div>
                </div>

                {parsedData.channels.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>Channels to create:</div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {parsedData.channels.slice(0, 50).map((ch: any, i: number) => {
                                const typeNum = typeof ch.type === 'number' ? ch.type : parseInt(ch.type);
                                return (
                                    <div key={ch.id || i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '13px' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', minWidth: '60px' }}>{discordTypeNames[typeNum] || 'Text'}</span>
                                        <span>{ch.name}</span>
                                    </div>
                                );
                            })}
                            {parsedData.channels.length > 50 && <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '4px 8px' }}>...and {parsedData.channels.length - 50} more</div>}
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setStep('upload'); setParsedData(null); setError(null); }}
                        style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--stroke)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                        Back
                    </button>
                    <button onClick={handleImport}
                        style={{ padding: '8px 20px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                        Import {parsedData.channels.length} channels and {filteredRoles.length} roles
                    </button>
                </div>
            </>
        );
    }

    // Upload step
    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Import Server</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Import channels and roles from another platform's JSON export.
            </p>

            <div style={{ marginBottom: '20px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>Source</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {(['discord', 'slack'] as const).map(s => (
                        <button key={s} onClick={() => setSource(s)}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                background: source === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: source === s ? '#000' : 'var(--text-secondary)',
                                border: source === s ? 'none' : '1px solid var(--stroke)',
                            }}>
                            {s === 'discord' ? 'Server Export' : 'Workspace Export'}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div style={{ background: 'var(--error)', color: 'white', padding: '8px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '13px' }}>{error}</div>}

            <div
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--stroke)'; }}
                onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--stroke)'; const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                    border: '2px dashed var(--stroke)', borderRadius: '12px', padding: '48px 24px',
                    textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                    background: 'var(--bg-tertiary)',
                }}>
                <div style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.5 }}>&#128196;</div>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>Drop your export file here</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>or click to browse. Accepts .json files.</div>
                <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }}
                    onChange={e => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
            </div>

            <div style={{ marginTop: '20px', background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>How to export in {source === 'discord' ? 'server' : 'workspace'} JSON format</div>
                {source === 'discord' ? (
                    <ol style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0, paddingLeft: '16px', lineHeight: 1.8 }}>
                        <li>Use a server export tool to export your server in JSON format</li>
                        <li>Include channels and roles in the export</li>
                        <li>Upload the exported .json file above</li>
                    </ol>
                ) : (
                    <ol style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0, paddingLeft: '16px', lineHeight: 1.8 }}>
                        <li>Go to your workspace settings</li>
                        <li>Navigate to Import/Export Data and click Export</li>
                        <li>Extract the .zip and upload the channels.json file above</li>
                    </ol>
                )}
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------
// Sticker Management Panel — Item 21
// ---------------------------------------------------------------------------
function GuildStickersPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [stickers, setStickers] = useState<Array<{ id: string; name: string; assetUrl: string; description: string | null; tags: string[] }>>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newDesc, setNewDesc] = useState('');

    useEffect(() => {
        api.stickers.getGuildStickers(guildId).then(data => setStickers(Array.isArray(data) ? data : [])).catch(() => { addToast({ title: 'Failed to load stickers', variant: 'error' }); }).finally(() => setLoading(false));
    }, [guildId]);

    const handleCreate = async () => {
        if (!newName.trim() || !newUrl.trim()) {
            addToast({ title: 'Name and URL are required', variant: 'error' });
            return;
        }
        try {
            const sticker = await api.post(`/guilds/${guildId}/stickers`, { name: newName.trim(), assetUrl: newUrl.trim(), description: newDesc.trim() || null, tags: [] });
            setStickers(prev => [...prev, sticker as any]);
            setNewName('');
            setNewUrl('');
            setNewDesc('');
            addToast({ title: 'Sticker created', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to create sticker', variant: 'error' });
        }
    };

    const handleDelete = async (stickerId: string) => {
        try {
            await api.delete(`/guilds/${guildId}/stickers/${stickerId}`);
            setStickers(prev => prev.filter(s => s.id !== stickerId));
            addToast({ title: 'Sticker deleted', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to delete sticker', variant: 'error' });
        }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Stickers</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Manage custom stickers for your server. Members can use them in the sticker picker.
            </p>

            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>ADD STICKER</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Sticker name" style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                    <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Image URL (PNG, GIF, WebP)" style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                    <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                </div>
                <button onClick={handleCreate} style={{ padding: '8px 18px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    Add Sticker
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading stickers...</div>
            ) : stickers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>No stickers yet</p>
                    <p style={{ fontSize: '13px', margin: 0 }}>Add stickers above for your server members to use.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                    {stickers.map(sticker => (
                        <div key={sticker.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '12px', textAlign: 'center', position: 'relative' }}>
                            <img src={sticker.assetUrl} alt={sticker.name} style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', marginBottom: '8px' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{sticker.name}</div>
                            {sticker.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sticker.description}</div>}
                            <button onClick={() => handleDelete(sticker.id)} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Discovery Tags Panel — Item 25
// ---------------------------------------------------------------------------
function GuildDiscoveryTagsPanel({ guildId, addToast, guildTags, setGuildTags, guildCategory, setGuildCategory }: { guildId: string; addToast: (t: any) => void; guildTags: string[]; setGuildTags: (t: string[]) => void; guildCategory: string; setGuildCategory: (c: string) => void }) {
    const [tagInput, setTagInput] = useState('');
    const SUGGESTED_TAGS = ['gaming', 'music', 'art', 'technology', 'education', 'community', 'anime', 'memes', 'programming', 'social', 'roleplay', 'science'];
    const CATEGORIES = ['gaming', 'music', 'art', 'tech', 'community', 'anime', 'education', 'other'];

    const addTag = (tag: string) => {
        const normalized = tag.toLowerCase().trim();
        if (normalized && !guildTags.includes(normalized) && guildTags.length < 10) {
            setGuildTags([...guildTags, normalized]);
        }
        setTagInput('');
    };

    const removeTag = (tag: string) => {
        setGuildTags(guildTags.filter(t => t !== tag));
    };

    const save = async () => {
        try {
            await api.patch(`/guilds/${guildId}`, { tags: guildTags, category: guildCategory || null });
            addToast({ title: 'Discovery settings saved', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to save', variant: 'error' });
        }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Discovery Tags</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Help people find your server by adding tags and a category. Servers with tags appear in the Discover page.
            </p>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>CATEGORY</label>
                <select value={guildCategory} onChange={e => setGuildCategory(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}>
                    <option value="">Select a category...</option>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>)}
                </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>TAGS ({guildTags.length}/10)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {guildTags.map(tag => (
                        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'var(--accent-primary)', borderRadius: '999px', fontSize: '12px', color: 'white' }}>
                            {tag}
                            <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'white', display: 'flex', alignItems: 'center', opacity: 0.7 }}>x</button>
                        </span>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); addTag(tagInput); } }}
                        placeholder="Type a tag and press Enter"
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                    />
                </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>SUGGESTED TAGS</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {SUGGESTED_TAGS.filter(t => !guildTags.includes(t)).map(tag => (
                        <button
                            key={tag}
                            onClick={() => addTag(tag)}
                            disabled={guildTags.length >= 10}
                            style={{ padding: '4px 10px', borderRadius: '999px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: guildTags.length >= 10 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: guildTags.length >= 10 ? 0.5 : 1 }}
                        >
                            + {tag}
                        </button>
                    ))}
                </div>
            </div>

            <button onClick={save} style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                Save Discovery Settings
            </button>
        </>
    );
}

// ─── Spam Config Panel (Item 93) ─────────────────────────────────────────────
function SpamConfigPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [config, setConfig] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.spamConfig.get(guildId).then(setConfig).catch(() => {});
    }, [guildId]);

    if (!config) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;

    const save = async () => {
        setSaving(true);
        try {
            const updated = await api.spamConfig.update(guildId, config);
            setConfig(updated);
            addToast({ title: 'Spam config saved', variant: 'success' });
        } catch { addToast({ title: 'Failed to save', variant: 'error' }); }
        finally { setSaving(false); }
    };

    const inputStyle = { width: '80px', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'center' as const };
    const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Spam Detection</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Rule-based spam detection. No AI -- pure heuristics.</p>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', cursor: 'pointer' }}>
                <input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} style={{ accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: 600 }}>Enable Spam Detection</span>
            </label>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '16px', opacity: config.enabled ? 1 : 0.5 }}>
                <div style={rowStyle}><span style={{ fontSize: '13px' }}>Max duplicate messages</span><input type="number" value={config.maxDuplicateMessages} onChange={e => setConfig({ ...config, maxDuplicateMessages: +e.target.value })} style={inputStyle} /></div>
                <div style={rowStyle}><span style={{ fontSize: '13px' }}>Duplicate window (sec)</span><input type="number" value={config.duplicateWindowSeconds} onChange={e => setConfig({ ...config, duplicateWindowSeconds: +e.target.value })} style={inputStyle} /></div>
                <div style={rowStyle}><span style={{ fontSize: '13px' }}>Max mentions per message</span><input type="number" value={config.maxMentionsPerMessage} onChange={e => setConfig({ ...config, maxMentionsPerMessage: +e.target.value })} style={inputStyle} /></div>
                <div style={rowStyle}><span style={{ fontSize: '13px' }}>Max links per message</span><input type="number" value={config.maxLinksPerMessage} onChange={e => setConfig({ ...config, maxLinksPerMessage: +e.target.value })} style={inputStyle} /></div>
                <div style={rowStyle}>
                    <span style={{ fontSize: '13px' }}>Action on detection</span>
                    <select value={config.action} onChange={e => setConfig({ ...config, action: e.target.value })} style={{ ...inputStyle, width: '120px' }}>
                        <option value="flag">Flag only</option>
                        <option value="mute">Auto-mute</option>
                        <option value="kick">Auto-kick</option>
                    </select>
                </div>
            </div>

            <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                {saving ? 'Saving...' : 'Save Config'}
            </button>
        </>
    );
}

// ─── Mod Queue Panel (Item 109) ──────────────────────────────────────────────
function ModQueuePanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [statusFilter, setStatusFilter] = useState('pending');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.modQueue.list(guildId, statusFilter);
            setItems(data.items || []);
            setCounts(data.counts || {});
        } catch {} finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [guildId, statusFilter]);

    const resolve = async (itemId: string, status: 'approved' | 'rejected') => {
        try {
            await api.modQueue.resolve(guildId, itemId, status);
            setItems(prev => prev.filter(i => i.id !== itemId));
            addToast({ title: `Item ${status}`, variant: 'success' });
        } catch { addToast({ title: 'Failed to resolve', variant: 'error' }); }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Moderation Queue</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Review flagged content and take action. {counts.pending || 0} pending items.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['pending', 'approved', 'rejected'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)} style={{
                        padding: '6px 14px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 600,
                        background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: statusFilter === s ? '#000' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize',
                    }}>{s} ({counts[s] || 0})</button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No items in this queue.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map(item => (
                        <div key={item.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>{item.type}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(item.createdAt).toLocaleString()}</span>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px', wordBreak: 'break-word' }}>{item.content || 'No details'}</p>
                            {item.reporterUsername && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Reported by: {item.reporterUsername}</p>}
                            {statusFilter === 'pending' && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => resolve(item.id, 'approved')} style={{ padding: '6px 16px', borderRadius: '6px', background: '#10b981', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Approve</button>
                                    <button onClick={() => resolve(item.id, 'rejected')} style={{ padding: '6px 16px', borderRadius: '6px', background: '#ef4444', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Reject</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ─── Soundboard Panel (Item 97) ──────────────────────────────────────────────
function SoundboardPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [clips, setClips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newEmoji, setNewEmoji] = useState('');

    useEffect(() => {
        api.soundboard.list(guildId).then(setClips).catch(() => {}).finally(() => setLoading(false));
    }, [guildId]);

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Custom Soundboard</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Upload sound clips for voice channels. Max 50 clips per server.</p>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>Upload Sound Clip</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Sound name" style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px' }} />
                    <input type="text" value={newEmoji} onChange={e => setNewEmoji(e.target.value.slice(0, 4))} placeholder="Emoji" style={{ width: '60px', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '16px', textAlign: 'center' }} />
                    <button onClick={async () => {
                        if (!newName.trim()) return;
                        try {
                            const clip = await api.soundboard.upload(guildId, { name: newName.trim(), fileHash: 'placeholder', emoji: newEmoji || undefined });
                            setClips(prev => [...prev, clip]);
                            setNewName(''); setNewEmoji('');
                            addToast({ title: 'Sound clip added', variant: 'success' });
                        } catch { addToast({ title: 'Failed to add clip', variant: 'error' }); }
                    }} style={{ padding: '8px 20px', borderRadius: '6px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Add</button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : clips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No sound clips yet. Upload one above.</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                    {clips.map(clip => (
                        <div key={clip.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '16px', textAlign: 'center', cursor: 'pointer' }}
                            onClick={async () => { try { await api.soundboard.play(guildId, clip.id); } catch {} }}>
                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{clip.emoji || '\uD83D\uDD0A'}</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{clip.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{clip.uses} plays</div>
                            <button onClick={async (e) => {
                                e.stopPropagation();
                                try { await api.soundboard.delete(guildId, clip.id); setClips(prev => prev.filter(c => c.id !== clip.id)); addToast({ title: 'Deleted', variant: 'info' }); } catch {}
                            }} style={{ marginTop: '8px', background: 'none', border: '1px solid var(--stroke)', borderRadius: '4px', padding: '2px 8px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ─── Backups Panel (Item 108) ────────────────────────────────────────────────
function BackupsPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [backups, setBackups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [backupName, setBackupName] = useState('');

    useEffect(() => {
        api.guildBackup.list(guildId).then(setBackups).catch(() => {}).finally(() => setLoading(false));
    }, [guildId]);

    const createBackup = async () => {
        setCreating(true);
        try {
            const backup = await api.guildBackup.create(guildId, backupName || undefined);
            setBackups(prev => [backup, ...prev]);
            setBackupName('');
            addToast({ title: 'Backup created', variant: 'success' });
        } catch { addToast({ title: 'Failed to create backup', variant: 'error' }); }
        finally { setCreating(false); }
    };

    const downloadBackup = async (backupId: string) => {
        try {
            const data = await api.guildBackup.get(guildId, backupId);
            const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `backup-${data.name}.json`; a.click();
            URL.revokeObjectURL(url);
        } catch { addToast({ title: 'Failed to download', variant: 'error' }); }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Server Backups</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Export your server structure (channels, roles, settings) as JSON backups.</p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <input type="text" value={backupName} onChange={e => setBackupName(e.target.value)} placeholder="Backup name (optional)" style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px' }} />
                <button onClick={createBackup} disabled={creating} style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                    {creating ? 'Creating...' : 'Create Backup'}
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : backups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No backups yet.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {backups.map(b => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{b.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleString()} - {Math.round((b.sizeBytes || 0) / 1024)} KB</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => downloadBackup(b.id)} style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Download</button>
                                <button onClick={async () => {
                                    try { await api.guildBackup.delete(guildId, b.id); setBackups(prev => prev.filter(x => x.id !== b.id)); addToast({ title: 'Backup deleted', variant: 'info' }); } catch {}
                                }} style={{ padding: '6px 14px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ─── Highlights Panel (Item 103) ─────────────────────────────────────────────
function HighlightsPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [highlights, setHighlights] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        api.guildHighlights.list(guildId).then(setHighlights).catch(() => {}).finally(() => setLoading(false));
    }, [guildId]);

    const generate = async () => {
        setGenerating(true);
        try {
            const h = await api.guildHighlights.generate(guildId);
            setHighlights(prev => [h, ...prev.filter(x => x.weekStart !== h.weekStart)]);
            addToast({ title: 'Highlights generated', variant: 'success' });
        } catch { addToast({ title: 'Failed to generate', variant: 'error' }); }
        finally { setGenerating(false); }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Community Highlights</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Weekly digest of top activity in your server.</p>

            <button onClick={generate} disabled={generating} style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px', marginBottom: '24px' }}>
                {generating ? 'Generating...' : 'Generate This Week'}
            </button>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : highlights.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No highlights yet. Generate one above.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {highlights.map(h => (
                        <div key={h.id || h.weekStart} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3 style={{ fontWeight: 600, fontSize: '15px' }}>Week of {h.weekStart}</h3>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{h.messageCount} messages</span>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Most Active Members</div>
                                    {(h.activeMembers || []).map((m: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-primary)' }}>{m.displayName || m.username}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{m.messageCount} msgs</span>
                                        </div>
                                    ))}
                                    {(h.activeMembers || []).length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No data</p>}
                                </div>
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '16px', minWidth: '120px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-primary)' }}>{h.memberCount}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Members</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

export default GuildSettingsModal;
