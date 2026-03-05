import { useState, useEffect, useRef, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { UserProvider, useUser } from './contexts/UserContext';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider, Navigate, Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Home, Settings, Hash as HashIcon, Mic, Plus, ChevronDown, ChevronRight, MessageSquare, Search, Bell, Bug, Circle, Volume1, Volume2, Copy, Lock, Trash2, X, Check, Minus, ShieldAlert, LogOut, Activity, Ban, Link2, ShoppingBag, Store, Package } from 'lucide-react';
import './components/chat.css';
import CommandPalette from './components/ui/CommandPalette';
import { playSound, setSoundVolume } from './utils/SoundManager';

import AuthLayout from './layouts/AuthLayout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Verify from './pages/auth/Verify';

import HomePage from './pages/app/Home';
import Discover from './pages/app/Discover';
import Friends from './pages/app/Friends';
import Shop from './pages/app/Shop';
import Marketplace from './pages/app/Marketplace';

import Inventory from './pages/app/Inventory';
import FameDashboard from './pages/app/FameDashboard';
import CreatorDashboard from './pages/app/CreatorDashboard';
import ThemeBuilder from './pages/app/ThemeBuilder';
import BotBuilder from './pages/app/BotBuilder';
import BotStore from './pages/app/BotStore';
import DirectMessage from './pages/app/DirectMessage';
import ChannelChat from './pages/guilds/ChannelChat';
import VoiceChannel from './pages/guilds/VoiceChannel';
import GuildOverview from './pages/guilds/GuildOverview';
import AuditLog from './pages/guilds/AuditLog';
import MessageRequests from './pages/app/MessageRequests';
import AdminTeam from './pages/admin/AdminTeam';
import AdminAuditLog from './pages/admin/AdminAuditLog';
import AdminBotModeration from './pages/admin/AdminBotModeration';
import AdminFeedback from './pages/admin/AdminFeedback';
import AdminReports from './pages/admin/AdminReports';
import RequireAdmin from './components/guards/RequireAdmin';
import RequireAuth from './components/guards/RequireAuth';
import HelpCenter from './pages/app/HelpCenter';

import InviteAccept from './pages/InviteAccept';
import { NotFound } from './pages/ErrorStates';
import { getDeterministicGradient } from './utils/colors';
import { api, API_BASE, getAccessToken, ApiRequestError } from './lib/api';
import { connectSocket, disconnectSocket, onPresenceUpdate, onVoiceStateUpdate, onSocketReconnect } from './lib/socket';

import SettingsModal from './components/modals/SettingsModal';
import UserProfileModal from './components/modals/UserProfileModal';
import CreateGuildModal from './components/modals/CreateGuildModal';
import PresenceMenu, { PresenceType, PRESENCE_COLORS } from './components/modals/PresenceMenu';
import ScreenShareModal from './components/modals/ScreenShareModal';
import GuildSettingsModal from './components/modals/GuildSettingsModal';
import InviteModal from './components/modals/InviteModal';
import DMSearchModal from './components/modals/DMSearchModal';

import NotificationModal from './components/modals/NotificationModal';
import KeyboardShortcutsModal from './components/modals/KeyboardShortcutsModal';
import BugReportModal from './components/modals/BugReportModal';
import OnboardingModal from './components/modals/OnboardingModal';
import { Tooltip } from './components/ui/Tooltip';
import { ModalWrapper } from './components/ui/ModalWrapper';
import { useTheme } from './components/ui/ThemeProvider';
import { ContextMenuProvider, useContextMenu } from './components/ui/ContextMenu';
import { ToastProvider, useToast } from './components/ui/ToastManager';
import { Shield as ShieldIcon } from 'lucide-react';
import AchievementToastProvider from './components/ui/AchievementToast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SkeletonChannelGroup, SkeletonDmList, SkeletonMemberList } from './components/ui/SkeletonLoader';
import AmbientPlayer from './components/ui/AmbientPlayer';
import ConnectionBanner from './components/ui/ConnectionBanner';
import { VoiceProvider, useVoice } from './contexts/VoiceContext';
import { useVoiceSounds } from './hooks/useVoiceSounds';
import Avatar from './components/ui/Avatar';
import UserProfilePopover from './components/ui/UserProfilePopover';
import { useGuildSession, type GuildSessionErrorCode, type GuildSessionInfo, type GuildSessionChannel } from './hooks/useGuildSession';
import { isAuthRuntimeExpired } from './lib/authRuntime';

type MediaType = 'video' | 'image' | null;
type ModalType = 'settings' | 'userProfile' | 'createGuild' | 'screenShare' | 'guildSettings' | 'invite' | 'globalSearch' | 'dmSearch' | 'notifications' | 'shortcuts' | 'bugReport' | 'onboarding' | null;
type VoiceSidebarMember = {
    userId: string;
    username: string;
    displayName: string;
    selfMute: boolean;
    selfDeaf: boolean;
};

type GuildSessionViewState = {
    guildInfo: GuildSessionInfo | null;
    channels: GuildSessionChannel[];
    loading: boolean;
    errorCode: GuildSessionErrorCode;
    lastFailureAt: number | null;
    refresh: () => Promise<void>;
    setChannels: Dispatch<SetStateAction<GuildSessionChannel[]>>;
    enabled: boolean;
};

const mapAvatarFrameFromEquippedName = (name: string | null | undefined): 'none' | 'neon' | 'gold' | 'glass' => {
    const value = String(name ?? '').toLowerCase();
    if (!value) return 'none';
    if (value.includes('neon')) return 'neon';
    if (value.includes('gold')) return 'gold';
    if (value.includes('glass') || value.includes('frost')) return 'glass';
    return 'none';
};

const mapNameplateStyleFromEquippedName = (name: string | null | undefined): 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch' => {
    const value = String(name ?? '').toLowerCase();
    if (!value) return 'none';
    if (value.includes('rainbow')) return 'rainbow';
    if (value.includes('fire')) return 'fire';
    if (value.includes('ice')) return 'ice';
    if (value.includes('gold')) return 'gold';
    if (value.includes('glitch')) return 'glitch';
    return 'none';
};

const getStoredNameplateStyle = (userId?: string): 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch' | null => {
    const key = `gratonite-nameplate-style:${userId || 'me'}`;
    try {
        const value = localStorage.getItem(key) || localStorage.getItem('gratonite-nameplate-style');
        if (value === 'none' || value === 'rainbow' || value === 'fire' || value === 'ice' || value === 'gold' || value === 'glitch') {
            return value;
        }
    } catch { /* no-op */ }
    return null;
};

const getStoredAvatarFrame = (userId?: string): 'none' | 'neon' | 'gold' | 'glass' | null => {
    const key = `gratonite-avatar-frame:${userId || 'me'}`;
    try {
        const value = localStorage.getItem(key) || localStorage.getItem('gratonite-avatar-frame');
        if (value === 'none' || value === 'neon' || value === 'gold' || value === 'glass') {
            return value;
        }
    } catch { /* no-op */ }
    return null;
};

const LegacyGuildChannelRedirect = () => {
    const { guildId, channelId } = useParams();
    if (!guildId || !channelId) return <Navigate to="/" replace />;
    return <Navigate to={`/guild/${guildId}/channel/${channelId}`} replace />;
};

const LegacyGuildVoiceRedirect = () => {
    const { guildId, channelId } = useParams();
    if (!guildId || !channelId) return <Navigate to="/" replace />;
    return <Navigate to={`/guild/${guildId}/voice/${channelId}`} replace />;
};

// Common Gradient Orbs for background


// BackgroundMedia moved to src/components/ui/BackgroundMedia.tsx

const GuildRail = ({ isOpen, onOpenCreateGuild, onOpenNotifications, onOpenBugReport, onOpenProfile, onOpenSettings, onOpenGuildSettings, onOpenInvite, onGuildsRefresh, guilds, userProfile }: { isOpen: boolean, onOpenCreateGuild: () => void, onOpenNotifications: () => void, onOpenBugReport: () => void, onOpenProfile: () => void, onOpenSettings: () => void, onOpenGuildSettings: () => void, onOpenInvite: () => void, onGuildsRefresh?: () => void, guilds: Array<{ id: string; name: string; iconHash: string | null; description: string | null; memberCount: number }>, userProfile: { id?: string; name: string; avatarHash?: string | null; avatarFrame?: 'none' | 'neon' | 'gold' | 'glass' } }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { openMenu } = useContextMenu();
    const { addToast } = useToast();
    const isAppRoot = location.pathname === '/' || [
        '/friends', '/discover', '/shop', '/marketplace', '/inventory',
        '/creator-dashboard', '/fame', '/dm',
        '/admin', '/help-center', '/message-requests'
    ].some(path => location.pathname.startsWith(path));

    const activeGuildId = (() => {
        const match = location.pathname.match(/\/guild\/([^/]+)/);
        return match ? match[1] : null;
    })();

    const handleGuildContext = (e: React.MouseEvent, guild: { id: string; name: string }) => {
        e.preventDefault();
        let overrides: Record<string, boolean> = {};
        try { overrides = JSON.parse(localStorage.getItem('gratonite-server-activity-overrides') || '{}'); } catch {}
        const autoShare = localStorage.getItem('gratonite-auto-share-on-join') !== 'false';
        const activityEnabled = overrides[guild.id] ?? autoShare;

        openMenu(e, [
            { id: 'mark-read', label: 'Mark as Read', icon: Check, onClick: () => addToast({ title: `${guild.name} marked as read`, variant: 'info' }) },
            { id: 'mute', label: 'Mute Server', icon: Volume1, onClick: () => addToast({ title: `${guild.name} muted`, variant: 'info' }) },
            { divider: true, id: 'div1', label: '', onClick: () => {} },
            { id: 'server-settings', label: 'Server Settings', icon: Settings, onClick: () => { navigate(`/guild/${guild.id}`); onOpenGuildSettings(); } },
            { id: 'invite', label: 'Invite People', icon: Link2, onClick: () => {
                api.invites.create(guild.id, { channelId: guild.id }).then((invite) => {
                    const link = `${window.location.origin}/invite/${invite.code}`;
                    navigator.clipboard.writeText(link).catch(() => {});
                    addToast({ title: 'Invite link copied to clipboard', variant: 'success' });
                }).catch(() => onOpenInvite());
            }},
            { id: 'notification-settings', label: 'Notification Settings', icon: Bell, onClick: () => addToast({ title: 'Notification Settings', variant: 'info' }) },
            { id: 'activity-toggle', label: activityEnabled ? 'Disable Activity Status' : 'Enable Activity Status', icon: Activity, onClick: () => {
                const newOverrides = { ...overrides, [guild.id]: !activityEnabled };
                try { localStorage.setItem('gratonite-server-activity-overrides', JSON.stringify(newOverrides)); } catch {}
                addToast({ title: `Activity ${!activityEnabled ? 'enabled' : 'disabled'} for ${guild.name}`, variant: 'success' });
            }},
            { id: 'privacy-settings', label: 'Privacy Settings', icon: ShieldIcon, onClick: () => onOpenSettings() },
            { divider: true, id: 'div2', label: '', onClick: () => {} },
            { id: 'copy-id', label: 'Copy Server ID', icon: Copy, onClick: () => { navigator.clipboard.writeText(guild.id).catch(() => {}); addToast({ title: 'Server ID copied', variant: 'info' }); } },
            { id: 'leave', label: 'Leave Server', icon: LogOut, color: 'var(--error)', onClick: () => {
                api.guilds.leave(guild.id).then(() => {
                    onGuildsRefresh?.();
                    addToast({ title: `Left ${guild.name}`, variant: 'info' });
                    if (location.pathname.startsWith(`/guild/${guild.id}`)) navigate('/');
                }).catch(() => addToast({ title: 'Failed to leave server', variant: 'error' }));
            }},
        ]);
    };

    return (
        <nav className={`guild-rail glass-panel ${isOpen ? 'open' : ''}`}>
            <Link to="/" style={{ textDecoration: 'none' }}>
                <div className={`guild-icon ${isAppRoot ? 'active' : ''}`} style={!isAppRoot ? { background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.5))' } : {}}>
                    {isAppRoot && <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2), transparent)', width: '100%', height: '100%', borderRadius: 'inherit', position: 'absolute' }}></div>}
                    <Home size={24} />
                </div>
            </Link>

            <Tooltip content="Profile" position="right">
                <div className="guild-icon" onClick={onOpenProfile} style={{ cursor: 'pointer', overflow: 'hidden', padding: 0 }}>
                    <Avatar
                        userId={userProfile.id || 'me'}
                        avatarHash={userProfile.avatarHash}
                        displayName={userProfile.name || 'User'}
                        frame={userProfile.avatarFrame as 'none' | 'neon' | 'gold' | 'glass'}
                        size={48}
                        style={{ borderRadius: 'inherit' }}
                    />
                </div>
            </Tooltip>

            <Tooltip content="Inbox" position="right">
                <div className="guild-icon" onClick={onOpenNotifications} style={{ background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', position: 'relative' }}>
                    <Bell size={24} />
                </div>
            </Tooltip>

            <div style={{ width: '32px', height: '2px', background: 'var(--stroke)', margin: '4px 0' }}></div>

            {guilds.map(guild => (
                <Tooltip key={guild.id} content={guild.name} position="right">
                    <Link to={`/guild/${guild.id}`} style={{ textDecoration: 'none' }} onContextMenu={(e) => handleGuildContext(e, guild)}>
                        <div className={`guild-icon ${activeGuildId === guild.id ? 'active' : ''}`}
                             style={{ background: getDeterministicGradient(guild.name), color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                            {guild.iconHash ? (
                                <img
                                    src={`${API_BASE}/files/${guild.iconHash}`}
                                    alt={guild.name}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                                />
                            ) : (
                                guild.name.charAt(0).toUpperCase()
                            )}
                        </div>
                    </Link>
                </Tooltip>
            ))}

            <Tooltip content="Create Guild" position="right">
                <div className="guild-icon" onClick={onOpenCreateGuild} style={{ background: 'transparent', border: '1px dashed var(--stroke-light)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Plus size={24} />
                </div>
            </Tooltip>

            <div style={{ flex: 1 }}></div>

            <Tooltip content="Report Bug" position="right">
                <div className="guild-icon" onClick={onOpenBugReport} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '8px' }}>
                    <Bug size={24} />
                </div>
            </Tooltip>
        </nav>
    );
};

const ChannelSidebar = ({ isOpen, onOpenSettings, onOpenProfile, onOpenGlobalSearch, onOpenDMSearch, userProfile, guildSession }: { isOpen: boolean, onOpenSettings: () => void, onOpenProfile: () => void, onOpenGlobalSearch: () => void, onOpenDMSearch: () => void, userProfile: { id?: string, name: string, handle: string, status: string, customStatus: string, avatarStyle: string, avatarFrame: string, nameplateStyle?: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch', avatarHash?: string | null, badges: string[] }, guildSession: GuildSessionViewState }) => {
    const { openMenu } = useContextMenu();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const voiceState = useVoice();
    const [channelPermsOpen, setChannelPermsOpen] = useState<{ id: string; name: string } | null>(null);
    const [channelPermsRoles, setChannelPermsRoles] = useState<Array<{ id: string; name: string; color: string | null }>>([]);
    const [channelPermsOverrides, setChannelPermsOverrides] = useState<Array<{ id: string; targetId: string; targetType: string; allow: string; deny: string }>>([]);
    const [channelPermsSaving, setChannelPermsSaving] = useState(false);
    const [editingChannel, setEditingChannel] = useState<string | null>(null);
    const [permStates, setPermStates] = useState<Record<string, Record<string, 'neutral' | 'allow' | 'deny'>>>({});
    const [privateToggle, setPrivateToggle] = useState(false);
    const [showCreateChannel, setShowCreateChannel] = useState<{ type: 'text' | 'voice'; parentId?: string } | null>(null);
    const [newChannelName, setNewChannelName] = useState('');

    // Guild data for guild mode
    const location = useLocation();
    const guildMatch = location.pathname.match(/\/guild\/([^/]+)/);
    const activeGuildId = guildMatch ? guildMatch[1] : null;
    const [legacyGuildInfo, setLegacyGuildInfo] = useState<{ id: string; name: string; iconHash: string | null; description: string | null; memberCount: number } | null>(null);
    const [legacyGuildChannels, setLegacyGuildChannels] = useState<Array<{ id: string; name: string; type: string; parentId: string | null; position: number; topic: string | null }>>([]);
    const [legacyChannelsLoading, setLegacyChannelsLoading] = useState(false);
    const guildInfo = guildSession.enabled ? guildSession.guildInfo : legacyGuildInfo;
    const guildChannels = guildSession.enabled ? guildSession.channels : legacyGuildChannels;
    const setGuildChannels = guildSession.enabled ? guildSession.setChannels : setLegacyGuildChannels;
    const enableVoiceSidebarSync = true;
    const [voiceMembersByChannel, setVoiceMembersByChannel] = useState<Record<string, VoiceSidebarMember[]>>({});
    const [dmChannels, setDmChannels] = useState<Array<{ id: string; recipientIds?: string[]; recipients?: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }> }>>([]);
    const [isDmLoading, setIsDmLoading] = useState(true);
    const isChannelsLoading = guildSession.enabled ? guildSession.loading : legacyChannelsLoading;
    const guildLoadErrorCode = guildSession.enabled ? guildSession.errorCode : null;
    const [messageRequests, setMessageRequests] = useState<Array<{ id: string; recipients?: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>; isSpam?: boolean; preview?: string }>>([]);
    const voiceStateMapsEqual = useCallback(
        (a: Record<string, VoiceSidebarMember[]>, b: Record<string, VoiceSidebarMember[]>) => {
            const aKeys = Object.keys(a);
            const bKeys = Object.keys(b);
            if (aKeys.length !== bKeys.length) return false;
            for (const key of aKeys) {
                const aMembers = a[key] || [];
                const bMembers = b[key] || [];
                if (aMembers.length !== bMembers.length) return false;
                for (let i = 0; i < aMembers.length; i += 1) {
                    const left = aMembers[i];
                    const right = bMembers[i];
                    if (
                        left.userId !== right.userId ||
                        left.username !== right.username ||
                        left.displayName !== right.displayName ||
                        left.selfMute !== right.selfMute ||
                        left.selfDeaf !== right.selfDeaf
                    ) {
                        return false;
                    }
                }
            }
            return true;
        },
        [],
    );
    const isVoiceChannelType = useCallback((type: string) => {
        return type === 'voice' || type === 'GUILD_VOICE' || type === 'stage' || type === 'GUILD_STAGE_VOICE';
    }, []);
    const normalizeVoiceMember = useCallback((state: any): VoiceSidebarMember | null => {
        const userId = typeof state?.userId === 'string' ? state.userId : '';
        if (!userId) return null;
        const username = typeof state?.username === 'string' ? state.username : '';
        const displayName = typeof state?.displayName === 'string' && state.displayName.trim()
            ? state.displayName
            : (username || userId.slice(0, 8));
        return {
            userId,
            username,
            displayName,
            selfMute: Boolean(state?.selfMute),
            selfDeaf: Boolean(state?.selfDeaf),
        };
    }, []);

    const removeMemberFromAllChannels = useCallback((prev: Record<string, VoiceSidebarMember[]>, userId: string): Record<string, VoiceSidebarMember[]> => {
        const next: Record<string, VoiceSidebarMember[]> = {};
        for (const [channelId, members] of Object.entries(prev)) {
            next[channelId] = members.filter((member) => member.userId !== userId);
        }
        return next;
    }, []);

    useEffect(() => {
        if (guildSession.enabled) return;
        if (activeGuildId) {
            setLegacyChannelsLoading(true);
            void api.guilds.get(activeGuildId)
                .then((guild) => setLegacyGuildInfo(guild as any))
                .catch(() => setLegacyGuildInfo(null))
                .finally(() => setLegacyChannelsLoading(false));
            void api.channels.getGuildChannels(activeGuildId)
                .then((chs) => setLegacyGuildChannels(chs as any))
                .catch(() => setLegacyGuildChannels([]));
        } else {
            setLegacyGuildInfo(null);
            setLegacyGuildChannels([]);
            setLegacyChannelsLoading(false);
        }
    }, [activeGuildId, guildSession.enabled]);

    useEffect(() => {
        if (!enableVoiceSidebarSync) return;
        if (!activeGuildId) {
            setVoiceMembersByChannel({});
        }
    }, [activeGuildId, enableVoiceSidebarSync]);

    const hydrateVoiceMembersForGuild = useCallback(async (guildId: string, channelsForGuild: Array<{ id: string; type: string }>) => {
        if (!enableVoiceSidebarSync) return;
        const voiceChannels = channelsForGuild.filter((ch) => isVoiceChannelType(ch.type));
        if (voiceChannels.length === 0) {
            return;
        }

        const entries = await Promise.all(
            voiceChannels.map(async (channel) => {
                try {
                    const rawStates = await api.voice.getChannelStates(channel.id);
                    const members = rawStates
                        .map((rawState) => normalizeVoiceMember(rawState))
                        .filter((member): member is VoiceSidebarMember => Boolean(member));
                    return [channel.id, members] as const;
                } catch {
                    return [channel.id, [] as VoiceSidebarMember[]] as const;
                }
            }),
        );

        setVoiceMembersByChannel((prev) => {
            const next: Record<string, VoiceSidebarMember[]> = {};
            for (const [channelId, members] of entries) {
                // Normalize de-dupe by userId
                const byUser = new Map<string, VoiceSidebarMember>();
                for (const member of members) {
                    byUser.set(member.userId, member);
                }
                next[channelId] = Array.from(byUser.values());
            }
            return voiceStateMapsEqual(prev, next) ? prev : next;
        });
    }, [enableVoiceSidebarSync, isVoiceChannelType, normalizeVoiceMember, voiceStateMapsEqual]);

    const guildChannelsSignature = useMemo(
        () => guildChannels.map((channel) => `${channel.id}:${channel.type}`).join('|'),
        [guildChannels],
    );

    useEffect(() => {
        if (!enableVoiceSidebarSync) return;
        let cancelled = false;

        if (!activeGuildId) {
            setVoiceMembersByChannel((prev) => (Object.keys(prev).length === 0 ? prev : {}));
            return;
        }

        hydrateVoiceMembersForGuild(activeGuildId, guildChannels).catch(() => {
            if (!cancelled) return;
        });

        return () => {
            cancelled = true;
        };
    }, [activeGuildId, enableVoiceSidebarSync, guildChannels, guildChannelsSignature, hydrateVoiceMembersForGuild]);

    useEffect(() => {
        if (!enableVoiceSidebarSync) return;
        if (!activeGuildId) return;

        const guildChannelIds = new Set(guildChannels.map((ch) => ch.id));
        const unsub = onVoiceStateUpdate((payload) => {
            if (!guildChannelIds.has(payload.channelId)) return;

            setVoiceMembersByChannel((prev) => {
                const next = removeMemberFromAllChannels(prev, payload.userId);

                if (payload.type === 'join') {
                    const joinedMember: VoiceSidebarMember = {
                        userId: payload.userId,
                        username: payload.username || '',
                        displayName: payload.displayName || payload.username || 'Unknown',
                        selfMute: Boolean(payload.selfMute),
                        selfDeaf: Boolean(payload.selfDeaf),
                    };
                    const current = next[payload.channelId] || [];
                    next[payload.channelId] = [...current, joinedMember];
                }

                return next;
            });
        });

        return unsub;
    }, [activeGuildId, enableVoiceSidebarSync, guildChannels, removeMemberFromAllChannels]);

    useEffect(() => {
        if (!enableVoiceSidebarSync) return;
        if (!activeGuildId) return;

        const unsub = onSocketReconnect(() => {
            void hydrateVoiceMembersForGuild(activeGuildId, guildChannels);
        });

        return unsub;
    }, [activeGuildId, enableVoiceSidebarSync, guildChannels, hydrateVoiceMembersForGuild]);

    const previousVoiceChannelRef = useRef<string | null>(null);
    useEffect(() => {
        if (!enableVoiceSidebarSync) return;
        const currentVoiceChannelId = voiceState.connected ? voiceState.channelId : null;
        const previousVoiceChannelId = previousVoiceChannelRef.current;
        previousVoiceChannelRef.current = currentVoiceChannelId;

        if (currentVoiceChannelId || !previousVoiceChannelId || !userProfile.id) return;

        setVoiceMembersByChannel((prev) => removeMemberFromAllChannels(prev, userProfile.id!));
    }, [enableVoiceSidebarSync, voiceState.connected, voiceState.channelId, userProfile.id, removeMemberFromAllChannels]);

    useEffect(() => {
        setIsDmLoading(true);
        api.relationships.getDmChannels().then(setDmChannels).catch(() => { addToast({ title: 'Failed to load direct messages', variant: 'error' }); }).finally(() => setIsDmLoading(false));
    }, []);

    const cyclePermState = (role: string, perm: string) => {
        setPermStates(prev => {
            const current = prev[role]?.[perm] || 'neutral';
            const next = current === 'neutral' ? 'allow' : current === 'allow' ? 'deny' : 'neutral';
            return { ...prev, [role]: { ...prev[role], [perm]: next } };
        });
    };

    const handleDuplicateChannel = (channelName: string) => {
        addToast({ title: 'Channel Duplicated', description: `#${channelName}-copy has been created with the same permissions.`, variant: 'success' });
    };

    const handleCreateChannel = async () => {
        if (!activeGuildId || !newChannelName.trim() || !showCreateChannel) return;
        try {
            const channelType = showCreateChannel.type === 'voice' ? 'GUILD_VOICE' : 'GUILD_TEXT';
            await api.channels.create(activeGuildId, {
                name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
                type: channelType,
                parentId: showCreateChannel.parentId,
            });
            if (guildSession.enabled) {
                await guildSession.refresh();
            } else {
                const chs = await api.channels.getGuildChannels(activeGuildId);
                setLegacyGuildChannels(chs as any);
            }
            setShowCreateChannel(null);
            setNewChannelName('');
            addToast({ title: 'Channel Created', description: `#${newChannelName.trim().toLowerCase().replace(/\s+/g, '-')} has been created.`, variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Failed to create channel', description: err?.message || 'Something went wrong.', variant: 'error' });
        }
    };

    const handleChannelContext = (e: React.MouseEvent, channel: { id: string; name: string }) => {
        openMenu(e, [
            { id: 'mark-read', label: 'Mark as Read', icon: Circle, onClick: () => addToast({ title: 'Channel Marked as Read', variant: 'info' }) },
            { id: 'mute', label: 'Mute Channel', icon: Volume1, onClick: () => addToast({ title: 'Channel Muted', variant: 'info' }) },
            { divider: true, id: 'div1', label: '', onClick: () => {} },
            { id: 'edit', label: 'Edit Channel', icon: Settings, onClick: () => setEditingChannel(channel.name) },
            { id: 'duplicate', label: 'Duplicate Channel', icon: Copy, onClick: () => handleDuplicateChannel(channel.name) },
            { id: 'permissions', label: 'Channel Permissions', icon: ShieldIcon, onClick: () => {
                setChannelPermsOpen({ id: channel.id, name: channel.name });
                if (activeGuildId) {
                    api.guilds.getRoles(activeGuildId).then((r: any) => setChannelPermsRoles(r.map((role: any) => ({ id: role.id, name: role.name, color: role.color })))).catch(() => {});
                    api.channels.getPermissionOverrides(channel.id).then((o: any) => setChannelPermsOverrides(o)).catch(() => {});
                }
            }},
            { divider: true, id: 'div2', label: '', onClick: () => {} },
            { id: 'copy-id', label: 'Copy Channel ID', icon: Copy, onClick: () => { navigator.clipboard.writeText(channel.id).catch(() => {}); addToast({ title: 'Channel ID copied', variant: 'info' }); } },
            { id: 'invite', label: 'Create Invite Link', icon: Link2, onClick: () => {
                if (!activeGuildId) return;
                api.invites.create(activeGuildId, { channelId: channel.id }).then((invite) => {
                    const link = `${window.location.origin}/invite/${invite.code}`;
                    navigator.clipboard.writeText(link).catch(() => {});
                    addToast({ title: 'Invite link copied to clipboard', variant: 'success' });
                }).catch(() => addToast({ title: 'Failed to create invite', variant: 'error' }));
            }},
            { id: 'private', label: 'Make Private', icon: Lock, onClick: () => addToast({ title: `${channel.name} is now private`, description: 'Only selected roles can view this channel.', variant: 'success' }) },
            { id: 'settings', label: 'Notification Settings', icon: Bell, onClick: () => addToast({ title: 'Notification Settings', variant: 'info' }) },
            { divider: true, id: 'div3', label: '', onClick: () => {} },
            { id: 'delete', label: 'Delete Channel', icon: Trash2, color: 'var(--error)', onClick: () => {
                api.channels.delete(channel.id).then(() => {
                    setGuildChannels(prev => prev.filter(c => c.id !== channel.id));
                    addToast({ title: `#${channel.name} deleted`, variant: 'error' });
                    if (location.pathname.includes(`/channel/${channel.id}`) || location.pathname.includes(`/voice/${channel.id}`)) {
                        navigate(activeGuildId ? `/guild/${activeGuildId}` : '/');
                    }
                }).catch(() => addToast({ title: 'Failed to delete channel', variant: 'error' }));
            }},
        ]);
    };

    const isAppRoot = location.pathname === '/' || [
        '/friends', '/discover', '/shop', '/marketplace', '/inventory',
        '/creator-dashboard', '/fame', '/dm',
        '/admin', '/help-center', '/message-requests'
    ].some(path => location.pathname.startsWith(path));

    const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
    const [presence, setPresence] = useState<PresenceType>('online');
    const [customStatus, setCustomStatus] = useState<string | null>(null);
    const [micMuted, setMicMuted] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('gratonite-sidebar-collapsed');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    useEffect(() => {
        localStorage.setItem('gratonite-sidebar-collapsed', JSON.stringify(collapsed));
    }, [collapsed]);

    const toggleCategory = (cat: string) => {
        setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const userAvatarUrl = userProfile.avatarHash ? `${API_BASE}/files/${userProfile.avatarHash}` : null;

    const UserPanel = () => (
        <div className="user-panel">
            <Avatar
                userId={userProfile.id || 'me'}
                avatarHash={userProfile.avatarHash}
                displayName={userProfile.name || 'User'}
                frame={userProfile.avatarFrame as 'none' | 'neon' | 'gold' | 'glass'}
                size={36}
                status={presence as any}
                statusRingColor="var(--bg-sidebar)"
                onClick={() => setPresenceMenuOpen(!presenceMenuOpen)}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span
                    className={userProfile.nameplateStyle && userProfile.nameplateStyle !== 'none' ? `nameplate-${userProfile.nameplateStyle}` : undefined}
                    onClick={onOpenProfile}
                    style={{ fontSize: '0.95rem', fontWeight: 600, color: 'white', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                    {userProfile.name || 'User'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {customStatus ? customStatus : (presence === 'dnd' ? 'Do Not Disturb' : presence.charAt(0).toUpperCase() + presence.slice(1))}
                </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', color: 'var(--text-secondary)' }}>
                <button
                    type="button"
                    onClick={() => setMicMuted(m => !m)}
                    title={micMuted ? 'Unmute mic' : 'Mute mic'}
                    style={{
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                        color: micMuted ? 'var(--error)' : 'var(--text-secondary)',
                        display: 'flex',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                    }}
                >
                    <Mic size={18} />
                </button>
                <button
                    type="button"
                    data-testid="settings-btn"
                    aria-label="Open settings"
                    onClick={onOpenSettings}
                    style={{
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                    }}
                >
                    <Settings size={18} />
                </button>
            </div>

            <PresenceMenu
                isOpen={presenceMenuOpen}
                onClose={() => setPresenceMenuOpen(false)}
                currentPresence={presence}
                onChangePresence={setPresence}
                customStatus={customStatus}
                onChangeStatus={setCustomStatus}
                onOpenProfile={() => { setPresenceMenuOpen(false); onOpenProfile(); }}
                onOpenSettings={() => { setPresenceMenuOpen(false); onOpenSettings(); }}
                onLogout={async () => {
                    try { await api.auth.logout(); } catch { /* ignore */ }
                    window.localStorage.removeItem('gratonite_access_token');
                    window.localStorage.removeItem('gratonite_user');
                    window.location.replace('/app/login');
                }}
                userName={userProfile.name}
                avatarUrl={userAvatarUrl}
            />
        </div>
    );

    if (isAppRoot) {
        return (
            <aside className={`channel-sidebar glass-panel ${isOpen ? 'open' : ''}`}>
                <div className="channel-list" style={{ paddingTop: '16px' }} onClick={(e) => { if ((e.target as HTMLElement).closest('.channel-item')) playSound('click'); }}>
                    <Link to="/" style={{ textDecoration: 'none' }}>
                        <div className={`channel-item ${location.pathname === '/' ? 'active' : ''}`}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Home size={18} />
                            </div>
                            <span style={{ fontSize: '15px' }}>Home</span>
                        </div>
                    </Link>
                    <Link to="/friends" style={{ textDecoration: 'none' }}>
                        <div className={`channel-item ${location.pathname === '/friends' ? 'active' : ''}`}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <span style={{ fontSize: '15px' }}>Friends</span>
                        </div>
                    </Link>
                    <Link to="/discover" style={{ textDecoration: 'none' }}>
                        <div className={`channel-item ${location.pathname === '/discover' ? 'active' : ''}`}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
                            </div>
                            <span style={{ fontSize: '15px' }}>Discover</span>
                        </div>
                    </Link>
                    <Link to="/shop" style={{ textDecoration: 'none' }}>
                        <div className={`channel-item ${location.pathname === '/shop' ? 'active' : ''}`}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ShoppingBag size={18} />
                            </div>
                            <span style={{ fontSize: '15px' }}>Shop</span>
                        </div>
                    </Link>
                    <Link to="/marketplace" style={{ textDecoration: 'none' }}>
                        <div className={`channel-item ${location.pathname === '/marketplace' ? 'active' : ''}`}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Store size={18} />
                            </div>
                            <span style={{ fontSize: '15px' }}>Marketplace</span>
                        </div>
                    </Link>
                    <Link to="/inventory" style={{ textDecoration: 'none' }}>
                        <div className={`channel-item ${location.pathname === '/inventory' ? 'active' : ''}`}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Package size={18} />
                            </div>
                            <span style={{ fontSize: '15px' }}>Inventory</span>
                        </div>
                    </Link>
                </div>

                <div className="channel-list" style={{ marginTop: '16px' }}>
                    <div className="channel-category" onClick={() => toggleCategory('dm')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {collapsed['dm'] ? <ChevronRight size={14} /> : <ChevronDown size={14} />} <span>Direct Messages</span>
                        </div>
                        <Plus size={14} style={{ color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); onOpenDMSearch(); }} />
                    </div>

                    {!collapsed['dm'] && (
                        <>
                            {/* Message Requests folder */}
                            {messageRequests.length > 0 && (
                                <Link to="/message-requests" style={{ textDecoration: 'none' }}>
                                    <div className={`channel-item ${location.pathname === '/message-requests' ? 'active' : ''}`} style={{ gap: '10px' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple, #8b5cf6))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', flexShrink: 0,
                                        }}>
                                            <ShieldAlert size={16} />
                                        </div>
                                        <span style={{ fontSize: '14px', flex: 1 }}>Message Requests</span>
                                        <span style={{
                                            background: 'var(--error, #ef4444)',
                                            color: 'white',
                                            borderRadius: '10px',
                                            padding: '1px 6px',
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            minWidth: '18px',
                                            textAlign: 'center',
                                        }}>{messageRequests.length}</span>
                                    </div>
                                </Link>
                            )}

                            {/* Always show the Message Requests link (without badge) when on that page */}
                            {messageRequests.length === 0 && location.pathname === '/message-requests' && (
                                <Link to="/message-requests" style={{ textDecoration: 'none' }}>
                                    <div className="channel-item active" style={{ gap: '10px' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple, #8b5cf6))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', flexShrink: 0,
                                        }}>
                                            <ShieldAlert size={16} />
                                        </div>
                                        <span style={{ fontSize: '14px', flex: 1 }}>Message Requests</span>
                                    </div>
                                </Link>
                            )}

                            {isDmLoading ? (
                                <SkeletonDmList count={4} />
                            ) : dmChannels.length === 0 ? (
                                <div style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    No conversations yet
                                </div>
                            ) : (
                                dmChannels.map((dm: any) => {
                                    const recipient = dm.otherUser || dm.recipients?.[0];
                                    const displayName = recipient?.displayName || recipient?.username || 'Unknown';
                                    return (
                                        <Link key={dm.id} to={`/dm/${dm.id}`} style={{ textDecoration: 'none' }}>
                                            <div className={`channel-item ${location.pathname === `/dm/${dm.id}` ? 'active' : ''}`}>
                                                <Avatar
                                                    userId={recipient?.id || dm.id}
                                                    avatarHash={recipient?.avatarHash}
                                                    displayName={displayName}
                                                    size={32}
                                                />
                                                <span style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                                            </div>
                                        </Link>
                                    );
                                })
                            )}
                        </>
                    )}
                </div>

                <UserPanel />
            </aside>
        );
    }

    return (
        <aside className={`channel-sidebar glass-panel ${isOpen ? 'open' : ''}`}>
            <header className="sidebar-header" style={{ cursor: 'pointer' }}>
                <Link to={activeGuildId ? `/guild/${activeGuildId}` : '/guild'} style={{ color: 'inherit', textDecoration: 'none' }}>{guildInfo?.name || 'Loading...'}</Link>
            </header>

            <div style={{ padding: '16px 16px 0 16px' }}>
                <div
                    onClick={onOpenGlobalSearch}
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Search size={14} /> Search
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, background: 'var(--bg-elevated)', padding: '2px 4px', borderRadius: '4px' }}>⌘K</div>
                </div>
            </div>

            <div className="channel-list">
                {guildLoadErrorCode === 'FORBIDDEN' && (
                    <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        You no longer have access to this server.
                    </div>
                )}
                {guildLoadErrorCode === 'NOT_FOUND' && (
                    <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Server not found or deleted.
                    </div>
                )}
                {isChannelsLoading && guildChannels.length === 0 ? (
                    <>
                        <SkeletonChannelGroup channels={3} />
                        <SkeletonChannelGroup channels={4} />
                    </>
                ) : null}
                {(() => {
                    if (guildLoadErrorCode === 'FORBIDDEN' || guildLoadErrorCode === 'NOT_FOUND') return null;
                    if (isChannelsLoading && guildChannels.length === 0) return null;
                    // Group channels by category (parentId)
                    const isCategoryType = (type: string) => type === 'category' || type === 'GUILD_CATEGORY';
                    const categories = guildChannels.filter(c => isCategoryType(c.type)).sort((a, b) => a.position - b.position);
                    const uncategorized = guildChannels.filter(c => !isCategoryType(c.type) && !c.parentId).sort((a, b) => a.position - b.position);
                    const channelsByParent = new Map<string, typeof guildChannels>();
                    for (const ch of guildChannels) {
                        if (isCategoryType(ch.type) || !ch.parentId) continue;
                        const list = channelsByParent.get(ch.parentId) || [];
                        list.push(ch);
                        channelsByParent.set(ch.parentId, list);
                    }
                    for (const [key, list] of channelsByParent) {
                        channelsByParent.set(key, list.sort((a, b) => a.position - b.position));
                    }

                    const renderChannel = (ch: typeof guildChannels[0]) => {
                        const isVoice = isVoiceChannelType(ch.type);
                        const gId = activeGuildId!;
                        const isConnectedChannel = isVoice && voiceState.connected && voiceState.channelId === ch.id;
                        const voiceMembers = voiceMembersByChannel[ch.id] || [];
                        const voiceCount = voiceMembers.length;

                        if (isVoice) {
                            // Voice channels: click joins voice, doesn't navigate away
                            return (
                                <div key={ch.id} onContextMenu={(e) => handleChannelContext(e, ch)}>
                                    <div
                                        className={`channel-item ${isConnectedChannel ? 'active' : ''}`}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                                        onClick={() => {
                                            if (isConnectedChannel) {
                                                // Already connected — navigate to the voice channel view
                                                navigate(`/guild/${gId}/voice/${ch.id}`);
                                            } else {
                                                // Join voice channel
                                                navigate(`/guild/${gId}/voice/${ch.id}`);
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                            <Volume2 size={18} style={{ flexShrink: 0, opacity: 0.7 }} />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                                        </div>
                                        {voiceCount > 0 && (
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: isConnectedChannel ? '#43b581' : 'var(--text-muted)',
                                                background: isConnectedChannel ? 'rgba(67, 181, 129, 0.15)' : 'var(--bg-tertiary)',
                                                padding: '1px 6px',
                                                borderRadius: '8px', flexShrink: 0, lineHeight: '16px',
                                            }}>
                                                {voiceCount}
                                            </span>
                                        )}
                                    </div>
                                    {voiceMembers.length > 0 && (
                                        <div style={{ margin: '4px 0 8px 30px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {voiceMembers.map((member) => (
                                                <div key={`${ch.id}-${member.userId}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                                    <Avatar
                                                        userId={member.userId}
                                                        avatarHash={null}
                                                        displayName={member.displayName}
                                                        frame={member.userId === userProfile.id ? (userProfile.avatarFrame as 'none' | 'neon' | 'gold' | 'glass') : 'none'}
                                                        size={16}
                                                    />
                                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {member.displayName}
                                                    </span>
                                                    {member.selfMute && (
                                                        <Mic size={11} style={{ color: 'var(--text-muted)', opacity: 0.8, marginLeft: 'auto', flexShrink: 0 }} />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Text channels: navigate normally
                        const linkTo = `/guild/${gId}/channel/${ch.id}`;
                        const isActive = location.pathname === linkTo;
                        return (
                            <Link key={ch.id} to={linkTo} style={{ textDecoration: 'none' }} onContextMenu={(e) => handleChannelContext(e, ch)}>
                                <div className={`channel-item ${isActive ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                        <HashIcon size={18} style={{ flexShrink: 0, opacity: 0.7 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                                    </div>
                                </div>
                            </Link>
                        );
                    };

                    if (guildChannels.length === 0) {
                        return (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                <p>No channels yet.</p>
                                <button
                                    onClick={() => { setShowCreateChannel({ type: 'text' }); setNewChannelName(''); }}
                                    style={{ marginTop: '8px', padding: '8px 16px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Create a Channel
                                </button>
                            </div>
                        );
                    }

                    // Separate uncategorized channels into text and voice
                    const uncatText = uncategorized.filter(c => !isVoiceChannelType(c.type));
                    const uncatVoice = uncategorized.filter(c => isVoiceChannelType(c.type));

                    // Separate categories into text-oriented and voice-oriented
                    // A category is voice if ALL its children are voice, or its name suggests voice
                    const textCategories: typeof categories = [];
                    const voiceCategories: typeof categories = [];
                    for (const cat of categories) {
                        const children = channelsByParent.get(cat.id) || [];
                        const allVoice = children.length > 0 && children.every(c => isVoiceChannelType(c.type));
                        const nameHint = cat.name.toLowerCase().includes('voice');
                        if (allVoice || (nameHint && children.length === 0)) {
                            voiceCategories.push(cat);
                        } else {
                            textCategories.push(cat);
                        }
                    }

                    const sectionHeaderStyle = {
                        fontSize: '0.7rem', fontWeight: 700 as const, textTransform: 'uppercase' as const,
                        color: 'var(--text-muted)', padding: '16px 8px 4px 16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        letterSpacing: '0.02em', cursor: 'pointer',
                    };

                    const renderCategory = (cat: typeof categories[0], defaultType: 'text' | 'voice') => {
                        const children = channelsByParent.get(cat.id) || [];
                        return (
                            <div key={cat.id}>
                                <div className="channel-category" style={{ marginTop: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div onClick={() => toggleCategory(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                                        {collapsed[cat.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />} {cat.name.toUpperCase()}
                                    </div>
                                    <Plus size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.7 }}
                                        onClick={(e) => { e.stopPropagation(); setShowCreateChannel({ type: defaultType, parentId: cat.id }); setNewChannelName(''); }}
                                    />
                                </div>
                                {!collapsed[cat.id] && children.map(renderChannel)}
                            </div>
                        );
                    };

                    return (
                        <>
                            {/* ── TEXT CHANNELS ── */}
                            <div
                                style={sectionHeaderStyle}
                                onClick={() => toggleCategory('__text_channels__')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {collapsed['__text_channels__'] ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                                    <span>Text Channels</span>
                                </div>
                                <Plus size={14} style={{ cursor: 'pointer', opacity: 0.7 }}
                                    onClick={(e) => { e.stopPropagation(); setShowCreateChannel({ type: 'text' }); setNewChannelName(''); }}
                                />
                            </div>
                            {!collapsed['__text_channels__'] && (
                                <>
                                    {uncatText.map(renderChannel)}
                                    {textCategories.map(cat => renderCategory(cat, 'text'))}
                                </>
                            )}

                            {/* ── VOICE CHANNELS ── */}
                            <div
                                style={{ ...sectionHeaderStyle, marginTop: '12px' }}
                                onClick={() => toggleCategory('__voice_channels__')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {collapsed['__voice_channels__'] ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                                    <span>Voice Channels</span>
                                </div>
                                <Plus size={14} style={{ cursor: 'pointer', opacity: 0.7 }}
                                    onClick={(e) => { e.stopPropagation(); setShowCreateChannel({ type: 'voice' }); setNewChannelName(''); }}
                                />
                            </div>
                            {!collapsed['__voice_channels__'] && (
                                <>
                                    {uncatVoice.map(renderChannel)}
                                    {voiceCategories.map(cat => renderCategory(cat, 'voice'))}
                                </>
                            )}
                        </>
                    );
                })()}
            </div>

            {/* Create Channel Inline Modal */}
            {showCreateChannel && (
                <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--stroke)', borderBottom: '1px solid var(--stroke)' }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Create {showCreateChannel.type === 'voice' ? 'Voice' : 'Text'} Channel
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        {showCreateChannel.type === 'voice' ? <Mic size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <HashIcon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                        <input
                            type="text"
                            placeholder={showCreateChannel.type === 'voice' ? 'new-voice' : 'new-channel'}
                            value={newChannelName}
                            onChange={(e) => setNewChannelName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChannel(); if (e.key === 'Escape') { setShowCreateChannel(null); setNewChannelName(''); } }}
                            autoFocus
                            style={{ flex: 1, background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowCreateChannel(null); setNewChannelName(''); }} style={{ padding: '4px 12px', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                        <button onClick={handleCreateChannel} disabled={!newChannelName.trim()} style={{ padding: '4px 12px', background: newChannelName.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: newChannelName.trim() ? '#000' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12px', cursor: newChannelName.trim() ? 'pointer' : 'default', fontWeight: 600 }}>Create</button>
                    </div>
                </div>
            )}

            <UserPanel />

            {/* Channel Permissions Modal */}
            {channelPermsOpen && (() => {
                const PERM_BITS: { key: string; label: string; bit: bigint }[] = [
                    { key: 'view_channel', label: 'View Channel', bit: 1n << 8n },
                    { key: 'send_messages', label: 'Send Messages', bit: 1n << 7n },
                    { key: 'manage_messages', label: 'Manage Messages', bit: 1n << 6n },
                    { key: 'connect', label: 'Connect', bit: 1n << 9n },
                    { key: 'speak', label: 'Speak', bit: 1n << 10n },
                    { key: 'manage_channels', label: 'Manage Channel', bit: 1n << 2n },
                ];

                const getPermState = (roleId: string, bit: bigint): 'allow' | 'deny' | 'neutral' => {
                    const override = channelPermsOverrides.find(o => o.targetId === roleId);
                    if (!override) return 'neutral';
                    const allow = BigInt(override.allow);
                    const deny = BigInt(override.deny);
                    if ((allow & bit) !== 0n) return 'allow';
                    if ((deny & bit) !== 0n) return 'deny';
                    return 'neutral';
                };

                const cycleOverride = (roleId: string, bit: bigint) => {
                    setChannelPermsOverrides(prev => {
                        const existing = prev.find(o => o.targetId === roleId);
                        const current = getPermState(roleId, bit);
                        const nextState = current === 'neutral' ? 'allow' : current === 'allow' ? 'deny' : 'neutral';

                        let allow = existing ? BigInt(existing.allow) : 0n;
                        let deny = existing ? BigInt(existing.deny) : 0n;

                        // Clear the bit from both
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
                };

                const handleSavePerms = async () => {
                    if (!channelPermsOpen || !activeGuildId) return;
                    setChannelPermsSaving(true);
                    try {
                        for (const override of channelPermsOverrides) {
                            if (override.allow === '0' && override.deny === '0') {
                                // Delete override if all neutral
                                if (override.id) {
                                    await api.channels.deletePermissionOverride(channelPermsOpen.id, override.targetId);
                                }
                            } else {
                                await api.channels.setPermissionOverride(channelPermsOpen.id, override.targetId, {
                                    targetType: override.targetType as 'role' | 'member',
                                    allow: override.allow,
                                    deny: override.deny,
                                });
                            }
                        }
                        addToast({ title: 'Permissions Updated', variant: 'success' });
                        setChannelPermsOpen(null);
                    } catch {
                        addToast({ title: 'Failed to save permissions', variant: 'error' });
                    } finally {
                        setChannelPermsSaving(false);
                    }
                };

                return (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setChannelPermsOpen(null)}>
                        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '24px', maxWidth: '560px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>#{channelPermsOpen.name} Permissions</h2>
                                <button onClick={() => setChannelPermsOpen(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={20} /></button>
                            </div>

                            {/* Permission legend */}
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12} color="var(--success)" /> Allow</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Minus size={12} /> Neutral</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><X size={12} color="var(--error)" /> Deny</span>
                            </div>

                            {/* Column headers */}
                            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', marginBottom: '4px' }}>
                                <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    {PERM_BITS.map(p => (
                                        <span key={p.key} style={{ width: '28px', textAlign: 'center', fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600 }} title={p.label}>
                                            {p.label.split(' ').map(w => w[0]).join('')}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Role Overrides */}
                            {channelPermsRoles.map(role => (
                                <div key={role.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', marginBottom: '4px', background: 'var(--bg-tertiary)' }}>
                                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: role.color || 'var(--text-primary)' }}>{role.name}</span>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {PERM_BITS.map(perm => {
                                            const state = getPermState(role.id, perm.bit);
                                            return (
                                                <button
                                                    key={perm.key}
                                                    onClick={() => cycleOverride(role.id, perm.bit)}
                                                    title={`${perm.label}: ${state}`}
                                                    style={{
                                                        width: '28px', height: '28px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        background: state === 'allow' ? 'rgba(34, 197, 94, 0.2)' : state === 'deny' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-elevated)',
                                                        color: state === 'allow' ? 'var(--success)' : state === 'deny' ? 'var(--error)' : 'var(--text-muted)',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {state === 'allow' ? <Check size={14} /> : state === 'deny' ? <X size={14} /> : <Minus size={14} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {channelPermsRoles.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading roles...</div>
                            )}

                            {/* Save */}
                            <button
                                onClick={handleSavePerms}
                                disabled={channelPermsSaving}
                                style={{
                                    width: '100%', padding: '10px 16px', background: channelPermsSaving ? 'var(--bg-tertiary)' : 'var(--accent-primary)', border: 'none',
                                    borderRadius: '8px', color: channelPermsSaving ? 'var(--text-muted)' : 'white', cursor: channelPermsSaving ? 'default' : 'pointer', fontSize: '14px',
                                    fontWeight: 600, marginTop: '16px'
                                }}
                            >
                                {channelPermsSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Edit Channel Modal */}
            {editingChannel && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditingChannel(null)}>
                    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '24px', maxWidth: '460px', width: '90%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Edit #{editingChannel}</h2>
                            <button onClick={() => setEditingChannel(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={20} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>Channel Name</label>
                                <input
                                    defaultValue={editingChannel}
                                    style={{
                                        width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>Channel Topic</label>
                                <textarea
                                    placeholder="Set a topic for this channel"
                                    rows={3}
                                    style={{
                                        width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                        resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <input type="checkbox" style={{ accentColor: 'var(--accent-primary)' }} />
                                NSFW Channel
                            </label>

                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block' }}>Slowmode (seconds)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    min={0}
                                    max={21600}
                                    style={{
                                        width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button
                                    onClick={() => { setEditingChannel(null); addToast({ title: 'Channel Updated', variant: 'success' }); }}
                                    style={{
                                        flex: 1, padding: '10px 16px', background: 'var(--accent-primary)', border: 'none',
                                        borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600
                                    }}
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => setEditingChannel(null)}
                                    style={{
                                        flex: 1, padding: '10px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', fontWeight: 500
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

type MemberWithPresence = {
    userId: string;
    guildId: string;
    nickname: string | null;
    joinedAt: string;
    user?: { username: string; displayName: string; avatarHash: string | null };
    roleIds?: string[];
    groupIds?: string[];
    presence?: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';
};

const MembersSidebar = ({ onOpenProfile: _onOpenProfile }: { onOpenProfile: () => void }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { openMenu } = useContextMenu();
    const guildMatch = location.pathname.match(/\/guild\/([^/]+)/);
    const guildId = guildMatch ? guildMatch[1] : null;
    const [members, setMembers] = useState<MemberWithPresence[]>([]);
    const [memberGroups, setMemberGroups] = useState<Array<{ id: string; name: string; color: string; position: number; memberIds: string[] }>>([]);
    const [roles, setRoles] = useState<Array<{ id: string; name: string; color: number; position: number }>>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [popoverUser, setPopoverUser] = useState<{ member: MemberWithPresence; position: { x: number; y: number } } | null>(null);
    const [banDialog, setBanDialog] = useState<{ userId: string; name: string } | null>(null);
    const [banReason, setBanReason] = useState('');
    const [banSubmitting, setBanSubmitting] = useState(false);

    useEffect(() => {
        if (!guildId) return;
        const saved = localStorage.getItem(`gratonite:member-filter:${guildId}`);
        setActiveFilter(saved || 'all');
    }, [guildId]);

    useEffect(() => {
        if (!guildId) return;
        localStorage.setItem(`gratonite:member-filter:${guildId}`, activeFilter);
    }, [guildId, activeFilter]);

    useEffect(() => {
        if (!guildId) { setMembers([]); setRoles([]); setMemberGroups([]); return; }
        setLoading(true);

        const fetchData = async (opts?: { preserveLoading?: boolean }) => {
            if (!opts?.preserveLoading) setLoading(true);
            try {
                const [membersData, rolesData, memberGroupsData] = await Promise.all([
                    api.guilds.getMembers(guildId, { limit: 500 }),
                    api.guilds.getRoles(guildId).catch(() => []),
                    api.guilds.getMemberGroups(guildId).catch(() => []),
                ]);

                // Fetch presences for all member userIds
                const userIds = (membersData as any[]).map((m: any) => m.userId);
                let presenceMap: Record<string, string> = {};
                if (userIds.length > 0) {
                    try {
                        const presences = await api.users.getPresences(userIds);
                        for (const p of presences) {
                            presenceMap[p.userId] = p.status;
                        }
                    } catch { /* presences optional */ }
                }

                const enriched: MemberWithPresence[] = (membersData as any[]).map((m: any) => ({
                    ...m,
                    roleIds: Array.isArray(m.roleIds) ? m.roleIds : (Array.isArray(m.roles) ? m.roles : []),
                    groupIds: Array.isArray(m.groupIds) ? m.groupIds : [],
                    user: m.user ?? {
                        username: m.username ?? '',
                        displayName: m.displayName ?? m.username ?? '',
                        avatarHash: m.avatarHash ?? null,
                    },
                    presence: ((presenceMap[m.userId] as any) || m.status || 'offline') as any,
                }));

                setMembers(enriched);
                setRoles((rolesData as any[]).sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0)));
                setMemberGroups((memberGroupsData as any[]).sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0)));
            } catch {
                addToast({ title: 'Failed to load members', variant: 'error' });
            } finally {
                if (!opts?.preserveLoading) setLoading(false);
            }
        };

        fetchData();
        const unsubPresence = onPresenceUpdate((payload) => {
            setMembers((prev) => prev.map((member) => (
                member.userId === payload.userId
                    ? { ...member, presence: payload.status }
                    : member
            )));
        });
        const unsubReconnect = onSocketReconnect(() => {
            void fetchData({ preserveLoading: true });
        });
        return () => {
            unsubPresence();
            unsubReconnect();
        };
    }, [guildId]);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const memberById = useMemo(() => {
        const map = new Map<string, MemberWithPresence>();
        for (const member of members) map.set(member.userId, member);
        return map;
    }, [members]);

    const matchSearch = useCallback((member: MemberWithPresence) => {
        if (!normalizedQuery) return true;
        const name = (member.nickname || member.user?.displayName || member.user?.username || '').toLowerCase();
        const username = (member.user?.username || '').toLowerCase();
        return name.includes(normalizedQuery) || username.includes(normalizedQuery);
    }, [normalizedQuery]);

    const groupedMemberIds = useMemo(() => {
        const set = new Set<string>();
        for (const group of memberGroups) {
            for (const id of group.memberIds) set.add(id);
        }
        return set;
    }, [memberGroups]);

    const customGroupSections = useMemo(() => memberGroups
        .map((group) => {
            const membersInGroup = group.memberIds
                .map((memberId) => memberById.get(memberId))
                .filter((member): member is MemberWithPresence => Boolean(member))
                .filter(matchSearch);
            return { ...group, members: membersInGroup };
        })
        .filter((group) => group.members.length > 0)
        .sort((a, b) => b.position - a.position), [memberGroups, memberById, matchSearch]);

    const onlineMembers = useMemo(
        () => members.filter((m) => m.presence !== 'offline' && m.presence !== 'invisible' && !groupedMemberIds.has(m.userId)).filter(matchSearch),
        [members, groupedMemberIds, matchSearch],
    );

    const offlineMembers = useMemo(
        () => members.filter((m) => (m.presence === 'offline' || m.presence === 'invisible') && !groupedMemberIds.has(m.userId)).filter(matchSearch),
        [members, groupedMemberIds, matchSearch],
    );

    const visibleCustomGroups = useMemo(() => {
        if (activeFilter.startsWith('group:')) {
            const groupId = activeFilter.replace('group:', '');
            return customGroupSections.filter((group) => group.id === groupId);
        }
        if (activeFilter === 'online' || activeFilter === 'offline') return [];
        return customGroupSections;
    }, [activeFilter, customGroupSections]);

    const handleMemberClick = (member: MemberWithPresence, e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPopoverUser({ member, position: { x: rect.left - 310, y: rect.top } });
    };

    const handlePopoverMessage = async () => {
        if (!popoverUser) return;
        try {
            const dm = await api.relationships.openDm(popoverUser.member.userId) as any;
            navigate(`/dm/${dm.id}`);
        } catch {
            addToast({ title: 'Failed to open DM', variant: 'error' });
        }
        setPopoverUser(null);
    };

    const handlePopoverAddFriend = async () => {
        if (!popoverUser) return;
        try {
            await api.relationships.sendFriendRequest(popoverUser.member.userId);
            addToast({ title: 'Friend request sent!', variant: 'success' });
        } catch (err) {
            if (err instanceof ApiRequestError && err.code === 'CONFLICT') {
                const msg = err.message.includes('already friends')
                    ? 'You are already friends with this user.'
                    : 'A friend request is already pending.';
                addToast({ title: 'Already connected', description: msg, variant: 'info' });
            } else {
                addToast({ title: 'Failed to send friend request', variant: 'error' });
            }
        }
        setPopoverUser(null);
    };

    const handleBanSubmit = async () => {
        if (!guildId || !banDialog) return;
        setBanSubmitting(true);
        try {
            await api.guilds.ban(guildId, banDialog.userId, banReason || undefined);
            setMembers(prev => prev.filter(m => m.userId !== banDialog.userId));
            addToast({ title: 'User banned', description: `${banDialog.name} has been banned from the server.`, variant: 'success' });
            setBanDialog(null);
            setBanReason('');
        } catch {
            addToast({ title: 'Failed to ban user', variant: 'error' });
        } finally {
            setBanSubmitting(false);
        }
    };

    const handleMemberContext = (e: React.MouseEvent, member: MemberWithPresence) => {
        const name = member.nickname || member.user?.displayName || member.user?.username || member.userId.slice(0, 8);
        openMenu(e, [
            { id: 'profile', label: 'View Profile', onClick: () => handleMemberClick(member, e) },
            { id: 'copy-id', label: 'Copy User ID', icon: Copy, onClick: () => { navigator.clipboard.writeText(member.userId); addToast({ title: 'Copied to clipboard', variant: 'info' }); }, divider: true },
            { id: 'ban', label: 'Ban', icon: Ban, color: '#ED4245', onClick: () => { setBanDialog({ userId: member.userId, name }); setBanReason(''); } },
        ]);
    };

    // Compute highest role color for a member
    const getMemberRoleColor = useCallback((member: MemberWithPresence): string | undefined => {
        if (!member.roleIds || member.roleIds.length === 0 || roles.length === 0) return undefined;
        const roleMap = new Map(roles.map(r => [r.id, r]));
        let highest: { color: number; position: number } | null = null;
        for (const rid of member.roleIds) {
            const r = roleMap.get(rid);
            if (r && (!highest || (r.position ?? 0) > (highest.position ?? 0))) {
                highest = r;
            }
        }
        if (highest && highest.color) {
            return `#${highest.color.toString(16).padStart(6, '0')}`;
        }
        return undefined;
    }, [roles]);

    const renderMemberRow = (member: MemberWithPresence, isOffline = false) => {
        const name = member.nickname || member.user?.displayName || member.user?.username || member.userId.slice(0, 8);
        const roleColor = getMemberRoleColor(member);
        return (
            <div
                key={member.userId}
                className="member-item"
                onClick={(e) => handleMemberClick(member, e)}
                onContextMenu={(e) => handleMemberContext(e, member)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 16px',
                    cursor: 'pointer',
                    opacity: isOffline ? 0.4 : 1,
                }}
            >
                <Avatar
                    userId={member.userId}
                    avatarHash={member.user?.avatarHash}
                    displayName={name}
                    size={32}
                    status={member.presence || (isOffline ? 'offline' : 'online')}
                    statusRingColor="var(--bg-sidebar, var(--bg-secondary))"
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontSize: '14px', color: roleColor || 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                </div>
            </div>
        );
    };

    return (
        <aside className="members-sidebar glass-panel">
            <div style={{ padding: '10px 12px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search members..."
                    style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--stroke)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        outline: 'none',
                        boxSizing: 'border-box',
                    }}
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'online', label: 'Online' },
                        { key: 'offline', label: 'Offline' },
                        ...memberGroups.map((group) => ({ key: `group:${group.id}`, label: `Group: ${group.name}` })),
                    ].map((chip) => (
                        <button
                            key={chip.key}
                            onClick={() => setActiveFilter(chip.key)}
                            style={{
                                borderRadius: '999px',
                                border: activeFilter === chip.key ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                background: activeFilter === chip.key ? 'var(--bg-secondary)' : 'transparent',
                                color: activeFilter === chip.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontSize: '11px',
                                padding: '3px 8px',
                                cursor: 'pointer',
                            }}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading && members.length === 0 ? (
                guildId ? (
                    <SkeletonMemberList count={10} />
                ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No members
                    </div>
                )
            ) : (
                <>
                    {visibleCustomGroups.map(group => (
                        <div key={group.id}>
                            <div className="member-category" style={{ color: group.color || 'var(--text-muted)' }}>
                                {group.name} — {group.members.length}
                            </div>
                            {group.members.map(m => renderMemberRow(m, false))}
                        </div>
                    ))}
                    {(activeFilter === 'all' || activeFilter === 'online') && onlineMembers.length > 0 && (
                        <div>
                            <div className="member-category">Online — {onlineMembers.length}</div>
                            {onlineMembers.map((m) => renderMemberRow(m, false))}
                        </div>
                    )}
                    {(activeFilter === 'all' || activeFilter === 'offline') && offlineMembers.length > 0 && (
                        <div>
                            <div className="member-category">Offline — {offlineMembers.length}</div>
                            {offlineMembers.map((m) => renderMemberRow(m, true))}
                        </div>
                    )}
                    {visibleCustomGroups.length === 0
                        && onlineMembers.length === 0
                        && offlineMembers.length === 0
                        && !loading && (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            No members
                        </div>
                    )}
                </>
            )}

            {popoverUser && (
                <UserProfilePopover
                    user={{
                        id: popoverUser.member.userId,
                        name: popoverUser.member.nickname || popoverUser.member.user?.displayName || popoverUser.member.user?.username || popoverUser.member.userId.slice(0, 8),
                        handle: popoverUser.member.user?.username || popoverUser.member.userId.slice(0, 8),
                        avatarHash: popoverUser.member.user?.avatarHash || null,
                        status: (popoverUser.member.presence as any) || 'online',
                        guildId: guildId || undefined,
                    }}
                    position={popoverUser.position}
                    onClose={() => setPopoverUser(null)}
                    onMessage={handlePopoverMessage}
                    onAddFriend={handlePopoverAddFriend}
                />
            )}

            {/* Ban Confirmation Dialog */}
            {banDialog && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 10000,
                }} onClick={() => { setBanDialog(null); setBanReason(''); }}>
                    <div style={{
                        width: '440px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg, 12px)',
                        border: '1px solid var(--stroke)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                        padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: 'rgba(237, 66, 69, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Ban size={20} color="#ED4245" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                    Ban {banDialog.name}
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px' }}>
                                    This user will be permanently banned from the server.
                                </p>
                            </div>
                        </div>

                        <div>
                            <label style={{
                                display: 'block', fontSize: '12px', textTransform: 'uppercase',
                                color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px',
                            }}>REASON (OPTIONAL)</label>
                            <textarea
                                value={banReason}
                                onChange={(e) => setBanReason(e.target.value)}
                                placeholder="Enter a ban reason..."
                                rows={3}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                    color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => { setBanDialog(null); setBanReason(''); }}
                                style={{
                                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                                    background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                                }}
                            >Cancel</button>
                            <button
                                onClick={handleBanSubmit}
                                disabled={banSubmitting}
                                style={{
                                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                                    background: '#ED4245', color: 'white',
                                    fontSize: '14px', fontWeight: 600, cursor: banSubmitting ? 'default' : 'pointer',
                                    opacity: banSubmitting ? 0.6 : 1,
                                }}
                            >{banSubmitting ? 'Banning...' : 'Ban'}</button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

// MainChat abstracted to src/pages/guilds/ChannelChat.tsx


export const AppLayout = () => {
    const location = useLocation();
    const { addToast } = useToast();
    const [bgMedia, setBgMediaRaw] = useState<{ url: string, type: MediaType } | null>(null);

    // Play join/leave sounds globally for all voice channels
    useVoiceSounds();


    // Per-channel background persistence via localStorage
    const channelBgKey = `gratonite-bg:${location.pathname}`;

    // Load saved background when route changes
    useEffect(() => {
        try {
            const saved = localStorage.getItem(channelBgKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                setBgMediaRaw(parsed);
            } else {
                setBgMediaRaw(null);
            }
        } catch {
            setBgMediaRaw(null);
        }
    }, [channelBgKey]);

    // Wrapper that persists background per-channel
    const setBgMedia = (media: { url: string, type: MediaType } | null) => {
        setBgMediaRaw(media);
        if (media) {
            // For blob URLs we can't persist, but for real URLs we can
            // In production this would save to the server; for now persist the reference
            try {
                localStorage.setItem(channelBgKey, JSON.stringify(media));
            } catch { /* quota exceeded or blob URL — that's ok */ }
        } else {
            localStorage.removeItem(channelBgKey);
        }
    };
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [isGuildRailOpen, setIsGuildRailOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const { user: ctxUser, loading: userLoading, gratoniteBalance, setGratoniteBalance } = useUser();
    const { setTheme, setColorMode, setFontFamily, setFontSize, setAccentColor, setButtonShape, setGlassMode, setHighContrast, setCompactMode, setReducedEffects } = useTheme();
    const [guilds, setGuilds] = useState<Array<{ id: string; name: string; iconHash: string | null; description: string | null; memberCount: number }>>([]);
    const [dmChannels, setDmChannels] = useState<Array<{ id: string; recipientIds?: string[]; recipients?: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }> }>>([]);
    const activeGuildId = useMemo(() => {
        const match = location.pathname.match(/\/guild\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    const guildFetchV2Enabled = useMemo(() => {
        return (import.meta.env.VITE_GUILD_FETCH_V2 ?? '1') !== '0';
    }, []);

    const handleGuildSessionNetworkError = useCallback(() => {
        addToast({
            title: 'Could not refresh server data',
            description: 'Network issue detected. Retrying automatically.',
            variant: 'error',
        });
    }, [addToast]);

    const guildSession = useGuildSession({
        guildId: activeGuildId,
        enabled: guildFetchV2Enabled,
        onNetworkError: handleGuildSessionNetworkError,
    });

    // Connect the WebSocket once the user is authenticated so real-time
    // events (messages, typing, presence, etc.) are delivered.
    useEffect(() => {
        let connectTimer: ReturnType<typeof setTimeout> | null = null;
        if (!userLoading && ctxUser.id && getAccessToken()) {
            // Delay one tick so React StrictMode's dev-only mount/unmount cycle
            // does not create a noisy connect->immediate disconnect race.
            connectTimer = setTimeout(() => {
                connectSocket();
            }, 0);
        }
        return () => {
            if (connectTimer) clearTimeout(connectTimer);
            disconnectSocket();
        };
    }, [userLoading, ctxUser.id]);

    const refreshGuilds = useCallback(() => {
        if (!getAccessToken() || isAuthRuntimeExpired()) return;
        api.guilds.getMine().then((list: any[]) => {
            const normalized = Array.isArray(list) ? list.map((g) => ({
                id: g.id,
                name: g.name,
                iconHash: g.iconHash ?? null,
                description: g.description ?? null,
                memberCount: typeof g.memberCount === 'number' ? g.memberCount : 0,
            })) : [];
            setGuilds(normalized);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        refreshGuilds();
        if (!isAuthRuntimeExpired()) {
            api.relationships.getDmChannels().then((dms: any) => setDmChannels(dms)).catch(() => {});
        }
    }, [refreshGuilds]);

    useEffect(() => {
        const handler = () => refreshGuilds();
        window.addEventListener('gratonite:guild-updated', handler);
        return () => window.removeEventListener('gratonite:guild-updated', handler);
    }, [refreshGuilds]);

    const [userProfile, setUserProfile] = useState<{
        id: string;
        name: string;
        handle: string;
        status: string;
        customStatus: string;
        avatarStyle: string;
        avatarFrame: 'none' | 'neon' | 'gold' | 'glass';
        nameplateStyle: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch';
        avatarHash: string | null;
        bannerHash: string | null;
        badges: string[];
    }>({
        id: '',
        name: '',
        handle: '',
        status: 'Online',
        customStatus: '',
        avatarStyle: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
        avatarFrame: 'none',
        nameplateStyle: 'none',
        avatarHash: null,
        bannerHash: null,
        badges: []
    });

    const nameplatesSyncedRef = useRef(false);

    // Sync userProfile from UserContext
    useEffect(() => {
        if (ctxUser.id) {
            const persistedNameplate = getStoredNameplateStyle(ctxUser.id);
            const persistedAvatarFrame = getStoredAvatarFrame(ctxUser.id);
            setUserProfile((prev) => {
                const nextId = ctxUser.id || prev.id;
                const nextName = ctxUser.name || prev.name;
                const nextHandle = ctxUser.handle || prev.handle;
                const nextAvatarHash = ctxUser.avatarHash ?? null;
                const nextBannerHash = ctxUser.bannerHash ?? null;
                const nextAvatarFrame = persistedAvatarFrame ?? prev.avatarFrame;
                const nextNameplateStyle = persistedNameplate ?? prev.nameplateStyle;

                if (
                    prev.id === nextId &&
                    prev.name === nextName &&
                    prev.handle === nextHandle &&
                    prev.avatarHash === nextAvatarHash &&
                    prev.bannerHash === nextBannerHash &&
                    prev.avatarFrame === nextAvatarFrame &&
                    prev.nameplateStyle === nextNameplateStyle
                ) {
                    return prev;
                }

                return {
                    ...prev,
                    id: nextId,
                    name: nextName,
                    handle: nextHandle,
                    avatarHash: nextAvatarHash,
                    bannerHash: nextBannerHash,
                    avatarFrame: nextAvatarFrame,
                    nameplateStyle: nextNameplateStyle,
                };
            });

            // One-shot: push localStorage nameplate to DB so other users see it
            const persistedNameplateForSync = getStoredNameplateStyle(ctxUser.id);
            if (!nameplatesSyncedRef.current && persistedNameplateForSync && persistedNameplateForSync !== 'none') {
                nameplatesSyncedRef.current = true;
                api.users.updateProfile({ nameplateStyle: persistedNameplateForSync }).catch(() => {});
            }
        }
    }, [ctxUser.id, ctxUser.name, ctxUser.handle, ctxUser.avatarHash, ctxUser.bannerHash]);

    const refreshEquippedCosmetics = useCallback(() => {
        if (!ctxUser.id || !getAccessToken() || isAuthRuntimeExpired()) return;
        api.cosmetics.getEquipped()
            .then((equipped) => {
                const frame = equipped.find((item: any) => item.type === 'avatar_frame');
                const nameplate = equipped.find((item: any) => item.type === 'nameplate');
                const persistedAvatarFrame = getStoredAvatarFrame(ctxUser.id);
                const persistedNameplate = getStoredNameplateStyle(ctxUser.id);
                setUserProfile((prev) => {
                    const nextAvatarFrame = persistedAvatarFrame ?? mapAvatarFrameFromEquippedName(frame?.name);
                    const nextNameplateStyle = persistedNameplate ?? mapNameplateStyleFromEquippedName(nameplate?.name);
                    if (prev.avatarFrame === nextAvatarFrame && prev.nameplateStyle === nextNameplateStyle) {
                        return prev;
                    }
                    return {
                        ...prev,
                        avatarFrame: nextAvatarFrame,
                        nameplateStyle: nextNameplateStyle,
                    };
                });
            })
            .catch(() => {
                // Cosmetic load is non-blocking for app startup.
            });
    }, [ctxUser.id]);

    useEffect(() => {
        refreshEquippedCosmetics();
    }, [refreshEquippedCosmetics]);

    useEffect(() => {
        const handler = () => refreshEquippedCosmetics();
        window.addEventListener('gratonite:cosmetics-updated', handler);
        return () => window.removeEventListener('gratonite:cosmetics-updated', handler);
    }, [refreshEquippedCosmetics]);

    useEffect(() => {
        const handler = (evt: Event) => {
            const detail = (evt as CustomEvent<{ style?: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch' }>).detail;
            if (!detail?.style) return;
            setUserProfile((prev) => (prev.nameplateStyle === detail.style ? prev : { ...prev, nameplateStyle: detail.style! }));
        };
        window.addEventListener('gratonite:nameplate-updated', handler as EventListener);
        return () => window.removeEventListener('gratonite:nameplate-updated', handler as EventListener);
    }, []);

    useEffect(() => {
        const handler = (evt: Event) => {
            const detail = (evt as CustomEvent<{ frame?: 'none' | 'neon' | 'gold' | 'glass' }>).detail;
            if (!detail?.frame) return;
            setUserProfile((prev) => (prev.avatarFrame === detail.frame ? prev : { ...prev, avatarFrame: detail.frame! }));
        };
        window.addEventListener('gratonite:avatar-frame-updated', handler as EventListener);
        return () => window.removeEventListener('gratonite:avatar-frame-updated', handler as EventListener);
    }, []);

    const refreshGuildSession = guildSession.refresh;
    useEffect(() => {
        const unsubscribe = onSocketReconnect(() => {
            if (isAuthRuntimeExpired()) return;
            window.dispatchEvent(new Event('gratonite:inventory-updated'));
            window.dispatchEvent(new Event('gratonite:cosmetics-updated'));
            refreshEquippedCosmetics();
            if (activeGuildId && guildFetchV2Enabled) {
                void refreshGuildSession();
            }
            api.users.getMe()
                .then((me: any) => {
                    setUserProfile((prev) => {
                        const nextName = me?.profile?.displayName || me?.username || prev.name;
                        const nextHandle = me?.username || prev.handle;
                        const nextAvatarHash = me?.profile?.avatarHash ?? prev.avatarHash;
                        const nextBannerHash = me?.profile?.bannerHash ?? prev.bannerHash;
                        if (
                            prev.name === nextName &&
                            prev.handle === nextHandle &&
                            prev.avatarHash === nextAvatarHash &&
                            prev.bannerHash === nextBannerHash
                        ) {
                            return prev;
                        }
                        return {
                            ...prev,
                            name: nextName,
                            handle: nextHandle,
                            avatarHash: nextAvatarHash,
                            bannerHash: nextBannerHash,
                        };
                    });
                })
                .catch(() => {});
        });
        return unsubscribe;
    }, [activeGuildId, guildFetchV2Enabled, refreshEquippedCosmetics, refreshGuildSession]);

    useEffect(() => {
        const onAuthExpired = () => {
            addToast({
                title: 'Session expired',
                description: 'Please sign in again to continue.',
                variant: 'error',
            });
        };
        window.addEventListener('gratonite:auth-expired', onAuthExpired as EventListener);
        return () => window.removeEventListener('gratonite:auth-expired', onAuthExpired as EventListener);
    }, [addToast]);

    // Show onboarding modal on first login if not yet completed.
    // Guard with !userLoading so the effect only fires after the real user
    // data has arrived from the API (prevents re-triggering before fetch).
    // Uses a ref to ensure it only fires once per session.
    const onboardingCheckedRef = useRef(false);
    useEffect(() => {
        if (userLoading || !ctxUser.id) return;     // Wait for API data
        if (onboardingCheckedRef.current) return;    // Already checked this session
        onboardingCheckedRef.current = true;
        if (!ctxUser.onboardingCompleted) {
            setActiveModal('onboarding');
        }
    }, [userLoading, ctxUser.id, ctxUser.onboardingCompleted]);

    // On first authenticated load, hydrate ThemeProvider from backend settings
    // so that theme persists even after localStorage is cleared.
    useEffect(() => {
        if (!userLoading && ctxUser.id) {
            api.users.getSettings().then((s: any) => {
                if (!s) return;
                if (s.theme) setTheme(s.theme);
                if (s.colorMode) setColorMode(s.colorMode);
                if (s.fontFamily) setFontFamily(s.fontFamily.toLowerCase() as any);
                if (s.fontSize) setFontSize(s.fontSize);
                if (s.accentColor) setAccentColor(s.accentColor);
                if (s.buttonShape) setButtonShape(s.buttonShape);
                if (s.glassMode) setGlassMode(s.glassMode);
                if (s.highContrast != null) setHighContrast(s.highContrast);
                if (s.compactMode != null) setCompactMode(s.compactMode);
                if (s.reducedMotion != null) setReducedEffects(s.reducedMotion);
                if (s.soundVolume != null) setSoundVolume(s.soundVolume);
            }).catch(() => {/* silently ignore — localStorage fallback still applies */});
        }
    }, [userLoading, ctxUser.id]);

    const [userTheme, setUserTheme] = useState({
        accentColor: '#38bdf8',
        glassMode: 'full',
        reducedEffects: false,
        lowPower: false
    });



    // Global Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts when typing in inputs
            const tag = (e.target as HTMLElement)?.tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
            if (isInput && !(e.metaKey || e.ctrlKey) && e.key !== 'Escape') return;

            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setActiveModal(prev => prev === 'globalSearch' ? null : 'globalSearch');
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                e.preventDefault();
                setActiveModal(prev => prev === 'shortcuts' ? null : 'shortcuts');
            }
            if (e.key === 'Escape' && activeModal) {
                e.preventDefault();
                setActiveModal(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeModal]);

    // Close drawers on route change
    useEffect(() => {
        setIsGuildRailOpen(false);
        setIsSidebarOpen(false);
    }, [location.pathname]);

    // Only chat/channel routes show the members sidebar
    const isChatRoute = location.pathname.includes('/chat') || location.pathname.includes('/channel/');
    const isVoiceRoute = location.pathname.includes('/voice');

    return (
        <ContextMenuProvider>
            <div className="app-container">
                <div
                    className={`mobile-backdrop ${isGuildRailOpen || isSidebarOpen ? 'visible' : ''}`}
                    onClick={() => { setIsGuildRailOpen(false); setIsSidebarOpen(false); }}
                />

                <GuildRail
                    isOpen={isGuildRailOpen}
                    onOpenCreateGuild={() => setActiveModal('createGuild')}
                    onOpenNotifications={() => setActiveModal('notifications')}
                    onOpenBugReport={() => setActiveModal('bugReport')}
                    onOpenProfile={() => setActiveModal('userProfile')}
                    onOpenSettings={() => setActiveModal('settings')}
                    onOpenGuildSettings={() => setActiveModal('guildSettings')}
                    onOpenInvite={() => setActiveModal('invite')}
                    onGuildsRefresh={refreshGuilds}
                    guilds={guilds}
                    userProfile={userProfile}
                />
                <ChannelSidebar
                    isOpen={isSidebarOpen}
                    onOpenSettings={() => setActiveModal('settings')}
                    onOpenProfile={() => setActiveModal('userProfile')}
                    onOpenGlobalSearch={() => setActiveModal('globalSearch')}
                    onOpenDMSearch={() => setActiveModal('dmSearch')}
                    userProfile={userProfile}
                    guildSession={guildSession}
                />
                <div className={`main-content-wrapper ${bgMedia !== null ? 'has-custom-bg' : ''}`} style={(!isChatRoute && !isVoiceRoute) ? { flex: 1, display: 'flex', flexDirection: 'column' } : {}}>
                    <div className="route-transition-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Outlet context={{
                            bgMedia,
                            hasCustomBg: bgMedia !== null,
                            setBgMedia,
                            setActiveModal,
                            toggleGuildRail: () => setIsGuildRailOpen(!isGuildRailOpen),
                            toggleSidebar: () => setIsSidebarOpen(!isSidebarOpen),
                            gratoniteBalance,
                            setGratoniteBalance,
                            userProfile,
                            setUserProfile,
                            userTheme,
                            setUserTheme,
                            guildSession
                        }} />
                    </div>
                    {isChatRoute && isSidebarOpen && <MembersSidebar onOpenProfile={() => setActiveModal('userProfile')} />}
                </div>

                {/* Mobile Bottom Navigation (< 768px) */}
                <nav className="mobile-bottom-nav">
                    <Link to="/" className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
                        <Home size={20} />
                        <span>Home</span>
                    </Link>
                    <Link to="/discover" className={`mobile-nav-item ${location.pathname === '/discover' ? 'active' : ''}`}>
                        <Search size={20} />
                        <span>Discover</span>
                    </Link>
                    <div className="mobile-nav-item" onClick={() => setIsGuildRailOpen(true)}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                A
                            </div>
                            <div className="mobile-nav-badge unread-badge">3</div>
                        </div>
                        <span>Guilds</span>
                    </div>
                    <div className="mobile-nav-item" onClick={() => setIsSidebarOpen(true)}>
                        <MessageSquare size={20} />
                        <span>Chat</span>
                    </div>
                    <div className="mobile-nav-item" onClick={() => setActiveModal('userProfile')}>
                        <Avatar
                            userId={userProfile.id || 'me'}
                            avatarHash={userProfile.avatarHash}
                            displayName={userProfile.name || 'User'}
                            frame={userProfile.avatarFrame as 'none' | 'neon' | 'gold' | 'glass'}
                            size={24}
                            status={(userProfile.status || 'online').toLowerCase() as any}
                            statusRingColor="var(--bg-primary)"
                        />
                        <span>Profile</span>
                    </div>
                </nav>
            </div>

            {/* Modals */}
            <ModalWrapper isOpen={activeModal === 'settings'}>
                <SettingsModal onClose={() => setActiveModal(null)} userProfile={userProfile} setUserProfile={setUserProfile} userTheme={userTheme} setUserTheme={setUserTheme} />
            </ModalWrapper>
            <ModalWrapper isOpen={activeModal === 'userProfile'}>
                <UserProfileModal onClose={() => setActiveModal(null)} userProfile={userProfile} />
            </ModalWrapper>
            <ModalWrapper isOpen={activeModal === 'createGuild'}>
                <CreateGuildModal
                    onClose={() => setActiveModal(null)}
                    onGuildCreated={(g) =>
                        setGuilds(prev => {
                            const next = [...prev];
                            const idx = next.findIndex((existing) => existing.id === g.id);
                            const record = { ...g, description: null, memberCount: 0 };
                            if (idx >= 0) {
                                next[idx] = { ...next[idx], ...record };
                            } else {
                                next.push(record);
                            }
                            return next;
                        })
                    }
                />
            </ModalWrapper>
            <ModalWrapper isOpen={activeModal === 'screenShare'}>
                <ScreenShareModal isOpen={activeModal === 'screenShare'} onClose={() => setActiveModal(null)} />
            </ModalWrapper>
            <ModalWrapper isOpen={activeModal === 'guildSettings'}>
                <GuildSettingsModal onClose={() => setActiveModal(null)} guildId={location.pathname.match(/\/guild\/([^/]+)/)?.[1] || null} />
            </ModalWrapper>
            <ModalWrapper isOpen={activeModal === 'invite'}>
                <InviteModal onClose={() => setActiveModal(null)} guildId={location.pathname.match(/\/guild\/([^/]+)/)?.[1] || null} />
            </ModalWrapper>
            {activeModal === 'dmSearch' && (
                <DMSearchModal onClose={() => setActiveModal(null)} />
            )}
            <CommandPalette isOpen={activeModal === 'globalSearch'} onClose={() => setActiveModal(null)} guilds={guilds} dmChannels={dmChannels} onOpenSettings={() => setActiveModal('settings')} />
            <ModalWrapper isOpen={activeModal === 'notifications'}>
                <NotificationModal onClose={() => setActiveModal(null)} />
            </ModalWrapper>
            <ModalWrapper isOpen={activeModal === 'shortcuts'}>
                <KeyboardShortcutsModal onClose={() => setActiveModal(null)} />
            </ModalWrapper>
            <ModalWrapper isOpen={activeModal === 'bugReport'}>
                <BugReportModal onClose={() => setActiveModal(null)} />
            </ModalWrapper>
            <ModalWrapper isOpen={activeModal === 'onboarding'}>
                <OnboardingModal onClose={() => setActiveModal(null)} />
            </ModalWrapper>
        </ContextMenuProvider>
    );
};

// Removed ChatRouteWrapper since ChannelChat uses outlet context directly

const appRouter = createBrowserRouter(
    createRoutesFromElements(
        <>
            {/* Public Auth Routes */}
            <Route element={<AuthLayout />}>
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="verify" element={<Verify />} />
            </Route>

            {/* Public Invite Route */}
            <Route path="invite/:code" element={<InviteAccept />} />

            {/* Private App Routes */}
            <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route index element={<HomePage />} />
                <Route path="friends" element={<Friends />} />
                <Route path="gratonite" element={<Navigate to="/" replace />} />
                <Route path="shop" element={<Shop />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="discover" element={<Discover />} />
                <Route path="creator-dashboard" element={<CreatorDashboard />} />
                <Route path="fame" element={<FameDashboard />} />
                <Route path="theme-builder" element={<ThemeBuilder />} />
                <Route path="bot-builder" element={<BotBuilder />} />
                <Route path="bot-store" element={<BotStore />} />
                <Route path="help-center" element={<HelpCenter />} />
                <Route path="message-requests" element={<MessageRequests />} />
                <Route path="admin/team" element={<RequireAdmin><AdminTeam /></RequireAdmin>} />
                <Route path="admin/audit" element={<RequireAdmin><AdminAuditLog /></RequireAdmin>} />
                <Route path="admin/bot-moderation" element={<RequireAdmin><AdminBotModeration /></RequireAdmin>} />
                <Route path="admin/feedback" element={<RequireAdmin><AdminFeedback /></RequireAdmin>} />
                <Route path="admin/reports" element={<RequireAdmin><AdminReports /></RequireAdmin>} />
                <Route path="dm/:id" element={<DirectMessage />} />
                {/* Parameterized guild routes */}
                <Route path="guild/:guildId" element={<GuildOverview />} />
                <Route path="guild/:guildId/channel/:channelId" element={<ChannelChat />} />
                <Route path="guild/:guildId/voice/:channelId" element={<VoiceChannel />} />
                <Route path="guilds/:guildId/:channelId" element={<LegacyGuildChannelRedirect />} />
                <Route path="guilds/:guildId/voice/:channelId" element={<LegacyGuildVoiceRedirect />} />
                <Route path="guild/:guildId/:channelId" element={<LegacyGuildChannelRedirect />} />
                <Route path="guild/:guildId/overview" element={<GuildOverview />} />
                <Route path="guild/:guildId/audit-log" element={<AuditLog />} />
            </Route>

            <Route path="*" element={<NotFound />} />
        </>
    ),
    { basename: '/app' }
);

function App() {
    return (
        <ErrorBoundary>
        <UserProvider>
        <VoiceProvider>
        <ToastProvider>
            <AchievementToastProvider>
            <AmbientPlayer />
            <ConnectionBanner />
            <RouterProvider router={appRouter} />
            </AchievementToastProvider>
        </ToastProvider>
        </VoiceProvider>
        </UserProvider>
        </ErrorBoundary>
    );
}

export default App;
