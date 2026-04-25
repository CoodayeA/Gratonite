import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Shield, Plus, Check, Search, ChevronDown, Trash2, Edit2, Ban, UserPlus, Hash, Mic, Settings, AlertTriangle, Clock, Save, Link2, Copy, RefreshCw, Bot, Power, Sliders, GripVertical, Upload, UserX, Lock, Eye, Type, ExternalLink, ArrowUp, ArrowDown, BookOpen, Activity, Globe, Compass } from 'lucide-react';
import { useToast } from '../ui/ToastManager';
import { useConfirm } from '../ui/ConfirmDialog';
import { useUser } from '../../contexts/UserContext';
import { api, API_BASE } from '../../lib/api';
import Avatar from '../ui/Avatar';
import { OnboardingFlowEditor } from '../guild/OnboardingFlowEditor';
import { NoCodeBotBuilder } from '../guild/NoCodeBotBuilder';
import { copyToClipboard } from '../../utils/clipboard';
import { GuildFederationPanel } from './GuildFederationPanel';
import { ThemePicker } from '../../portal/ThemePicker';
import { PortalThemeProvider } from '../../portal/themes/PortalThemeProvider';
import {
    GuildInsightsPanel, ImportWizard, GuildStickersPanel, GuildDiscoveryTagsPanel,
    SpamConfigPanel, ModQueuePanel, SoundboardPanel, BackupsPanel, HighlightsPanel,
    GuildSettingsNavigation, GUILD_SETTINGS_TABS,
    GuildInvitesPanel, GuildBrandingPanel,
    BoostsPanel, CurrencyPanel,
} from './guild-settings';

function hexToRelativeLuminance(hex: string): number {
    const c = hex.replace('#', '');
    if (c.length !== 6) return 0;
    const r = parseInt(c.slice(0, 2), 16) / 255;
    const g = parseInt(c.slice(2, 4), 16) / 255;
    const b = parseInt(c.slice(4, 6), 16) / 255;
    const linearize = (v: number) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}
function contrastRatio(hex1: string, hex2: string): number {
    const l1 = hexToRelativeLuminance(hex1);
    const l2 = hexToRelativeLuminance(hex2);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

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

type SettingsTab =
    | 'overview' | 'channels' | 'roles' | 'members' | 'bans' | 'invites' | 'emojis' | 'automod' | 'audit' | 'branding'
    | 'webhooks' | 'bots' | 'templates' | 'insights' | 'onboarding' | 'wordfilter' | 'security' | 'import' | 'boosts'
    | 'welcome' | 'currency' | 'stickers' | 'rules' | 'discovery' | 'soundboard' | 'spam' | 'backups' | 'modqueue'
    | 'highlights' | 'federation' | 'appearance';

const GuildSettingsModal = ({ onClose, guildId }: { onClose: () => void; guildId?: string | null }) => {
    const { addToast } = useToast();
    const { confirm: askConfirm, prompt: promptDialog } = useConfirm();
    const { user: currentUser } = useUser();
    const navigate = useNavigate();
    const actorName = currentUser.name || currentUser.handle || 'Unknown';
    const [activeTab, setActiveTab] = useState<SettingsTab>('overview');
    const [roles, setRoles] = useState<Role[]>([]);
    const [activeRole, setActiveRole] = useState<Role | null>(null);
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
    const [settingsSearch, setSettingsSearch] = useState('');
    const settingsSearchRef = useRef<HTMLInputElement>(null);
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
    const [previewRoleId, setPreviewRoleId] = useState<string | null>(null);

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
                setBannerHash(g.bannerHash);
                const isVid = url.endsWith('.mp4') || url.endsWith('.webm');
                setBannerIsVideo(isVid);
            } else {
                setBannerUrl('');
                setBannerHash('');
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
        }).catch(() => { addToast({ title: 'Failed to load guild settings', variant: 'error' }); });
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
        if (activeTab === 'overview' && roles.length === 0) fetchRoles();
        if (activeTab === 'overview' && members.length === 0) fetchMembers();
        if (activeTab === 'invites') { /* handled by InvitesPanel */ }
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
            setInstalledBotsLoading(true);
            api.get<any[]>(`/bots/installs/${guildId}`).then((data: any) => {
                const bots = Array.isArray(data) ? data : [];
                setInstalledBots(bots.map((b: any) => ({
                    id: b.id,
                    applicationId: b.applicationId ?? null,
                    name: b.botName || 'Unknown Bot',
                    description: b.botShortDescription || '',
                    iconUrl: b.botIconUrl || null,
                    installedAt: b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'Unknown',
                })));
            }).catch(() => setInstalledBots([])).finally(() => setInstalledBotsLoading(false));
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
    const [selectedAppeals, setSelectedAppeals] = useState<Set<string>>(new Set());
    const [bulkAppealsLoading, setBulkAppealsLoading] = useState(false);
    // Tag editing now lives in GuildDiscoveryTagsPanel (see Discovery tab).
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

    const [installedBots, setInstalledBots] = useState<{ id: string; applicationId: string | null; name: string; description: string; iconUrl: string | null; installedAt: string }[]>([]);
    const [installedBotsLoading, setInstalledBotsLoading] = useState(false);

    const bannerInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const emojiInputRef = useRef<HTMLInputElement>(null);
    const [bannerHash, setBannerHash] = useState('');
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
    const matchingTabs = useMemo(() => {
        if (!settingsSearch.trim()) return null;
        const q = settingsSearch.toLowerCase();
        return new Set(
            GUILD_SETTINGS_TABS
                .filter(entry => entry.keywords.some(kw => kw.includes(q)) || entry.label.toLowerCase().includes(q))
                .map(entry => entry.tab)
        );
    }, [settingsSearch]);

    // Auto-navigate to first matching tab when typing in search
    useEffect(() => {
        if (matchingTabs && matchingTabs.size > 0 && !matchingTabs.has(activeTab)) {
            setActiveTab(matchingTabs.values().next().value as typeof activeTab);
        }
    }, [matchingTabs]);

    // Ctrl+F focuses the settings search input
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                settingsSearchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    return (
        <>
        <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div role="dialog" aria-modal="true" aria-label="Server settings" className="settings-modal guild-settings-modal" onClick={e => e.stopPropagation()} style={{ width: 'min(900px, 95vw)', height: 'min(650px, 90vh)', display: 'flex', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
                <GuildSettingsNavigation
                    serverName={serverName}
                    activeTab={activeTab}
                    hoveredBtn={hoveredBtn}
                    setHoveredBtn={setHoveredBtn}
                    setActiveTab={setActiveTab}
                    settingsSearch={settingsSearch}
                    setSettingsSearch={setSettingsSearch}
                    settingsSearchRef={settingsSearchRef}
                    matchingTabs={matchingTabs}
                    onClose={onClose}
                />

                {/* Right Panel */}
                <div className="settings-content-panel" style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', position: 'relative' }}>
                    <button className="settings-close-btn" aria-label="Close server settings" onClick={onClose}
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

                                </div>
                            </div>

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

                            {/* Category & Tags moved to the Discovery tab to avoid duplication */}
                            <div style={{ marginBottom: '24px', padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Compass size={18} color='var(--text-muted)' />
                                <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    Category and tags help users discover your portal. Manage them in the <strong>Discovery</strong> tab.
                                </div>
                                <button
                                    onClick={() => setActiveTab('discovery')}
                                    style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                >
                                    Open Discovery
                                </button>
                            </div>

                            <button onClick={saveOverview}onMouseEnter={() => setHoveredBtn('save-overview')} onMouseLeave={() => setHoveredBtn(null)}
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
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>Use roles to group your server members and assign permissions. Higher roles override lower ones.</p>

                            {/* Preview as Role */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Preview as Role:</label>
                                <select
                                    value={previewRoleId ?? ''}
                                    onChange={e => setPreviewRoleId(e.target.value || null)}
                                    style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', maxWidth: '200px' }}
                                >
                                    <option value="">— Select role to preview —</option>
                                    {roles.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Preview Banner */}
                            {previewRoleId && (() => {
                                const previewRole = roles.find(r => r.id === previewRoleId);
                                if (!previewRole) return null;
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '8px', background: 'rgba(99,102,241,0.12)', border: '1px solid #6366f1', marginBottom: '16px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: previewRole.color, flexShrink: 0 }} />
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8' }}>
                                            Previewing permissions as: {previewRole.name}
                                        </span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>· Read-only view</span>
                                        <button
                                            onClick={() => setPreviewRoleId(null)}
                                            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textDecoration: 'underline', padding: 0 }}
                                        >
                                            Exit preview
                                        </button>
                                    </div>
                                );
                            })()}

                            {/* Preview Mode: read-only permission matrix */}
                            {previewRoleId && (() => {
                                const previewRole = roles.find(r => r.id === previewRoleId);
                                if (!previewRole) return null;
                                return (
                                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '20px', marginBottom: '16px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            Permission Matrix — {previewRole.name}
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px' }}>
                                            {permissionsList.map(perm => {
                                                const granted = previewRole.id === '1' || previewRole.permissions['administrator'] || previewRole.permissions[perm.key];
                                                return (
                                                    <div key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)' }}>
                                                        <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: granted ? 'var(--success, #22c55e)' : 'var(--bg-elevated)', border: `1px solid ${granted ? 'var(--success, #22c55e)' : 'var(--stroke)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '10px' }}>
                                                            {granted ? '✓' : ''}
                                                        </span>
                                                        <span style={{ fontSize: '12px', color: granted ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: granted ? 500 : 400 }}>{perm.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '12px 0 0' }}>
                                            This is a display-only preview. Your actual permissions are not changed.
                                        </p>
                                    </div>
                                );
                            })()}

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
                                                    {contrastRatio(editRoleColorVal, '#111827') < 3 && (
                                                        <span title="This color may be hard to read on dark backgrounds (WCAG contrast < 3:1)" style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
                                                            <AlertTriangle size={12} /> Low contrast
                                                        </span>
                                                    )}
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
                                        const days = await promptDialog({ title: 'Prune inactive members', message: 'Remove members inactive for how many days?', defaultValue: '30', placeholder: '30', confirmLabel: 'Preview' });
                                        if (!days) return;
                                        const d = parseInt(days) || 30;
                                        try {
                                            const preview = await api.get<{ count: number }>(`/guilds/${guildId}/prune/preview?days=${d}`);
                                            if (await askConfirm({ title: 'Prune members?', message: `This will remove ${(preview as any).count ?? 0} inactive members. Continue?`, variant: 'danger', confirmLabel: 'Prune' })) {
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
                                                    <button onClick={async () => { if (guildId) { try { await api.workflows.delete(guildId, rule.id); } catch { addToast({ title: 'Failed to delete rule', variant: 'error' }); } } setAutomodRules(prev => prev.filter(r => r.id !== rule.id)); setEditingRule(null); }} style={{ background: 'transparent', border: '1px solid var(--error)', padding: '8px 16px', borderRadius: '6px', color: 'var(--error)', fontWeight: 600, cursor: 'pointer', fontSize: '13px', marginLeft: 'auto' }}>Delete</button>
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
                                            if (!(await askConfirm({ title: 'Lock down server?', message: 'Are you sure you want to lock down the server? Non-admin messaging will be disabled.', variant: 'danger', confirmLabel: 'Lock down' }))) return;
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
                                    {/* Bulk action header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedAppeals.size === banAppeals.filter(a => a.status === 'pending').length && banAppeals.filter(a => a.status === 'pending').length > 0}
                                            onChange={e => {
                                                if (e.target.checked) {
                                                    setSelectedAppeals(new Set(banAppeals.filter(a => a.status === 'pending').map(a => a.userId)));
                                                } else {
                                                    setSelectedAppeals(new Set());
                                                }
                                            }}
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                        />
                                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>
                                            {selectedAppeals.size > 0 ? `${selectedAppeals.size} selected` : 'Select all'}
                                        </span>
                                        {selectedAppeals.size > 0 && (
                                            <>
                                                <button
                                                    disabled={bulkAppealsLoading}
                                                    onClick={async () => {
                                                        setBulkAppealsLoading(true);
                                                        const ids = Array.from(selectedAppeals);
                                                        for (const userId of ids) {
                                                            try {
                                                                await api.patch(`/guilds/${guildId}/bans/${userId}/appeal`, { status: 'approved' });
                                                                setBanAppeals(prev => prev.map(a => a.userId === userId ? { ...a, status: 'approved' } : a));
                                                            } catch { /* continue */ }
                                                        }
                                                        setSelectedAppeals(new Set());
                                                        setBulkAppealsLoading(false);
                                                        addToast({ title: `Approved ${ids.length} appeal(s)`, variant: 'success' });
                                                    }}
                                                    style={{ padding: '5px 12px', borderRadius: '6px', background: '#10b981', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                >
                                                    Approve Selected
                                                </button>
                                                <button
                                                    disabled={bulkAppealsLoading}
                                                    onClick={async () => {
                                                        setBulkAppealsLoading(true);
                                                        const ids = Array.from(selectedAppeals);
                                                        for (const userId of ids) {
                                                            try {
                                                                await api.patch(`/guilds/${guildId}/bans/${userId}/appeal`, { status: 'denied' });
                                                                setBanAppeals(prev => prev.map(a => a.userId === userId ? { ...a, status: 'denied' } : a));
                                                            } catch { /* continue */ }
                                                        }
                                                        setSelectedAppeals(new Set());
                                                        setBulkAppealsLoading(false);
                                                        addToast({ title: `Rejected ${ids.length} appeal(s)`, variant: 'info' });
                                                    }}
                                                    style={{ padding: '5px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                >
                                                    Reject Selected
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    {banAppeals.filter(a => a.status === 'pending').map(appeal => (
                                        <div key={appeal.userId} style={{ padding: '14px 16px', borderRadius: '10px', border: `1px solid ${selectedAppeals.has(appeal.userId) ? 'var(--accent)' : 'var(--stroke)'}`, background: 'var(--bg-elevated)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAppeals.has(appeal.userId)}
                                                    onChange={e => {
                                                        setSelectedAppeals(prev => {
                                                            const next = new Set(prev);
                                                            if (e.target.checked) next.add(appeal.userId);
                                                            else next.delete(appeal.userId);
                                                            return next;
                                                        });
                                                    }}
                                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                />
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
                                                            setSelectedAppeals(prev => { const next = new Set(prev); next.delete(appeal.userId); return next; });
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
                                                            setSelectedAppeals(prev => { const next = new Set(prev); next.delete(appeal.userId); return next; });
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
                                            <button onClick={() => setConfirmDialog({ title: 'Delete Webhook', description: `Are you sure you want to delete the webhook "${wh.name}"? Any integrations using this webhook will stop working.`, onConfirm: async () => { try { await api.webhooks.delete(wh.id); } catch { addToast({ title: 'Failed to delete webhook', variant: 'error' }); } setWebhooksList(prev => prev.filter(w => w.id !== wh.id)); addAuditEntry('Webhook Deleted', actorName, wh.name, 'settings'); } })}
                                                title="Delete Webhook"
                                                aria-label="Delete webhook"
                                                style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    {viewDeliveriesId === wh.id && (
                                        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--stroke)', borderRadius: '0 0 12px 12px', marginTop: '-12px', padding: '16px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recent Deliveries</div>
                                                <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                                    Signing: HMAC-SHA256 · key: {`${wh.id.slice(0, 8)}…`}
                                                </div>
                                            </div>
                                            {deliveryLogs.length === 0 ? (
                                                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No delivery logs yet.</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflow: 'auto' }}>
                                                    {deliveryLogs.map((log, idx) => {
                                                        const isRetry = idx > 0 && !deliveryLogs[idx - 1].success;
                                                        const retryReason = !log.success
                                                            ? log.responseStatus
                                                                ? `HTTP ${log.responseStatus} — ${log.responseStatus >= 500 ? 'Server error, will retry' : log.responseStatus === 429 ? 'Rate limited, backing off' : 'Client error, check payload'}`
                                                                : 'No response — connection timeout, will retry'
                                                            : null;
                                                        const nextRetry = !log.success
                                                            ? new Date(new Date(log.attemptedAt).getTime() + 30000 * (idx + 1)).toLocaleTimeString()
                                                            : null;
                                                        return (
                                                            <div key={log.id} style={{ padding: '8px 10px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '12px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: log.success ? 'var(--success, #22c55e)' : 'var(--error, #ed4245)', flexShrink: 0 }} />
                                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '100px' }}>{log.eventType}</span>
                                                                    <span style={{ color: 'var(--text-muted)' }}>{log.responseStatus ?? '---'}</span>
                                                                    <span style={{ color: 'var(--text-muted)' }}>{log.durationMs != null ? `${log.durationMs}ms` : ''}</span>
                                                                    {isRetry && <span style={{ fontSize: '10px', background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '1px 5px', borderRadius: '4px', fontWeight: 600 }}>RETRY</span>}
                                                                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(log.attemptedAt).toLocaleString()}</span>
                                                                </div>
                                                                {retryReason && (
                                                                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#f87171', paddingLeft: '18px' }}>
                                                                        ↳ {retryReason}
                                                                        {nextRetry && <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>Next retry ~{nextRetry}</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '10px 0 0' }}>
                                                Requests are signed with <code style={{ fontSize: '10px' }}>X-Signature-256: sha256=HMAC(secret, body)</code>. Verify using your webhook token as the secret.
                                            </p>
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

                            <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '32px' }}>
                                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{installedBots.length}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Installed</div>
                                </div>
                                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--success)' }}>{installedBots.length}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {installedBotsLoading && installedBots.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
                                )}
                                {installedBots.map(bot => (
                                    <div key={bot.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: bot.iconUrl ? `center / cover no-repeat url(${bot.iconUrl})` : 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {!bot.iconUrl && <Bot size={24} color="white" />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 600, fontSize: '15px' }}>{bot.name}</span>
                                                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>Active</span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: bot.description ? '6px' : 0 }}>
                                                Installed {bot.installedAt}
                                            </div>
                                            {bot.description && (
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{bot.description}</div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={async () => {
                                                if (!bot.applicationId || !guildId) return;
                                                if (!(await askConfirm({ title: 'Uninstall bot?', message: `Uninstall ${bot.name} from this guild?`, variant: 'danger', confirmLabel: 'Uninstall' }))) return;
                                                try {
                                                    await api.delete(`/bots/installs/${guildId}/${bot.applicationId}`);
                                                    setInstalledBots(prev => prev.filter(b => b.id !== bot.id));
                                                    addAuditEntry('Bot Uninstalled', actorName, bot.name, 'settings');
                                                    addToast({ title: `${bot.name} uninstalled`, variant: 'success' });
                                                } catch {
                                                    addToast({ title: 'Failed to uninstall bot', variant: 'error' });
                                                }
                                            }}
                                                title="Uninstall Bot"
                                                style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {!installedBotsLoading && installedBots.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                        <Bot size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                        <p style={{ fontSize: '14px', fontWeight: 600 }}>No bots installed</p>
                                        <p style={{ fontSize: '13px', marginTop: '4px' }}>Browse the Bot Store to add bots to your server.</p>
                                    </div>
                                )}
                            </div>

                            {/* Slash Command Templates */}
                            <div style={{ marginTop: '28px', borderTop: '1px solid var(--stroke)', paddingTop: '24px' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Slash Command Templates</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Starter patterns to help you build your first bot commands. Copy and customize these templates.</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        {
                                            name: '/ping',
                                            description: 'Basic health check — responds with "Pong!" and latency.',
                                            example: `app.command('/ping', async ({ respond }) => {\n  await respond({ text: '🏓 Pong! Latency: ' + Math.round(Date.now() - start) + 'ms' });\n});`,
                                            tag: 'utility',
                                        },
                                        {
                                            name: '/help',
                                            description: 'Lists all available commands with descriptions.',
                                            example: `app.command('/help', async ({ respond, command }) => {\n  const cmds = app.commands.map(c => \`• /\${c.name} — \${c.description}\`);\n  await respond({ text: cmds.join('\\n') });\n});`,
                                            tag: 'utility',
                                        },
                                        {
                                            name: '/info',
                                            description: 'Returns information about the current server or user.',
                                            example: `app.command('/info', async ({ respond, context }) => {\n  await respond({ text: \`Guild: \${context.guild.name}\\nMembers: \${context.guild.memberCount}\` });\n});`,
                                            tag: 'info',
                                        },
                                    ].map(tpl => (
                                        <div key={tpl.name} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                                <code style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono, monospace)' }}>{tpl.name}</code>
                                                <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{tpl.tag}</span>
                                                <button
                                                    onClick={() => { navigator.clipboard.writeText(tpl.example).catch(() => {}); addToast({ title: `Copied ${tpl.name} template`, variant: 'success' }); }}
                                                    style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '5px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                                                >
                                                    Copy
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>{tpl.description}</div>
                                            <pre style={{ margin: 0, padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)', overflow: 'auto', lineHeight: 1.5 }}>{tpl.example}</pre>
                                        </div>
                                    ))}
                                </div>
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
                    {activeTab === 'invites' && guildId && (
                        <GuildInvitesPanel guildId={guildId} addToast={addToast} />
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
                    {activeTab === 'branding' && guildId && (
                        <GuildBrandingPanel
                            guildId={guildId}
                            guild={{ bannerHash, accentColor: selectedAccentColor }}
                            addToast={addToast}
                            onGuildUpdate={(partial) => {
                                if (partial.bannerHash !== undefined) {
                                    const hash = partial.bannerHash as string;
                                    setBannerHash(hash);
                                    setBannerUrl(hash ? `${API_BASE}/files/${hash}` : '');
                                }
                                if (partial.accentColor !== undefined) {
                                    setSelectedAccentColor(partial.accentColor as string);
                                }
                            }}
                        />
                    )}

                    {activeTab === 'appearance' && guildId && (
                        <PortalThemeProvider guildId={guildId}>
                            <div style={{ marginBottom: 16 }}>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Portal Appearance</h2>
                                <p style={{ fontSize: '13px', opacity: 0.7, margin: 0 }}>
                                    Customize the look and feel of this server's Portal homescreen. Settings here apply to everyone by default; members can override their personal view from the Customize button on the Portal.
                                </p>
                            </div>
                            <ThemePicker scope="guildDefault" embedded />
                        </PortalThemeProvider>
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

                    {activeTab === 'boosts' && guildId && (
                        <BoostsPanel guildId={guildId} addToast={addToast} />
                    )}

                    {activeTab === 'currency' && guildId && (
                        <CurrencyPanel guildId={guildId} addToast={addToast} />
                    )}

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

                    {activeTab === 'import' && guildId && <ImportWizard guildId={guildId} addToast={addToast} />}

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

                    {/* ===================== FEDERATION ===================== */}
                    {activeTab === 'federation' && guildId && (
                        <GuildFederationPanel guildId={guildId} addToast={addToast} />
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

export default GuildSettingsModal;
