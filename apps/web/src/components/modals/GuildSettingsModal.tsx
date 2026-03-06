import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Shield, Plus, Check, Search, ChevronDown, Trash2, Edit2, Ban, UserPlus, Hash, Mic, Settings, AlertTriangle, Clock, Save, Link2, Copy, RefreshCw, Bot, Power, Sliders, GripVertical, Upload, UserX, Lock } from 'lucide-react';
import { useToast } from '../ui/ToastManager';
import { useUser } from '../../contexts/UserContext';
import { api, API_BASE } from '../../lib/api';
import Avatar from '../ui/Avatar';

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

const GuildSettingsModal = ({ onClose, guildId }: { onClose: () => void; guildId?: string | null }) => {
    const { addToast } = useToast();
    const { user: currentUser } = useUser();
    const navigate = useNavigate();
    const actorName = currentUser.name || currentUser.handle || 'Unknown';
    const [activeTab, setActiveTab] = useState<'overview' | 'channels' | 'roles' | 'members' | 'bans' | 'invites' | 'emojis' | 'automod' | 'audit' | 'branding' | 'webhooks' | 'bots'>('overview');
    const [roles, setRoles] = useState<Role[]>([]);
    const [activeRole, setActiveRole] = useState<Role | null>(null);
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
    const [memberSearch, setMemberSearch] = useState('');
    const [auditFilter, setAuditFilter] = useState<string>('all');
    const [serverName, setServerName] = useState('');
    const [serverDesc, setServerDesc] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [rulesChannelId, setRulesChannelId] = useState<string>('');
    const [rolesLoading, setRolesLoading] = useState(false);
    const [membersLoading, setMembersLoading] = useState(false);
    const [rolesSaving, setRolesSaving] = useState(false);
    const [deletingGuild, setDeletingGuild] = useState(false);

    // Channels tab state
    const [channelsList, setChannelsList] = useState<Array<{ id: string; name: string; type: string; parentId: string | null; position: number; topic: string | null; restricted?: boolean }>>([]);
    const [channelsLoading, setChannelsLoading] = useState(false);
    const [dragChannelId, setDragChannelId] = useState<string | null>(null);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [showCreateCategory, setShowCreateCategory] = useState(false);
    const [showCreateChannelInSettings, setShowCreateChannelInSettings] = useState<{ parentId?: string | null } | null>(null);
    const [newChannelNameInSettings, setNewChannelNameInSettings] = useState('');
    const [newChannelTypeInSettings, setNewChannelTypeInSettings] = useState<'GUILD_TEXT' | 'GUILD_VOICE'>('GUILD_TEXT');
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
        }).catch(() => {});
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
            const mapped = chs.map((c: any) => ({
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
        try {
            await api.channels.create(guildId, {
                name: newCategoryName.trim().toLowerCase().replace(/\s+/g, '-'),
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
            });
            setNewChannelNameInSettings('');
            setShowCreateChannelInSettings(null);
            setNewChannelTypeInSettings('GUILD_TEXT');
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
        if (activeTab === 'members') fetchMembers();
        if (activeTab === 'invites') fetchInvites();
        if (activeTab === 'bans') fetchBans();
        if (activeTab === 'audit') fetchAuditLog();
        if (activeTab === 'webhooks') fetchWebhooks();
        if (activeTab === 'automod') fetchAutomodRules();
    }, [activeTab]);
    const [editingRoleName, setEditingRoleName] = useState(false);
    const [editRoleNameVal, setEditRoleNameVal] = useState('');
    const [editRoleColorVal, setEditRoleColorVal] = useState('');
    const [savedIndicator, setSavedIndicator] = useState(false);
    const [kickConfirm, setKickConfirm] = useState<string | null>(null);
    const [selectedAccentColor, setSelectedAccentColor] = useState('#526df5');
    const [guildCategory, setGuildCategory] = useState<string>('');
    const [guildTags, setGuildTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [assignRoleFor, setAssignRoleFor] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<string | null>(null);
    const [editRuleName, setEditRuleName] = useState('');
    const [editRuleAction, setEditRuleAction] = useState('');
    const [editRuleKeywords, setEditRuleKeywords] = useState('');
    const [customEmojis, setCustomEmojis] = useState<Array<{ id?: string; name: string; url: string }>>([]);
    const [emojiUploading, setEmojiUploading] = useState(false);
    const [emojiNameInput, setEmojiNameInput] = useState('');
    const [emojiFileToUpload, setEmojiFileToUpload] = useState<File | null>(null);
    const [emojiFilePreview, setEmojiFilePreview] = useState<string | null>(null);

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

    // Fetch real server emojis
    useEffect(() => {
        if (!guildId) return;
        api.guilds.getEmojis(guildId).then((emojis: any[]) => {
            setCustomEmojis(emojis.map((e: any) => ({
                id: e.id,
                name: e.name,
                url: e.imageHash ? `${API_BASE}/files/${e.imageHash}` : `https://placehold.co/32/526df5/FFF?text=${e.name.charAt(0).toUpperCase()}`,
            })));
        }).catch(() => { addToast({ title: 'Failed to load server emojis', variant: 'error' }); });
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

    const [automodRules, setAutomodRules] = useState<{ id: string; name: string; desc: string; enabled: boolean; action: string; isBuiltIn: boolean; workflowId?: string; keywords?: string[] }[]>([]);

    const [webhooksList, setWebhooksList] = useState<{ id: string; name: string; channel: string; channelId: string; token: string; avatar: string; createdAt: string }[]>([]);
    const [newWebhookName, setNewWebhookName] = useState('');
    const [newWebhookChannel, setNewWebhookChannel] = useState('');
    const [showCreateWebhook, setShowCreateWebhook] = useState(false);
    const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null);
    const [webhookCreating, setWebhookCreating] = useState(false);

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
    const [adminWarning, setAdminWarning] = useState<string | null>(null);
    const [draggedRole, setDraggedRole] = useState<string | null>(null);
    const [dragOverRole, setDragOverRole] = useState<string | null>(null);

    const addAuditEntry = (action: string, user: string, target: string, type: AuditEntry['type']) => {
        const entry: AuditEntry = { id: Date.now().toString(), action, user, target, timestamp: 'just now', type };
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
            await api.guilds.updateRole(guildId, roleId, { permissions: permissionsRecordToInt(newPerms) });
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
        const newColor = editRoleColorVal || activeRole.color;
        try {
            await api.guilds.updateRole(guildId, activeRole.id, {
                name: newName,
                color: colorHexToInt(newColor),
            });
            setRoles(prev => prev.map(r => {
                if (r.id === activeRole.id) {
                    const updated = { ...r, name: newName, color: newColor };
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
            // revert silently
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
    const filteredAudit = auditFilter === 'all' ? auditLog : auditLog.filter(a => a.type === auditFilter);
    const onlineCount = members.filter(m => m.status === 'online').length;

    const tabStyle = (tab: string): React.CSSProperties => ({
        padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, marginBottom: '2px',
        background: activeTab === tab ? 'var(--active-overlay)' : hoveredBtn === `tab-${tab}` ? 'var(--hover-overlay)' : 'transparent',
        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
    });

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ width: '900px', height: '650px', display: 'flex', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
                {/* Left Sidebar */}
                <div style={{ width: '220px', background: 'var(--bg-elevated)', padding: '32px 16px', borderRight: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                    <div>
                        <div style={{ padding: '0 8px', marginBottom: '16px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '15px' }}>
                            {serverName}
                        </div>
                        {(['overview', 'channels', 'roles', 'members', 'invites'] as const).map(tab => (
                            <div key={tab} onClick={() => setActiveTab(tab)}
                                onMouseEnter={() => setHoveredBtn(`tab-${tab}`)} onMouseLeave={() => setHoveredBtn(null)}
                                style={tabStyle(tab)}
                            >{tab.charAt(0).toUpperCase() + tab.slice(1)}</div>
                        ))}
                    </div>
                    <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', padding: '0 12px', marginBottom: '8px' }}>CUSTOMIZATION</div>
                        {(['emojis', 'branding'] as const).map(tab => (
                            <div key={tab} onClick={() => setActiveTab(tab)}
                                onMouseEnter={() => setHoveredBtn(`tab-${tab}`)} onMouseLeave={() => setHoveredBtn(null)}
                                style={tabStyle(tab)}
                            >{tab === 'emojis' ? 'Emojis' : 'Brand Identity'}</div>
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
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', padding: '0 12px', marginBottom: '8px' }}>MODERATION</div>
                        {(['automod', 'bans', 'audit'] as const).map(tab => (
                            <div key={tab} onClick={() => setActiveTab(tab)}
                                onMouseEnter={() => setHoveredBtn(`tab-${tab}`)} onMouseLeave={() => setHoveredBtn(null)}
                                style={tabStyle(tab)}
                            >{tab === 'automod' ? 'AutoMod' : tab === 'bans' ? 'Bans' : 'Audit Log'}</div>
                        ))}
                    </div>
                </div>

                {/* Right Panel */}
                <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', position: 'relative' }}>
                    <button onClick={onClose}
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
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

                            <button onClick={saveOverview} onMouseEnter={() => setHoveredBtn('save-overview')} onMouseLeave={() => setHoveredBtn(null)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', background: savedIndicator ? '#10b981' : 'var(--accent-primary)', border: 'none', color: savedIndicator ? 'white' : '#000', fontWeight: 700, fontSize: '14px', cursor: 'pointer', transition: 'background 0.3s' }}
                            >
                                {savedIndicator ? <><Check size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
                            </button>

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
                                            onChange={e => setNewChannelTypeInSettings(e.target.value as 'GUILD_TEXT' | 'GUILD_VOICE')}
                                            style={{ background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                        >
                                            <option value="GUILD_TEXT">Text Channel</option>
                                            <option value="GUILD_VOICE">Voice Channel</option>
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
                                                <button onClick={() => handleDeleteChannel(ch.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Trash2 size={14} /></button>
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
                                                        <button onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Edit2 size={12} /></button>
                                                        <button onClick={() => setShowCreateChannelInSettings({ parentId: cat.id })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Plus size={12} /></button>
                                                        <button onClick={() => handleDeleteChannel(cat.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Trash2 size={12} /></button>
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
                                                                <button onClick={() => handleDeleteChannel(ch.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><Trash2 size={14} /></button>
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
                                                    const created = await api.guilds.createRole(guildId, { name: 'New Role', color: colorHexToInt('#71717a') }) as any;
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
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <input type="text" value={editRoleNameVal} onChange={e => setEditRoleNameVal(e.target.value)} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600, outline: 'none' }} autoFocus />
                                                    <input type="color" value={editRoleColorVal} onChange={e => setEditRoleColorVal(e.target.value)} style={{ width: '32px', height: '32px', border: 'none', cursor: 'pointer', borderRadius: '6px' }} />
                                                    <button onClick={saveRoleEdit} style={{ background: 'var(--accent-primary)', border: 'none', padding: '6px 12px', borderRadius: '6px', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Save</button>
                                                    <button onClick={() => setEditingRoleName(false)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '6px 12px', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <h3 style={{ fontSize: '18px', fontWeight: 600 }}>{activeRole.name}</h3>
                                                    <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: activeRole.color }} />
                                                    <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>{activeRole.memberCount} Members</span>
                                                    {activeRole.id !== '1' && (
                                                        <button onClick={() => { setEditingRoleName(true); setEditRoleNameVal(activeRole.name); setEditRoleColorVal(activeRole.color); }}
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

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '8px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                                    <span>Member</span><span>Role</span><span>Status</span><span>Joined</span><span />
                                </div>
                                {filteredMembers.map(member => (
                                    <div key={member.id} onMouseEnter={() => setHoveredBtn(`member-${member.id}`)} onMouseLeave={() => setHoveredBtn(null)}
                                        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '12px 16px', borderRadius: '8px', alignItems: 'center', background: hoveredBtn === `member-${member.id}` ? 'var(--hover-overlay)' : 'transparent' }}
                                    >
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
                                                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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

                    {/* ===================== AUDIT LOG ===================== */}
                    {activeTab === 'audit' && (
                        <>
                            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Audit Log</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Track every action taken in your server. {auditLog.length} entries recorded.</p>

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                                {(['all', 'role', 'channel', 'member', 'settings', 'message'] as const).map(filter => (
                                    <button key={filter} onClick={() => setAuditFilter(filter)}
                                        onMouseEnter={() => setHoveredBtn(`filter-${filter}`)} onMouseLeave={() => setHoveredBtn(null)}
                                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', border: 'none', background: auditFilter === filter ? 'var(--accent-primary)' : hoveredBtn === `filter-${filter}` ? 'var(--hover-overlay)' : 'var(--bg-tertiary)', color: auditFilter === filter ? '#000' : 'var(--text-secondary)' }}
                                    >{filter === 'all' ? `All (${auditLog.length})` : filter}</button>
                                ))}
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
                                                    onClick={() => handleUnban(ban.userId)}
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

                            {/* Existing Emojis Grid */}
                            {customEmojis.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.4 }}>😶</div>
                                    <p style={{ fontSize: '14px', fontWeight: 500 }}>No custom emojis yet</p>
                                    <p style={{ fontSize: '12px' }}>Upload some to give your server personality!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                                    {customEmojis.map(emoji => (
                                        <div key={emoji.id || emoji.name} onMouseEnter={() => setHoveredBtn(`emoji-${emoji.name}`)} onMouseLeave={() => setHoveredBtn(null)}
                                            style={{ background: hoveredBtn === `emoji-${emoji.name}` ? 'var(--hover-overlay)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative', transition: 'background 0.15s' }}
                                        >
                                            <img src={emoji.url} alt={emoji.name} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'contain' }} />
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-all' }}>:{emoji.name}:</div>
                                            {hoveredBtn === `emoji-${emoji.name}` && (
                                                <button onClick={() => handleDeleteEmoji(emoji.id, emoji.name)}
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
                                    <div key={wh.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: wh.avatar, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Link2 size={20} color="white" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{wh.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Posts to {wh.channel} &middot; Created {wh.createdAt}</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => { const apiHost = API_BASE; const url = `${apiHost}/webhooks/${wh.id}/${wh.token}`; navigator.clipboard.writeText(url).catch(() => {}); setCopiedWebhookId(wh.id); setTimeout(() => setCopiedWebhookId(null), 2000); }}
                                                title="Copy Webhook URL"
                                                style={{ padding: '8px', borderRadius: '6px', background: copiedWebhookId === wh.id ? 'rgba(16,185,129,0.15)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: copiedWebhookId === wh.id ? 'var(--success)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                                {copiedWebhookId === wh.id ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                            <button onClick={() => { addToast({ title: 'Token Regeneration', description: 'Webhook tokens are managed by the server. Delete and recreate the webhook to get a new token.', variant: 'info' }); }}
                                                title="Regenerate Token"
                                                style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                                <RefreshCw size={16} />
                                            </button>
                                            <button onClick={async () => { try { await api.webhooks.delete(wh.id); } catch {} setWebhooksList(prev => prev.filter(w => w.id !== wh.id)); addAuditEntry('Webhook Deleted', actorName, wh.name, 'settings'); }}
                                                title="Delete Webhook"
                                                style={{ padding: '8px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
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

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
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
                                        <p style={{ fontSize: '13px', marginTop: '4px' }}>Visit the Bot Store to find and install bots.</p>
                                    </div>
                                )}
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
                </div>
            </div>
        </div>
    );
};

export default GuildSettingsModal;
