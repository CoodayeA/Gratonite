import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider, Navigate, Outlet, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import gsap from 'gsap';
import { Home, Settings, Hash as HashIcon, Mic, Plus, ChevronDown, ChevronRight, MessageSquare, Search, Bell, BellOff, Bug, Circle, Volume1, Volume2, Copy, Lock, Trash2, X, Check, Minus, ShieldAlert, LogOut, Activity, Ban, Link2, ShoppingBag, Store, Package, HelpCircle, Users, Folder as FolderIcon, Star, Zap, Calendar, Compass, User, Columns, Paintbrush, PenLine, FileText } from 'lucide-react';
import './components/chat.css';
import CommandPalette from './components/ui/CommandPalette';
import { playSound, setSoundVolume } from './utils/SoundManager';
import { copyToClipboard } from './utils/clipboard';

import AuthLayout from './layouts/AuthLayout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Verify from './pages/auth/Verify';
import ResetPassword from './pages/auth/ResetPassword';

import Download from './pages/Download';
import RequireAdmin from './components/guards/RequireAdmin';
import RequireAuth from './components/guards/RequireAuth';

// Lazy-loaded page components for code splitting
const HomePage = lazy(() => import('./pages/app/Home'));
const Discover = lazy(() => import('./pages/app/Discover'));
const Friends = lazy(() => import('./pages/app/Friends'));
const Shop = lazy(() => import('./pages/app/Shop'));
const Marketplace = lazy(() => import('./pages/app/Marketplace'));
const Inventory = lazy(() => import('./pages/app/Inventory'));
const FameDashboard = lazy(() => import('./pages/app/FameDashboard'));
const CreatorDashboard = lazy(() => import('./pages/app/CreatorDashboard'));
const ThemeBuilder = lazy(() => import('./pages/app/ThemeBuilder'));
const BotBuilder = lazy(() => import('./pages/app/BotBuilder'));
const BotStore = lazy(() => import('./pages/app/BotStore'));
const DirectMessage = lazy(() => import('./pages/app/DirectMessage'));
const ChannelChat = lazy(() => import('./pages/guilds/ChannelChat'));
const VoiceChannel = lazy(() => import('./pages/guilds/VoiceChannel'));
const GuildOverview = lazy(() => import('./pages/guilds/GuildOverview'));
const AuditLog = lazy(() => import('./pages/guilds/AuditLog'));
const GuildWorkflows = lazy(() => import('./pages/guilds/GuildWorkflows'));
const EventScheduler = lazy(() => import('./pages/guilds/EventScheduler'));
const ModerationDashboard = lazy(() => import('./pages/guilds/ModerationDashboard'));
const MessageRequests = lazy(() => import('./pages/app/MessageRequests'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const OAuthAuthorize = lazy(() => import('./pages/app/OAuthAuthorize'));
const AdminCosmetics = lazy(() => import('./pages/admin/AdminCosmetics'));
const AdminTeam = lazy(() => import('./pages/admin/AdminTeam'));
const AdminAuditLog = lazy(() => import('./pages/admin/AdminAuditLog'));
const AdminBotModeration = lazy(() => import('./pages/admin/AdminBotModeration'));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports'));
const AdminPortals = lazy(() => import('./pages/admin/AdminPortals'));
const FederationAdmin = lazy(() => import('./pages/admin/FederationAdmin'));
const SetupPage = lazy(() => import('./pages/Setup'));
const HelpCenter = lazy(() => import('./pages/app/HelpCenter'));
const MeProfile = lazy(() => import('./pages/app/MeProfile'));
const ReadLater = lazy(() => import('./pages/app/ReadLater'));
const BadgesGallery = lazy(() => import('./pages/app/BadgesGallery'));
const FriendActivity = lazy(() => import('./pages/app/FriendActivity'));
const Trading = lazy(() => import('./pages/app/Trading'));
const GuildInsights = lazy(() => import('./pages/guilds/GuildInsights'));
const ClipsGallery = lazy(() => import('./pages/guilds/ClipsGallery'));
const PublicGuildStats = lazy(() => import('./pages/guilds/PublicGuildStats'));
const WikiChannel = lazy(() => import('./pages/guilds/WikiChannel'));
const PhotoAlbums = lazy(() => import('./pages/guilds/PhotoAlbums'));
const FormBuilder = lazy(() => import('./pages/guilds/FormBuilder'));
const MemberDirectory = lazy(() => import('./pages/guilds/MemberDirectory'));
const Gacha = lazy(() => import('./pages/app/Gacha'));
const DailyChallenges = lazy(() => import('./pages/app/DailyChallenges'));
const MiniMode = lazy(() => import('./components/desktop/MiniMode'));
const EmbedDocumentPage = lazy(() => import('./pages/EmbedDocument'));
const VanityProfile = lazy(() => import('./pages/app/VanityProfile'));
const UnifiedInbox = lazy(() => import('./pages/app/UnifiedInbox'));
const ActivityFeed = lazy(() => import('./pages/app/ActivityFeed'));
const Leaderboard = lazy(() => import('./pages/app/Leaderboard'));
const ScheduleCalendar = lazy(() => import('./pages/app/ScheduleCalendar'));

import InviteAccept from './pages/InviteAccept';
import { NotFound, ErrorBoundary as RouteErrorBoundary } from './pages/ErrorStates';
import { getDeterministicGradient } from './utils/colors';
import { api, API_BASE, getAccessToken, setAccessToken, ApiRequestError } from './lib/api';
import { connectSocket, disconnectSocket, getSocket, onPresenceUpdate, onVoiceStateUpdate, onSocketReconnect, onCallInvite, onCallCancel, setPresence as setSocketPresence, onGuildJoined, onGuildLeft, onGuildUpdate, onGuildDelete, onChannelUpdate, onChannelDelete, onGuildMemberAdd, onGuildMemberRemove, onDmChannelCreate, joinGuildRoom, onTypingStart, onNotificationCreate, type CallInvitePayload } from './lib/socket';
import { useMobileSwipe } from './hooks/useMobileSwipe';
import { haptic } from './utils/haptics';
import { useIsMobile } from './hooks/useIsMobile';
import { useQuerySocketSync, useGuildsQuery, useDmChannelsQuery, invalidateGuilds } from './hooks/queries';
import { queryClient } from './lib/queryClient';
import { messagesQueryKey } from './hooks/queries/useMessagesQuery';
import { useSplitView, SplitViewContainer, SplitViewRightPane } from './components/SplitView';
import { useDesktopDeepLinks } from './hooks/useDesktopDeepLinks';
import { useDesktopIdleDetection } from './hooks/useDesktopIdleDetection';
import { useDesktopMenuNavigation } from './hooks/useDesktopMenuNavigation';
import { useDesktopNotifications } from './hooks/useDesktopNotifications';
import { useGameActivity } from './hooks/useGameActivity';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import UpdateBanner from './components/ui/UpdateBanner';

// Lazy-loaded modal components for code splitting
const SettingsModal = lazy(() => import('./components/modals/SettingsModal'));
const UserProfileModal = lazy(() => import('./components/modals/UserProfileModal'));
const GuildSettingsModal = lazy(() => import('./components/modals/GuildSettingsModal'));
const WhatsNewModal = lazy(() => import('./components/modals/WhatsNewModal'));
import { CHANGELOG } from './data/changelog';
const OnboardingModal = lazy(() => import('./components/modals/OnboardingModal'));
import { OnboardingTour, useShouldShowTour } from './components/ui/OnboardingTour';
const BugReportModal = lazy(() => import('./components/modals/BugReportModal'));
const KeyboardShortcutsModal = lazy(() => import('./components/modals/KeyboardShortcutsModal'));
const NotificationModal = lazy(() => import('./components/modals/NotificationModal'));
import CreateGuildModal from './components/modals/CreateGuildModal';
import PresenceMenu, { PresenceType, PRESENCE_COLORS } from './components/modals/PresenceMenu';
import ScreenShareModal from './components/modals/ScreenShareModal';
import { ChannelSettingsModal } from './components/modals/ChannelSettingsModal';
import MemberOptionsModal from './components/modals/MemberOptionsModal';
import IncomingCallModal from './components/modals/IncomingCallModal';
import InviteModal from './components/modals/InviteModal';
import DMSearchModal from './components/modals/DMSearchModal';
import GroupDmCreateModal from './components/modals/GroupDmCreateModal';
import ExternalLinkModal from './components/modals/ExternalLinkModal';
import { NotificationPrefsModal } from './components/modals/NotificationPrefsModal';
import { Tooltip } from './components/ui/Tooltip';
import { ModalWrapper } from './components/ui/ModalWrapper';
import { useTheme, type AppTheme } from './components/ui/ThemeProvider';
import { getGuildTheme, setGuildTheme, removeGuildTheme, hasGuildTheme } from './utils/guildTheme';
import { RecentChannels, addRecentChannel } from './components/guild/RecentChannels';
import { getAllThemes } from './themes/registry';
import { ContextMenuProvider, useContextMenu } from './components/ui/ContextMenu';
import { ToastProvider, useToast } from './components/ui/ToastManager';
import { Shield as ShieldIcon } from 'lucide-react';
import { StarRating } from './components/ui/StarRating';
import AchievementToastProvider from './components/ui/AchievementToast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import AnimatedGuildIcon from './components/ui/AnimatedGuildIcon';
import { SkeletonChannelGroup, SkeletonDmList, SkeletonMemberList } from './components/ui/SkeletonLoader';
import AmbientPlayer from './components/ui/AmbientPlayer';
import ConnectionBanner from './components/ui/ConnectionBanner';
import ThemePreviewBanner from './components/ui/ThemePreviewBanner';
import SeasonalOverlay from './components/ui/SeasonalOverlay';
import LiveAnnouncer, { announce } from './components/ui/LiveAnnouncer';
import { VoiceProvider, useVoice } from './contexts/VoiceContext';
import { useVoiceSounds } from './hooks/useVoiceSounds';
import Avatar from './components/ui/Avatar';
import UserProfilePopover from './components/ui/UserProfilePopover';
import { useGuildSession, type GuildSessionErrorCode, type GuildSessionInfo, type GuildSessionChannel } from './hooks/useGuildSession';
import { isAuthRuntimeExpired } from './lib/authRuntime';
import { useUnreadStore, setChannelHasUnread, incrementUnread, markRead as markReadStore, registerChannelGuild, hasGuildUnread, getGuildMentionCount } from './store/unreadStore';

type MediaType = 'video' | 'image' | null;
type ModalType = 'settings' | 'userProfile' | 'createGuild' | 'screenShare' | 'guildSettings' | 'memberOptions' | 'invite' | 'globalSearch' | 'dmSearch' | 'notifications' | 'shortcuts' | 'bugReport' | 'onboarding' | 'createGroupDm' | null;
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

const ActivityFeedPage = () => { const nav = useNavigate(); return <Suspense fallback={<LazyFallback />}><ActivityFeed onClose={() => nav('/')} /></Suspense>; };
const LeaderboardPage = () => { const nav = useNavigate(); return <Suspense fallback={<LazyFallback />}><Leaderboard onClose={() => nav('/')} /></Suspense>; };

/** Registers a global right-click handler that appends "Report a Bug" to empty-area context menus */
const GlobalBugReportContextMenu = ({ onOpenBugReport }: { onOpenBugReport: () => void }) => {
    const { openMenu } = useContextMenu();
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Skip if a component already handles its own context menu
            if (target.closest('[data-context-menu]') || target.closest('.guild-icon') || target.closest('.channel-item') || target.closest('.member-item') || target.closest('.message-row') || target.closest('a') || target.closest('img') || target.closest('input') || target.closest('textarea')) return;
            e.preventDefault();
            openMenu(e as unknown as React.MouseEvent, [
                { id: 'bug-report', label: 'Report a Bug', icon: Bug, onClick: onOpenBugReport },
            ]);
        };
        window.addEventListener('contextmenu', handler);
        return () => window.removeEventListener('contextmenu', handler);
    }, [openMenu, onOpenBugReport]);
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

const GuildRail = ({ isOpen, onOpenCreateGuild, onOpenNotifications, onOpenBugReport, onOpenProfile, onOpenSettings, onOpenGuildSettings, onOpenInvite, onGuildsRefresh, onGuildLeave, guilds, userProfile }: { isOpen: boolean, onOpenCreateGuild: () => void, onOpenNotifications: () => void, onOpenBugReport: () => void, onOpenProfile: () => void, onOpenSettings: () => void, onOpenGuildSettings: () => void, onOpenInvite: () => void, onGuildsRefresh?: () => void, onGuildLeave?: (guildId: string) => void, guilds: Array<{ id: string; name: string; ownerId: string; iconHash: string | null; description: string | null; memberCount: number; boostTier?: number }>, userProfile: { id?: string; name: string; avatarHash?: string | null; avatarFrame?: 'none' | 'neon' | 'gold' | 'glass' } }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { openMenu } = useContextMenu();
    const { addToast } = useToast();
    const [notifPrefs, setNotifPrefs] = useState<{ type: 'guild' | 'channel'; id: string; name: string } | null>(null);
    const [ratingGuild, setRatingGuild] = useState<{ id: string; name: string } | null>(null);
    const [ratingValue, setRatingValue] = useState(0);
    const [ratingInfo, setRatingInfo] = useState<{ avg: number; total: number } | null>(null);
    const [ratingSubmitting, setRatingSubmitting] = useState(false);
    const [themePickerGuild, setThemePickerGuild] = useState<{ id: string; name: string } | null>(null);
    const [guildFolders, setGuildFolders] = useState<Array<{ id: string; name: string; color: string; guildIds: string[]; collapsed: boolean }>>([]);
    const [notifCount, setNotifCount] = useState(0);
    useUnreadStore(); // subscribe to re-render on unread changes

    // Listen for new notifications to update unread badge
    useEffect(() => {
        return onNotificationCreate(() => {
            setNotifCount(prev => prev + 1);
        });
    }, []);

    // Load guild folders from API
    useEffect(() => {
        api.users.getGuildFolders().then((folders: any[]) => {
            if (Array.isArray(folders)) {
                setGuildFolders(folders.map((f: any) => ({
                    id: f.id, name: f.name || '', color: f.color || '#526df5',
                    guildIds: f.guildIds || [], collapsed: false,
                })));
            }
        }).catch(() => {});
    }, []);
    const isAppRoot = location.pathname === '/' || [
        '/friends', '/discover', '/shop', '/marketplace', '/inventory',
        '/creator-dashboard', '/fame', '/dm',
        '/admin', '/help-center', '/message-requests',
        '/me', '/saved-messages', '/read-later',
        '/friend-activity', '/daily-challenges', '/inbox',
        '/activity', '/leaderboard', '/schedule-calendar',
        '/gacha', '/trading', '/bot-store', '/bot-builder',
        '/theme-builder', '/badges', '/saved', '/download',
    ].some(path => location.pathname.startsWith(path));

    const activeGuildId = (() => {
        const match = location.pathname.match(/\/guild\/([^/]+)/);
        return match ? match[1] : null;
    })();

    const handleGuildContext = (e: React.MouseEvent, guild: { id: string; name: string; ownerId: string }) => {
        e.preventDefault();
        let overrides: Record<string, boolean> = {};
        try { overrides = JSON.parse(localStorage.getItem('gratonite-server-activity-overrides') || '{}'); } catch {}
        const autoShare = localStorage.getItem('gratonite-auto-share-on-join') !== 'false';
        const activityEnabled = overrides[guild.id] ?? autoShare;
        const isOwner = guild.ownerId === userProfile.id;

        openMenu(e, [
            { id: 'mark-read', label: 'Mark as Read', icon: Check, onClick: () => {
                api.channels.getGuildChannels(guild.id).then((channels: any[]) => {
                    channels.forEach((ch: any) => api.messages.ack(ch.id).catch(() => {}));
                    addToast({ title: `${guild.name} marked as read`, variant: 'info' });
                }).catch(() => addToast({ title: 'Failed to mark as read', variant: 'error' }));
            }},
            { id: 'mute', label: 'Mute Portal', icon: Volume1, onClick: () => {
                api.channels.getGuildChannels(guild.id).then((channels: any[]) => {
                    channels.forEach((ch: any) => api.channels.setNotificationPrefs(ch.id, { level: 'none' }).catch(() => {}));
                    addToast({ title: `${guild.name} muted`, variant: 'info' });
                }).catch(() => addToast({ title: 'Failed to mute portal', variant: 'error' }));
            }},
            { divider: true, id: 'div1', label: '' },
            ...(isOwner ? [{ id: 'server-settings', label: 'Portal Settings', icon: Settings, onClick: () => { navigate(`/guild/${guild.id}`); onOpenGuildSettings(); } }] : []),
            { id: 'invite', label: 'Invite People', icon: Link2, onClick: () => {
                api.invites.create(guild.id, {}).then((invite) => {
                    const link = `${window.location.origin}/app/invite/${invite.code}`;
                    copyToClipboard(link);
                    addToast({ title: 'Invite link copied to clipboard', variant: 'success' });
                }).catch(() => onOpenInvite());
            }},
            { id: 'notification-settings', label: 'Notification Settings', icon: Bell, onClick: () => setNotifPrefs({ type: 'guild', id: guild.id, name: guild.name }) },
            { id: 'boost', label: 'Boost Portal', icon: Zap, onClick: () => {
                api.guilds.boost(guild.id).then(() => {
                    addToast({ title: `Boosted ${guild.name}!`, variant: 'success' });
                }).catch(() => addToast({ title: 'Failed to boost', variant: 'error' }));
            }},
            { id: 'rate-portal', label: 'Rate Portal', icon: Star, onClick: () => {
                setRatingGuild({ id: guild.id, name: guild.name });
                setRatingValue(0);
                setRatingInfo(null);
                api.guilds.getRating(guild.id).then((data) => {
                    setRatingInfo({ avg: data.averageRating, total: data.totalRatings });
                    if (data.userRating) setRatingValue(data.userRating);
                }).catch(() => { addToast({ title: 'Failed to load portal rating', variant: 'error' }); });
            }},
            { id: 'activity-toggle', label: activityEnabled ? 'Disable Activity Status' : 'Enable Activity Status', icon: Activity, onClick: () => {
                const newOverrides = { ...overrides, [guild.id]: !activityEnabled };
                try { localStorage.setItem('gratonite-server-activity-overrides', JSON.stringify(newOverrides)); } catch {}
                addToast({ title: `Activity ${!activityEnabled ? 'enabled' : 'disabled'} for ${guild.name}`, variant: 'success' });
            }},
            { id: 'privacy-settings', label: 'Privacy Settings', icon: ShieldIcon, onClick: () => onOpenSettings() },
            { id: 'guild-theme', label: 'Set Portal Theme', icon: Paintbrush, onClick: () => setThemePickerGuild({ id: guild.id, name: guild.name }) },
            { divider: true, id: 'div2', label: '' },
            { id: 'copy-id', label: 'Copy Portal ID', icon: Copy, onClick: () => { copyToClipboard(guild.id); addToast({ title: 'Portal ID copied', variant: 'info' }); } },
            { id: 'create-folder', label: 'Create Folder', icon: FolderIcon, onClick: () => {
                const folderId = `folder-${Date.now()}`;
                const newFolder = { id: folderId, name: 'New Folder', color: '#526df5', guildIds: [guild.id], collapsed: false };
                setGuildFolders(prev => [...prev, newFolder]);
                api.users.createGuildFolder({ name: 'New Folder', color: '#526df5', guildIds: [guild.id] }).catch(() => { addToast({ title: 'Failed to create folder', variant: 'error' }); });
                addToast({ title: 'Folder created', variant: 'success' });
            }},
            { id: 'leave', label: 'Leave Portal', icon: LogOut, color: 'var(--error)', onClick: () => {
                const guildId = guild.id;
                onGuildLeave?.(guildId);
                if (location.pathname.startsWith(`/guild/${guildId}`)) navigate('/');
                addToast({
                    title: `Left ${guild.name}`,
                    variant: 'undo' as const,
                    onUndo: () => { onGuildsRefresh?.(); },
                    onExpire: () => {
                        api.guilds.leave(guildId).catch(() => { onGuildsRefresh?.(); addToast({ title: 'Failed to leave portal', variant: 'error' }); });
                    },
                });
            }},
        ]);
    };

    // GSAP guild icon hover: scale + borderRadius morph
    const railRef = useRef<HTMLElement>(null);
    useEffect(() => {
        const rail = railRef.current;
        if (!rail || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const icons = rail.querySelectorAll('.guild-icon');
        const enters: Array<(e: Event) => void> = [];
        const leaves: Array<(e: Event) => void> = [];
        icons.forEach((icon) => {
            const enter = () => gsap.to(icon, { scale: 1.08, borderRadius: '16px', duration: 0.25, ease: 'back.out(2)' });
            const leave = () => gsap.to(icon, { scale: 1, borderRadius: '24px', duration: 0.25, ease: 'power2.out' });
            icon.addEventListener('mouseenter', enter);
            icon.addEventListener('mouseleave', leave);
            enters.push(enter);
            leaves.push(leave);
        });
        return () => {
            icons.forEach((icon, i) => {
                icon.removeEventListener('mouseenter', enters[i]);
                icon.removeEventListener('mouseleave', leaves[i]);
            });
        };
    }, [guilds]);

    return (
        <nav ref={railRef} className={`guild-rail glass-panel ${isOpen ? 'open' : ''}`} aria-label="Server navigation" onKeyDown={(e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            e.preventDefault();
            const nav = e.currentTarget;
            const focusable = Array.from(nav.querySelectorAll<HTMLElement>('a, [role="button"], [tabindex="0"]'));
            const idx = focusable.indexOf(document.activeElement as HTMLElement);
            if (idx < 0) return;
            const next = e.key === 'ArrowDown' ? focusable[idx + 1] : focusable[idx - 1];
            next?.focus();
        }}>
            <Link to="/" style={{ textDecoration: 'none' }}>
                <div className={`guild-icon ${isAppRoot ? 'active' : ''}`} style={!isAppRoot ? { background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.5))' } : {}}>
                    {isAppRoot && <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2), transparent)', width: '100%', height: '100%', borderRadius: 'inherit', position: 'absolute' }}></div>}
                    <Home size={24} />
                </div>
            </Link>

            <Tooltip content="Profile" position="right">
                <div className="guild-icon" role="button" aria-label="Open your profile" tabIndex={0} onClick={onOpenProfile} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenProfile(); } }} style={{ cursor: 'pointer', overflow: 'hidden', padding: 0 }}>
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
                <div className="guild-icon" role="button" aria-label="Notifications inbox" tabIndex={0} onClick={() => { setNotifCount(0); onOpenNotifications(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNotifCount(0); onOpenNotifications(); } }} style={{ background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', position: 'relative' }}>
                    <Bell size={24} />
                    {notifCount > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: -4,
                            right: -4,
                            background: 'var(--error, #ed4245)',
                            color: 'white',
                            borderRadius: '50%',
                            width: 16,
                            height: 16,
                            fontSize: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                        }}>
                            {notifCount > 9 ? '9+' : notifCount}
                        </span>
                    )}
                </div>
            </Tooltip>

            <div style={{ width: '32px', height: '2px', background: 'var(--stroke)', margin: '4px 0' }}></div>

            {guilds.map(guild => {
                const guildHasUnread = hasGuildUnread(guild.id) && activeGuildId !== guild.id;
                const guildMentions = activeGuildId !== guild.id ? getGuildMentionCount(guild.id) : 0;
                return (
                <Tooltip key={guild.id} content={guild.name} position="right">
                    <Link to={`/guild/${guild.id}`} style={{ textDecoration: 'none', position: 'relative' }} onContextMenu={(e) => handleGuildContext(e, guild)}>
                        <div className={`guild-icon ${activeGuildId === guild.id ? 'active' : ''}`}
                             style={{ background: getDeterministicGradient(guild.name), color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                            {guild.iconHash ? (
                                <AnimatedGuildIcon
                                    src={`${API_BASE}/files/${guild.iconHash}`}
                                    alt={`${guild.name} server icon`}
                                />
                            ) : (
                                guild.name.charAt(0).toUpperCase()
                            )}
                        </div>
                        {guildHasUnread && guildMentions === 0 && (
                            <span style={{
                                position: 'absolute', left: '-4px', top: '50%', transform: 'translateY(-50%)',
                                width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-primary)',
                            }} />
                        )}
                        {guildMentions > 0 && (
                            <span style={{
                                position: 'absolute', bottom: '-4px', right: '-4px',
                                minWidth: '18px', height: '18px', borderRadius: '9px',
                                background: 'var(--error, #ed4245)',
                                border: '2px solid var(--bg-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: '0 4px', boxSizing: 'border-box',
                            }}>
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                                    {guildMentions > 99 ? '99+' : guildMentions}
                                </span>
                            </span>
                        )}
                        {hasGuildTheme(guild.id) && (
                            <span style={{
                                position: 'absolute', bottom: '-2px', right: '-2px',
                                width: '14px', height: '14px', borderRadius: '50%',
                                background: 'var(--accent-primary)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                border: '2px solid var(--bg-primary)',
                            }}>
                                <Paintbrush size={8} style={{ color: 'white' }} />
                            </span>
                        )}
                        {(guild.boostTier ?? 0) > 0 && (
                            <span style={{
                                position: 'absolute', top: '-3px', right: '-3px',
                                fontSize: '9px', fontWeight: 800, lineHeight: '14px',
                                minWidth: '14px', height: '14px', borderRadius: '7px',
                                background: (guild.boostTier ?? 0) >= 3 ? '#ffd700' : '#ff73fa',
                                color: (guild.boostTier ?? 0) >= 3 ? '#000' : '#fff',
                                textAlign: 'center', padding: '0 3px',
                                border: '2px solid var(--bg-primary)',
                            }}>
                                {guild.boostTier}
                            </span>
                        )}
                    </Link>
                </Tooltip>
                );
            })}

            <Tooltip content="Create Portal" position="right">
                <div className="guild-icon" role="button" aria-label="Create guild" tabIndex={0} onClick={onOpenCreateGuild} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenCreateGuild(); } }} style={{ background: 'transparent', border: '1px dashed var(--stroke-light)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Plus size={24} />
                </div>
            </Tooltip>

            <div style={{ flex: 1 }}></div>

            <Tooltip content="Help & Support" position="right">
                <div className="guild-icon" role="button" aria-label="Help and support" tabIndex={0} onClick={() => navigate('/help-center')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/help-center'); } }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', width: '32px', height: '32px', minWidth: '32px', minHeight: '32px', marginBottom: '4px' }}>
                    <HelpCircle size={18} />
                </div>
            </Tooltip>

            <Tooltip content="Report Bug" position="right">
                <div className="guild-icon" role="button" aria-label="Report a bug" tabIndex={0} onClick={onOpenBugReport} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenBugReport(); } }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '8px' }}>
                    <Bug size={24} />
                </div>
            </Tooltip>
            {notifPrefs && (
                <NotificationPrefsModal
                    type={notifPrefs.type}
                    id={notifPrefs.id}
                    name={notifPrefs.name}
                    onClose={() => setNotifPrefs(null)}
                />
            )}
            {ratingGuild && (
                <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setRatingGuild(null)}>
                    <div role="dialog" aria-modal="true" style={{ width: '360px', background: 'var(--bg-elevated)', borderRadius: '16px', padding: '24px', border: '1px solid var(--stroke)', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Rate {ratingGuild.name}</h3>
                            <button onClick={() => setRatingGuild(null)} aria-label="Close rating dialog" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><X size={18} /></button>
                        </div>
                        {ratingInfo && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                                <StarRating value={ratingInfo.avg} readOnly size={16} />
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b' }}>{ratingInfo.avg.toFixed(1)}</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({ratingInfo.total} ratings)</span>
                            </div>
                        )}
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>How would you rate this portal?</p>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                            <StarRating value={ratingValue} onChange={setRatingValue} size={32} />
                        </div>
                        <button
                            disabled={ratingValue === 0 || ratingSubmitting}
                            onClick={() => {
                                setRatingSubmitting(true);
                                api.guilds.rate(ratingGuild.id, ratingValue).then(() => {
                                    addToast({ title: `Rated ${ratingGuild.name} ${ratingValue} stars`, variant: 'success' });
                                    setRatingGuild(null);
                                }).catch(() => {
                                    addToast({ title: 'Failed to submit rating', variant: 'error' });
                                }).finally(() => setRatingSubmitting(false));
                            }}
                            style={{ width: '100%', padding: '12px', borderRadius: '10px', background: ratingValue > 0 ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: ratingValue > 0 ? '#111' : 'var(--text-muted)', cursor: (ratingValue === 0 || ratingSubmitting) ? 'not-allowed' : 'pointer', opacity: ratingSubmitting ? 0.5 : 1, fontWeight: 700, fontSize: '14px', transition: 'background 0.2s' }}
                        >
                            {ratingSubmitting ? 'Submitting...' : ratingValue > 0 ? `Submit ${ratingValue} Star${ratingValue > 1 ? 's' : ''}` : 'Select a rating'}
                        </button>
                    </div>
                </div>
            )}
            {themePickerGuild && (() => {
                const registryThemes = getAllThemes();
                const currentGuildTheme = getGuildTheme(themePickerGuild.id) || '';
                const isSelected = (id: string) => currentGuildTheme === id || (!currentGuildTheme && id === '');
                return (
                    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setThemePickerGuild(null)}>
                        <div role="dialog" aria-modal="true" style={{ width: '440px', maxHeight: '80vh', background: 'var(--bg-elevated)', borderRadius: '16px', padding: '24px', border: '1px solid var(--stroke)', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Portal Theme</h3>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{themePickerGuild.name}</div>
                                </div>
                                <button onClick={() => setThemePickerGuild(null)} aria-label="Close theme picker" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}><X size={18} /></button>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Choose a theme that will be applied whenever you visit this portal.</p>
                            <div style={{ overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                {/* Default option to clear override */}
                                <button
                                    onClick={() => {
                                        removeGuildTheme(themePickerGuild.id);
                                        addToast({ title: 'Portal theme removed', variant: 'success' });
                                        setThemePickerGuild(null);
                                    }}
                                    style={{
                                        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                                        background: isSelected('') ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-tertiary)',
                                        border: isSelected('') ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                        color: isSelected('') ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        fontSize: '13px', fontWeight: 600, textAlign: 'left',
                                        transition: 'all 0.15s', gridColumn: '1 / -1',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                    }}
                                >
                                    <span style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px dashed var(--text-muted)', flexShrink: 0 }} />
                                    Default (no override)
                                </button>
                                {/* Registry themes */}
                                {registryThemes.map(theme => (
                                    <button
                                        key={theme.id}
                                        onClick={() => {
                                            setGuildTheme(themePickerGuild.id, theme.id);
                                            addToast({ title: `Theme set to ${theme.name}`, variant: 'success' });
                                            setThemePickerGuild(null);
                                        }}
                                        style={{
                                            padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                                            background: isSelected(theme.id) ? 'rgba(88, 101, 242, 0.15)' : 'var(--bg-tertiary)',
                                            border: isSelected(theme.id) ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                            color: isSelected(theme.id) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '13px', fontWeight: 600, textAlign: 'left',
                                            transition: 'all 0.15s',
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                        }}
                                    >
                                        {/* Color preview swatches */}
                                        <span style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: theme.preview.bg }} />
                                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: theme.preview.sidebar }} />
                                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: theme.preview.accent }} />
                                            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: theme.preview.text }} />
                                        </span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{theme.name}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>{theme.isDark ? 'dark' : 'light'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </nav>
    );
};

const ChannelSidebar = ({ isOpen, onOpenSettings, onOpenProfile, onOpenGlobalSearch, onOpenDMSearch, onOpenCreateGroupDm, onOpenWhatsNew, userProfile, guildSession }: { isOpen: boolean, onOpenSettings: () => void, onOpenProfile: () => void, onOpenGlobalSearch: () => void, onOpenDMSearch: () => void, onOpenCreateGroupDm: () => void, onOpenWhatsNew: () => void, userProfile: { id?: string, name: string, handle: string, status: string, customStatus: string, avatarStyle: string, avatarFrame: string, nameplateStyle?: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch', avatarHash?: string | null, badges: string[] }, guildSession: GuildSessionViewState }) => {
    const { openMenu } = useContextMenu();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const voiceState = useVoice();
    const [channelSettingsOpen, setChannelSettingsOpen] = useState<{ id: string; name: string; topic?: string; rateLimitPerUser?: number; isNsfw?: boolean; channelType?: string; userLimit?: number } | null>(null);
    const unreadMap = useUnreadStore();
    const [privateToggle, setPrivateToggle] = useState(false);
    const [showCreateChannel, setShowCreateChannel] = useState<{ type: 'text' | 'voice' | 'document'; parentId?: string } | null>(null);
    const [notifPrefs, setNotifPrefs] = useState<{ type: 'guild' | 'channel'; id: string; name: string } | null>(null);
    const [newChannelName, setNewChannelName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<{ name: string; topic?: string; rateLimitPerUser?: number; isAnnouncement?: boolean; channelType?: string } | null>(null);
    const [favoriteChannelIds, setFavoriteChannelIds] = useState<Set<string>>(new Set());
    const [channelTyping, setChannelTyping] = useState<Map<string, string[]>>(new Map());
    const [dmPresenceMap, setDmPresenceMap] = useState<Record<string, string>>({});
    const prefetchTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Sidebar resize handle
    const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
        try { return parseInt(localStorage.getItem('gratonite-sidebar-width') || '280') || 280; } catch { return 280; }
    });
    const resizingRef = useRef(false);
    const sidebarRef = useRef<HTMLElement>(null);
    const sidebarWidthRef = useRef(sidebarWidth);
    sidebarWidthRef.current = sidebarWidth;
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;
            e.preventDefault();
            const newWidth = Math.min(480, Math.max(200, e.clientX - (sidebarRef.current?.getBoundingClientRect().left ?? 72)));
            setSidebarWidth(newWidth);
        };
        const handleMouseUp = () => {
            if (resizingRef.current) {
                resizingRef.current = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                try { localStorage.setItem('gratonite-sidebar-width', String(sidebarWidthRef.current)); } catch {}
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, []);

    // Listen for typing events across channels for sidebar indicators
    useEffect(() => {
        return onTypingStart((data) => {
            setChannelTyping(prev => {
                const next = new Map(prev);
                const current = next.get(data.channelId) || [];
                if (!current.includes(data.username)) {
                    next.set(data.channelId, [...current, data.username]);
                }
                setTimeout(() => {
                    setChannelTyping(prev2 => {
                        const next2 = new Map(prev2);
                        const list = next2.get(data.channelId) || [];
                        next2.set(data.channelId, list.filter(u => u !== data.username));
                        if (next2.get(data.channelId)?.length === 0) next2.delete(data.channelId);
                        return next2;
                    });
                }, 5000);
                return next;
            });
        });
    }, []);

    // Track presence for DM contacts
    useEffect(() => {
        return onPresenceUpdate((payload) => {
            setDmPresenceMap(prev => {
                if (prev[payload.userId] === payload.status) return prev;
                return { ...prev, [payload.userId]: payload.status };
            });
        });
    }, []);

    // Load favorites
    useEffect(() => {
        api.users.getFavorites().then((favs: any[]) => {
            if (Array.isArray(favs)) {
                setFavoriteChannelIds(new Set(favs.map((f: any) => f.channelId || f.id)));
            }
        }).catch(() => {});
    }, []);

    // Guild data for guild mode
    const location = useLocation();
    const guildMatch = location.pathname.match(/\/guild\/([^/]+)/);
    const activeGuildId = guildMatch ? guildMatch[1] : null;
    const [legacyGuildInfo, setLegacyGuildInfo] = useState<{ id: string; name: string; iconHash: string | null; description: string | null; memberCount: number } | null>(null);
    const [legacyGuildChannels, setLegacyGuildChannels] = useState<Array<{ id: string; name: string; type: string; parentId: string | null; position: number; topic: string | null }>>([]);
    const [legacyChannelsLoading, setLegacyChannelsLoading] = useState(false);
    const [canManageChannels, setCanManageChannels] = useState(false);
    const [mutedChannelIds, setMutedChannelIds] = useState<Set<string>>(new Set());
    const [draftChannelIds, setDraftChannelIds] = useState<Set<string>>(new Set());
    const [rulesAgreedGuilds, setRulesAgreedGuilds] = useState<Set<string>>(new Set());
    const [showRulesGate, setShowRulesGate] = useState(false);
    const guildInfo = guildSession.enabled ? guildSession.guildInfo : legacyGuildInfo;
    const guildChannels = guildSession.enabled ? guildSession.channels : legacyGuildChannels;
    const setGuildChannels = guildSession.enabled ? guildSession.setChannels : setLegacyGuildChannels;
    // Register channel-guild mappings for unread tracking
    useEffect(() => {
        if (!activeGuildId) return;
        for (const ch of guildChannels) {
            registerChannelGuild(ch.id, activeGuildId);
        }
    }, [activeGuildId, guildChannels]);

    // Set Sentry navigation context for error attribution
    useEffect(() => {
        const channelMatch = location.pathname.match(/\/(?:channel|voice)\/([^/]+)/);
        const dmMatch = location.pathname.match(/\/dm\/([^/]+)/);
        const activeChannelId = channelMatch?.[1] || dmMatch?.[1] || null;
        import('@sentry/react').then(Sentry => {
            Sentry.setContext('navigation', { guildId: activeGuildId, channelId: activeChannelId });
        }).catch(() => {});
    }, [activeGuildId, location.pathname]);

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

    // Check if current user can manage channels (owner or has MANAGE_CHANNELS/ADMINISTRATOR)
    useEffect(() => {
        if (!activeGuildId || !userProfile?.id) { setCanManageChannels(false); return; }
        const checkPerms = async () => {
            try {
                const guild = guildInfo as any;
                if (guild?.ownerId === userProfile.id) { setCanManageChannels(true); return; }
                const roles: any[] = await api.guilds.getMemberRoles(activeGuildId!, userProfile.id!);
                const ADMINISTRATOR = 1n << 0n;
                const MANAGE_CHANNELS = 1n << 2n;
                const has = roles?.some((r: any) => {
                    const perms = BigInt(r.permissions || '0');
                    return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_CHANNELS) !== 0n;
                });
                setCanManageChannels(!!has);
            } catch { setCanManageChannels(false); }
        };
        checkPerms();
    }, [activeGuildId, userProfile?.id, guildInfo]);

    // Listen for channel deletions (from socket events or modals) and remove from sidebar
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.channelId) {
                setGuildChannels((prev: any[]) => prev.filter((ch: any) => ch.id !== detail.channelId));
            }
        };
        window.addEventListener('gratonite:channel-deleted', handler);
        return () => window.removeEventListener('gratonite:channel-deleted', handler);
    }, [setGuildChannels]);

    // Fetch muted channels for sidebar indicators
    useEffect(() => {
        if (!activeGuildId || guildChannels.length === 0) { setMutedChannelIds(new Set()); return; }
        const fetchMuted = async () => {
            const muted = new Set<string>();
            await Promise.all(guildChannels.map(async (ch) => {
                try {
                    const prefs = await api.channels.getNotificationPrefs(ch.id);
                    if (prefs.level === 'none' || (prefs.mutedUntil && new Date(prefs.mutedUntil) > new Date())) {
                        muted.add(ch.id);
                    }
                } catch { /* ignore */ }
            }));
            setMutedChannelIds(muted);
        };
        fetchMuted();
    }, [activeGuildId, guildChannels.length]);

    // Fetch draft channel IDs for sidebar indicators
    useEffect(() => {
        if (!activeGuildId) { setDraftChannelIds(new Set()); return; }
        api.drafts.listAll().then((drafts) => {
            const guildChIds = new Set(guildChannels.map(c => c.id));
            const ids = new Set(drafts.filter(d => guildChIds.has(d.channelId)).map(d => d.channelId));
            setDraftChannelIds(ids);
        }).catch(() => {});
    }, [activeGuildId, guildChannels.length]);

    // Show rules gate if guild requires rules agreement
    useEffect(() => {
        if (!activeGuildId || !guildInfo) { setShowRulesGate(false); return; }
        if ((guildInfo as any).requireRulesAgreement && (guildInfo as any).rulesText && !(guildInfo as any).agreedRulesAt && !rulesAgreedGuilds.has(activeGuildId)) {
            setShowRulesGate(true);
        } else {
            setShowRulesGate(false);
        }
    }, [activeGuildId, guildInfo, rulesAgreedGuilds]);

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


    const handleDuplicateChannel = async (channelId: string, channelName: string) => {
        try {
            await api.channels.duplicate(channelId);
            if (activeGuildId) {
                if (guildSession.enabled) {
                    await guildSession.refresh();
                } else {
                    const chs = await api.channels.getGuildChannels(activeGuildId);
                    setLegacyGuildChannels(chs as any);
                }
            }
            addToast({ title: 'Channel Duplicated', description: `#${channelName}-copy has been created.`, variant: 'success' });
        } catch {
            addToast({ title: 'Failed to duplicate channel', variant: 'error' });
        }
    };

    const handleCreateChannel = async () => {
        if (!activeGuildId || !newChannelName.trim() || !showCreateChannel) return;
        try {
            const channelType = showCreateChannel.type === 'voice' ? 'GUILD_VOICE' : showCreateChannel.type === 'document' ? 'GUILD_DOCUMENT' : 'GUILD_TEXT';
            const slug = newChannelName.trim().toLowerCase().replace(/\s+/g, '-');
            const created = await api.channels.create(activeGuildId, {
                name: slug,
                type: selectedTemplate?.channelType || channelType,
                parentId: showCreateChannel.parentId,
            });
            // Apply template settings after creation
            if (selectedTemplate && created?.id) {
                const updates: Record<string, unknown> = {};
                if (selectedTemplate.topic) updates.topic = selectedTemplate.topic;
                if (selectedTemplate.rateLimitPerUser) updates.rateLimitPerUser = selectedTemplate.rateLimitPerUser;
                if (selectedTemplate.isAnnouncement) updates.isAnnouncement = true;
                if (Object.keys(updates).length > 0) {
                    await api.channels.update(created.id, updates as any).catch(() => {});
                }
            }
            if (guildSession.enabled) {
                await guildSession.refresh();
            } else {
                const chs = await api.channels.getGuildChannels(activeGuildId);
                setLegacyGuildChannels(chs as any);
            }
            setShowCreateChannel(null);
            setNewChannelName('');
            setSelectedTemplate(null);
            addToast({ title: 'Channel Created', description: `#${slug} has been created.`, variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Failed to create channel', description: err?.message || 'Something went wrong.', variant: 'error' });
        }
    };

    const handleCategoryContext = (e: React.MouseEvent, category: { id: string; name: string }, childChannelIds: string[]) => {
        e.preventDefault();
        e.stopPropagation();
        const allChildrenMuted = childChannelIds.length > 0 && childChannelIds.every(id => mutedChannelIds.has(id));
        openMenu(e, [
            { id: 'mark-read', label: 'Mark Category as Read', icon: Check, onClick: () => {
                childChannelIds.forEach(id => { api.messages.ack(id).catch(() => {}); markReadStore(id); });
                addToast({ title: `${category.name} marked as read`, variant: 'info' });
            }},
            { id: 'mute', label: allChildrenMuted ? 'Unmute Category' : 'Mute Category', icon: allChildrenMuted ? Bell : BellOff, onClick: () => {
                if (allChildrenMuted) {
                    childChannelIds.forEach(id => { api.channels.setNotificationPrefs(id, { level: 'default' }).catch(() => {}); });
                    setMutedChannelIds(prev => { const next = new Set(prev); childChannelIds.forEach(id => next.delete(id)); return next; });
                    addToast({ title: `${category.name} unmuted`, variant: 'info' });
                } else {
                    childChannelIds.forEach(id => { api.channels.setNotificationPrefs(id, { level: 'none' }).catch(() => {}); });
                    setMutedChannelIds(prev => { const next = new Set(prev); childChannelIds.forEach(id => next.add(id)); return next; });
                    addToast({ title: `${category.name} muted`, variant: 'info' });
                }
            }},
            { id: 'collapse-toggle', label: collapsed[category.id] ? 'Expand Category' : 'Collapse Category', icon: collapsed[category.id] ? ChevronDown : ChevronRight, onClick: () => {
                toggleCategory(category.id);
            }},
            { id: 'collapse-all', label: 'Collapse All Categories', icon: Minus, onClick: () => {
                const isCategoryType = (type: string) => type === 'category' || type === 'GUILD_CATEGORY';
                const allCats = guildChannels.filter(c => isCategoryType(c.type));
                const newCollapsed: Record<string, boolean> = { ...collapsed };
                allCats.forEach(c => { newCollapsed[c.id] = true; });
                setCollapsed(newCollapsed);
            }},
            { id: 'expand-all', label: 'Expand All Categories', icon: Plus, onClick: () => {
                const isCategoryType = (type: string) => type === 'category' || type === 'GUILD_CATEGORY';
                const allCats = guildChannels.filter(c => isCategoryType(c.type));
                const newCollapsed: Record<string, boolean> = { ...collapsed };
                allCats.forEach(c => { newCollapsed[c.id] = false; });
                setCollapsed(newCollapsed);
            }},
            { divider: true, id: 'div1', label: '' },
            ...(canManageChannels ? [
                { id: 'edit', label: 'Edit Category', icon: Settings, onClick: () => {
                    const newName = prompt('Rename category:', category.name);
                    if (newName && newName.trim() && newName.trim() !== category.name) {
                        api.channels.update(category.id, { name: newName.trim() }).then(() => {
                            if (guildSession.enabled) {
                                guildSession.refresh();
                            } else if (activeGuildId) {
                                api.channels.getGuildChannels(activeGuildId).then((chs) => setLegacyGuildChannels(chs as any)).catch(() => {});
                            }
                            addToast({ title: 'Category renamed', variant: 'success' });
                        }).catch(() => addToast({ title: 'Failed to rename category', variant: 'error' }));
                    }
                }},
            ] : []),
            { id: 'copy-id', label: 'Copy Category ID', icon: Copy, onClick: () => { copyToClipboard(category.id); addToast({ title: 'Category ID copied', variant: 'info' }); } },
            ...(canManageChannels ? [
                { divider: true, id: 'div2', label: '' },
                { id: 'delete', label: 'Delete Category', icon: Trash2, color: 'var(--error)', onClick: () => {
                    if (!confirm(`Delete category "${category.name}"? Channels inside will become uncategorized.`)) return;
                    api.channels.delete(category.id).then(() => {
                        if (guildSession.enabled) {
                            guildSession.refresh();
                        } else if (activeGuildId) {
                            api.channels.getGuildChannels(activeGuildId).then((chs) => setLegacyGuildChannels(chs as any)).catch(() => {});
                        }
                        addToast({ title: `Category "${category.name}" deleted`, variant: 'error' });
                    }).catch(() => addToast({ title: 'Failed to delete category', variant: 'error' }));
                }},
            ] : []),
        ]);
    };

    const handleChannelContext = (e: React.MouseEvent, channel: { id: string; name: string }) => {
        const isFav = favoriteChannelIds.has(channel.id);
        openMenu(e, [
            { id: 'mark-read', label: 'Mark as Read', icon: Circle, onClick: () => {
                api.messages.ack(channel.id).catch(() => { addToast({ title: 'Failed to mark channel as read', variant: 'error' }); });
                markReadStore(channel.id);
                addToast({ title: 'Channel Marked as Read', variant: 'info' });
            }},
            { id: 'favorite', label: isFav ? 'Remove from Favorites' : 'Add to Favorites', icon: Star, onClick: () => {
                if (isFav) {
                    setFavoriteChannelIds(prev => { const next = new Set(prev); next.delete(channel.id); return next; });
                    api.users.removeFavorite(channel.id).catch(() => { addToast({ title: 'Failed to update favorites', variant: 'error' }); });
                    addToast({ title: `Removed #${channel.name} from favorites`, variant: 'info' });
                } else {
                    setFavoriteChannelIds(prev => new Set(prev).add(channel.id));
                    api.users.addFavorite(channel.id).catch(() => { addToast({ title: 'Failed to update favorites', variant: 'error' }); });
                    addToast({ title: `Added #${channel.name} to favorites`, variant: 'success' });
                }
            }},
            { id: 'mute', label: 'Mute Channel', icon: Volume1, onClick: () => {
                api.channels.setNotificationPrefs(channel.id, { level: 'none' }).then(() => {
                    addToast({ title: 'Channel Muted', variant: 'info' });
                }).catch(() => addToast({ title: 'Failed to mute channel', variant: 'error' }));
            }},
            { divider: true, id: 'div1', label: '' },
            { id: 'edit', label: 'Edit Channel', icon: Settings, onClick: () => {
                api.channels.get(channel.id).then((ch: any) => {
                    setChannelSettingsOpen({ id: channel.id, name: ch.name, topic: ch.topic || '', rateLimitPerUser: ch.rateLimitPerUser || 0, isNsfw: ch.isNsfw || false, channelType: ch.type, userLimit: ch.userLimit || 0 });
                }).catch(() => setChannelSettingsOpen({ id: channel.id, name: channel.name }));
            }},
            { id: 'split-view', label: 'Open in Split View', icon: Columns, onClick: () => {
                if (activeGuildId) {
                    const key = 'gratonite-split-view';
                    const state = { enabled: true, rightChannelId: channel.id, rightGuildId: activeGuildId, dividerPosition: 50 };
                    localStorage.setItem(key, JSON.stringify(state));
                    addToast({ title: `#${channel.name} opened in split view`, variant: 'info' });
                    // Force re-render by navigating
                    window.dispatchEvent(new CustomEvent('split-view-update'));
                }
            }},
            { id: 'duplicate', label: 'Duplicate Channel', icon: Copy, onClick: () => handleDuplicateChannel(channel.id, channel.name) },
            { id: 'permissions', label: 'Channel Permissions', icon: ShieldIcon, onClick: () => {
                api.channels.get(channel.id).then((ch: any) => {
                    setChannelSettingsOpen({ id: channel.id, name: ch.name, topic: ch.topic || '', rateLimitPerUser: ch.rateLimitPerUser || 0, isNsfw: ch.isNsfw || false, channelType: ch.type, userLimit: ch.userLimit || 0 });
                }).catch(() => setChannelSettingsOpen({ id: channel.id, name: channel.name }));
            }},
            { divider: true, id: 'div2', label: '' },
            { id: 'copy-link', label: 'Copy Channel Link', icon: Link2, onClick: () => {
                const link = `${window.location.origin}/app/guild/${activeGuildId}/channel/${channel.id}`;
                copyToClipboard(link);
                addToast({ title: 'Channel link copied', variant: 'info' });
            }},
            { id: 'copy-id', label: 'Copy Channel ID', icon: Copy, onClick: () => { copyToClipboard(channel.id); addToast({ title: 'Channel ID copied', variant: 'info' }); } },
            { id: 'invite', label: 'Create Invite Link', icon: Link2, onClick: () => {
                if (!activeGuildId) return;
                api.invites.create(activeGuildId, {}).then((invite) => {
                    const link = `${window.location.origin}/app/invite/${invite.code}`;
                    copyToClipboard(link);
                    addToast({ title: 'Invite link copied to clipboard', variant: 'success' });
                }).catch(() => addToast({ title: 'Failed to create invite', variant: 'error' }));
            }},
            { id: 'private', label: 'Make Private', icon: Lock, onClick: () => {
                if (!activeGuildId) return;
                api.guilds.getRoles(activeGuildId).then((roles: any[]) => {
                    const everyoneRole = roles.find((r: any) => r.name === '@everyone' || r.position === 0);
                    if (!everyoneRole) { addToast({ title: 'Could not find @everyone role', variant: 'error' }); return; }
                    api.channels.setPermissionOverride(channel.id, everyoneRole.id, { targetType: 'role', allow: '0', deny: '256' })
                      .then(() => addToast({ title: `#${channel.name} is now private`, description: 'Only selected roles can view this channel.', variant: 'success' }))
                      .catch(() => addToast({ title: 'Failed to make channel private', variant: 'error' }));
                }).catch(() => addToast({ title: 'Failed to make channel private', variant: 'error' }));
            }},
            { id: 'settings', label: 'Notification Settings', icon: Bell, onClick: () => setNotifPrefs({ type: 'channel', id: channel.id, name: channel.name }) },
            { divider: true, id: 'div3', label: '' },
            { id: 'delete', label: 'Delete Channel', icon: Trash2, color: 'var(--error)', onClick: () => {
                api.channels.delete(channel.id).then(() => {
                    setGuildChannels((prev: any[]) => prev.filter((c: any) => c.id !== channel.id));
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
        '/admin', '/help-center', '/message-requests',
        '/me', '/saved-messages', '/read-later',
        '/friend-activity', '/daily-challenges', '/inbox',
        '/activity', '/leaderboard', '/schedule-calendar',
        '/gacha', '/trading', '/bot-store', '/bot-builder',
        '/theme-builder', '/badges', '/saved', '/download',
    ].some(path => location.pathname.startsWith(path));

    const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
    const [presence, setPresenceState] = useState<PresenceType>('online');
    const setPresence = useCallback((p: PresenceType) => {
        setPresenceState(p);
        setSocketPresence(p);
    }, []);
    const { user: sidebarUser } = useUser();
    useEffect(() => {
        if (sidebarUser.status && sidebarUser.status !== 'online') {
            setPresenceState(sidebarUser.status as PresenceType);
        }
    }, [sidebarUser.status]);
    const [customStatus, setCustomStatus] = useState<string | null>(null);
    const [micMuted, setMicMuted] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
        try {
            const key = activeGuildId ? `collapsed-categories-${activeGuildId}` : 'gratonite-sidebar-collapsed';
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    // Reload collapsed state when active guild changes
    useEffect(() => {
        try {
            const key = activeGuildId ? `collapsed-categories-${activeGuildId}` : 'gratonite-sidebar-collapsed';
            const saved = localStorage.getItem(key);
            setCollapsed(saved ? JSON.parse(saved) : {});
        } catch {
            setCollapsed({});
        }
    }, [activeGuildId]);

    useEffect(() => {
        const key = activeGuildId ? `collapsed-categories-${activeGuildId}` : 'gratonite-sidebar-collapsed';
        localStorage.setItem(key, JSON.stringify(collapsed));
    }, [collapsed, activeGuildId]);

    const toggleCategory = (cat: string) => {
        const isCollapsing = !collapsed[cat];
        setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));

        // Animate children container
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) return;
        requestAnimationFrame(() => {
            const container = document.querySelector(`[data-category-children="${cat}"]`);
            if (!container) return;
            if (!isCollapsing) {
                // Expanding: animate children in with stagger
                const items = container.children;
                if (items.length) {
                    gsap.from(items, { y: -8, opacity: 0, stagger: 0.03, duration: 0.25, ease: 'power2.out' });
                }
            }
        });
    };

    // ── Sidebar customization ──
    const SIDEBAR_LAYOUT_KEY = 'gratonite-sidebar-layout';
    type SidebarSection = 'nav' | 'dm' | 'voice';
    const [sidebarLayout, setSidebarLayout] = useState<{ order: SidebarSection[]; hidden: SidebarSection[] }>(() => {
        try {
            const saved = localStorage.getItem(SIDEBAR_LAYOUT_KEY);
            return saved ? JSON.parse(saved) : { order: ['nav', 'dm', 'voice'], hidden: [] };
        } catch { return { order: ['nav', 'dm', 'voice'], hidden: [] }; }
    });
    const [showSidebarCustomize, setShowSidebarCustomize] = useState(false);
    const toggleSidebarSection = (section: SidebarSection) => {
        setSidebarLayout(prev => {
            const isHidden = prev.hidden.includes(section);
            const newHidden = isHidden ? prev.hidden.filter(s => s !== section) : [...prev.hidden, section];
            const newLayout = { ...prev, hidden: newHidden };
            localStorage.setItem(SIDEBAR_LAYOUT_KEY, JSON.stringify(newLayout));
            return newLayout;
        });
    };
    const moveSidebarSection = (section: SidebarSection, direction: 'up' | 'down') => {
        setSidebarLayout(prev => {
            const order = [...prev.order];
            const idx = order.indexOf(section);
            if (idx < 0) return prev;
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= order.length) return prev;
            [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
            const newLayout = { ...prev, order };
            localStorage.setItem(SIDEBAR_LAYOUT_KEY, JSON.stringify(newLayout));
            return newLayout;
        });
    };

    // ── Drag-and-drop channel reorder state ──
    const [dragChannelId, setDragChannelId] = useState<string | null>(null);
    const [dragOverChannelId, setDragOverChannelId] = useState<string | null>(null);
    const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);

    const handleChannelDragStart = useCallback((e: React.DragEvent, channelId: string) => {
        if (!canManageChannels) { e.preventDefault(); return; }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', channelId);
        setDragChannelId(channelId);
    }, [canManageChannels]);

    const handleChannelDragOver = useCallback((e: React.DragEvent, targetChannelId: string) => {
        if (!canManageChannels || !dragChannelId || targetChannelId === dragChannelId) return;
        // Check if dragging across categories — show not-allowed cursor
        const draggedChannel = guildChannels.find(c => c.id === dragChannelId);
        const targetChannel = guildChannels.find(c => c.id === targetChannelId);
        if (draggedChannel && targetChannel && draggedChannel.parentId !== targetChannel.parentId) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'none';
            (e.currentTarget as HTMLElement).style.cursor = 'not-allowed';
            setDragOverChannelId(null);
            setDragOverPosition(null);
            return;
        }
        (e.currentTarget as HTMLElement).style.cursor = '';
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        setDragOverChannelId(targetChannelId);
        setDragOverPosition(e.clientY < midY ? 'above' : 'below');
    }, [canManageChannels, dragChannelId, guildChannels]);

    const handleChannelDragLeave = useCallback(() => {
        setDragOverChannelId(null);
        setDragOverPosition(null);
    }, []);

    const handleChannelDragEnd = useCallback(() => {
        setDragChannelId(null);
        setDragOverChannelId(null);
        setDragOverPosition(null);
    }, []);

    const handleChannelDrop = useCallback(async (e: React.DragEvent, targetChannelId: string) => {
        e.preventDefault();
        if (!canManageChannels || !activeGuildId || !dragChannelId || dragChannelId === targetChannelId) {
            handleChannelDragEnd();
            return;
        }

        const draggedChannel = guildChannels.find(c => c.id === dragChannelId);
        const targetChannel = guildChannels.find(c => c.id === targetChannelId);
        if (!draggedChannel || !targetChannel) { handleChannelDragEnd(); return; }

        // Only allow reorder within the same parent category
        if (draggedChannel.parentId !== targetChannel.parentId) { handleChannelDragEnd(); addToast({ title: 'Cannot move channels between categories', variant: 'error' }); return; }

        // Build the sibling list (same parentId, excluding categories)
        const isCategoryType = (type: string) => type === 'category' || type === 'GUILD_CATEGORY';
        const siblings = guildChannels
            .filter(c => !isCategoryType(c.type) && c.parentId === draggedChannel.parentId)
            .sort((a, b) => a.position - b.position);

        // Remove dragged from list, then insert at target position
        const withoutDragged = siblings.filter(c => c.id !== dragChannelId);
        const targetIdx = withoutDragged.findIndex(c => c.id === targetChannelId);
        if (targetIdx === -1) { handleChannelDragEnd(); return; }

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertIdx = e.clientY < midY ? targetIdx : targetIdx + 1;
        withoutDragged.splice(insertIdx, 0, draggedChannel);

        // Build position update payload
        const positionUpdates = withoutDragged.map((c, idx) => ({
            id: c.id,
            position: idx,
            parentId: c.parentId,
        }));

        // Optimistically update local state
        setGuildChannels((prev: any[]) => {
            const next = [...prev];
            for (const upd of positionUpdates) {
                const ch = next.find((c: any) => c.id === upd.id);
                if (ch) ch.position = upd.position;
            }
            return next;
        });

        handleChannelDragEnd();

        // Persist to backend
        try {
            await api.channels.updatePositions(activeGuildId, positionUpdates);
        } catch {
            // Revert on failure — refetch channels
            addToast({ title: 'Failed to reorder channels', variant: 'error' });
            if (guildSession.enabled) {
                guildSession.refresh();
            } else {
                api.channels.getGuildChannels(activeGuildId).then((chs) => setLegacyGuildChannels(chs as any)).catch(() => {});
            }
        }
    }, [canManageChannels, activeGuildId, dragChannelId, guildChannels, setGuildChannels, handleChannelDragEnd, guildSession, addToast]);

    // Listen for CHANNEL_POSITIONS_UPDATE socket event from other clients
    useEffect(() => {
        const socket = getSocket();
        if (!socket || !activeGuildId) return;
        const handler = (data: { guildId: string; updates: Array<{ id: string; position: number; parentId?: string | null }> }) => {
            if (data.guildId !== activeGuildId) return;
            setGuildChannels((prev: any[]) => {
                const next = [...prev];
                for (const upd of data.updates) {
                    const ch = next.find((c: any) => c.id === upd.id);
                    if (ch) {
                        ch.position = upd.position;
                        if (upd.parentId !== undefined) ch.parentId = upd.parentId;
                    }
                }
                return next;
            });
        };
        socket.on('CHANNEL_POSITIONS_UPDATE', handler);
        return () => { socket.off('CHANNEL_POSITIONS_UPDATE', handler); };
    }, [activeGuildId, setGuildChannels]);

    const userAvatarUrl = userProfile.avatarHash ? `${API_BASE}/files/${userProfile.avatarHash}` : null;

    const UserPanel = () => (
        <div className="user-panel">
            <span data-presence-toggle style={{ display: 'contents' }}>
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
            </span>
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
                    aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
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
                <button
                    type="button"
                    aria-label="What's New"
                    title="What's New"
                    onClick={onOpenWhatsNew}
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
                    <Zap size={18} />
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
                    // Clear token from both in-memory state and localStorage
                    setAccessToken(null);
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
            <nav className={`channel-sidebar glass-panel ${isOpen ? 'open' : ''}`} aria-label="App navigation">
                {/* Sidebar Customize Button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px 0' }}>
                    <button
                        onClick={() => setShowSidebarCustomize(!showSidebarCustomize)}
                        style={{
                            background: showSidebarCustomize ? 'var(--bg-tertiary)' : 'transparent',
                            border: 'none', borderRadius: '6px', padding: '4px 8px',
                            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px',
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                            transition: 'all 0.15s',
                        }}
                        title="Customize sidebar"
                    >
                        <Settings size={12} /> Customize
                    </button>
                </div>
                {showSidebarCustomize && (
                    <div style={{
                        margin: '8px 12px', padding: '12px', background: 'var(--bg-tertiary)',
                        borderRadius: '8px', border: '1px solid var(--stroke)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sidebar Sections</div>
                            <button
                                onClick={() => {
                                    const defaultLayout = { order: ['nav' as SidebarSection, 'dm' as SidebarSection, 'voice' as SidebarSection], hidden: [] as SidebarSection[] };
                                    setSidebarLayout(defaultLayout);
                                    localStorage.setItem(SIDEBAR_LAYOUT_KEY, JSON.stringify(defaultLayout));
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '11px', padding: 0, fontWeight: 500 }}
                            >
                                Reset to default
                            </button>
                        </div>
                        {sidebarLayout.order.map((section, idx) => {
                            const labels: Record<string, string> = { nav: 'Navigation', dm: 'Direct Messages', voice: 'Voice' };
                            const isHidden = sidebarLayout.hidden.includes(section);
                            return (
                                <div key={section} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', borderRadius: '6px', transition: 'background 0.15s' }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <span style={{ color: 'var(--text-muted)', fontSize: '14px', cursor: 'grab', userSelect: 'none', lineHeight: 1, padding: '2px' }} title="Drag to reorder">{'\u2807'}</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <button onClick={() => moveSidebarSection(section, 'up')} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? 'var(--stroke)' : 'var(--text-muted)', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.5 : 1, padding: '6px 8px', lineHeight: 1, fontSize: '16px', borderRadius: '4px', transition: 'color 0.15s, background 0.15s', minWidth: '28px', minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onMouseEnter={(e) => { if (idx !== 0) (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >&#9650;</button>
                                        <button onClick={() => moveSidebarSection(section, 'down')} disabled={idx === sidebarLayout.order.length - 1} style={{ background: 'none', border: 'none', color: idx === sidebarLayout.order.length - 1 ? 'var(--stroke)' : 'var(--text-muted)', cursor: idx === sidebarLayout.order.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === sidebarLayout.order.length - 1 ? 0.5 : 1, padding: '6px 8px', lineHeight: 1, fontSize: '16px', borderRadius: '4px', transition: 'color 0.15s, background 0.15s', minWidth: '28px', minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onMouseEnter={(e) => { if (idx !== sidebarLayout.order.length - 1) (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >&#9660;</button>
                                    </div>
                                    <span style={{ flex: 1, fontSize: '13px', color: isHidden ? 'var(--text-muted)' : 'var(--text-primary)', fontWeight: 500, opacity: isHidden ? 0.5 : 1 }}>{labels[section]}</span>
                                    <button
                                        onClick={() => toggleSidebarSection(section as SidebarSection)}
                                        style={{
                                            background: isHidden ? 'var(--bg-elevated)' : 'var(--accent-primary)',
                                            border: '1px solid var(--stroke)', borderRadius: '4px',
                                            width: '20px', height: '20px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: isHidden ? 'var(--text-muted)' : 'white', fontSize: '12px',
                                        }}
                                        title={isHidden ? 'Show section' : 'Hide section'}
                                    >
                                        {isHidden ? '' : '\u2713'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
                {/* Order-driven sidebar section rendering */}
                {sidebarLayout.order.map((section, sectionIdx) => {
                    if (sidebarLayout.hidden.includes(section)) return null;
                    switch (section) {
                        case 'nav':
                            return (
                <div key="nav" className="channel-list" style={{ paddingTop: sectionIdx === 0 && !showSidebarCustomize ? '16px' : '0' }} onClick={(e) => { if ((e.target as HTMLElement).closest('.channel-item')) playSound('click'); }}>
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
                    <Link to="/friend-activity" style={{ textDecoration: 'none' }}>
                        <div className={`channel-item ${location.pathname === '/friend-activity' ? 'active' : ''}`}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Activity size={18} />
                            </div>
                            <span style={{ fontSize: '15px' }}>Activity</span>
                        </div>
                    </Link>
                    <Link to="/daily-challenges" style={{ textDecoration: 'none' }}>
                        <div className={`channel-item ${location.pathname === '/daily-challenges' ? 'active' : ''}`}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Zap size={18} />
                            </div>
                            <span style={{ fontSize: '15px' }}>Challenges</span>
                        </div>
                    </Link>
                    <Link to="/read-later" style={{ textDecoration: 'none' }}>
                        <div className={`channel-item ${location.pathname === '/read-later' ? 'active' : ''}`}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Star size={18} />
                            </div>
                            <span style={{ fontSize: '15px' }}>Saved Messages</span>
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
                            );
                        case 'dm':
                            return (
                <div key="dm" className="channel-list" style={{ marginTop: '16px' }} role="listbox" aria-label="Direct Messages" onKeyDown={(e) => {
                    const container = e.currentTarget;
                    const items = Array.from(container.querySelectorAll<HTMLElement>('.channel-item[tabindex], .channel-item a'));
                    const focused = document.activeElement as HTMLElement;
                    const idx = items.indexOf(focused);
                    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
                    else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); items[idx].click(); }
                    else if (e.key === 'Escape') { focused?.blur(); }
                }}>
                    <div className="channel-category" onClick={() => toggleCategory('dm')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ transition: 'transform 0.15s ease', transform: collapsed['dm'] ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex' }}><ChevronDown size={14} /></span> <span>Direct Messages</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Users size={14} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} aria-label="New Group DM" onClick={(e) => { e.stopPropagation(); onOpenCreateGroupDm(); }} />
                            <Plus size={14} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onOpenDMSearch(); }} />
                        </div>
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
                                    const isGroupDm = dm.isGroup || dm.type === 'GROUP_DM';
                                    if (isGroupDm) {
                                        const groupLabel = dm.groupName || 'Group DM';
                                        const memberCount = dm.participants?.length || 0;
                                        return (
                                            <Link key={dm.id} to={`/dm/${dm.id}`} style={{ textDecoration: 'none' }}
                                                onMouseEnter={() => {
                                                    const timer = setTimeout(() => {
                                                        queryClient.prefetchQuery({
                                                            queryKey: messagesQueryKey(dm.id),
                                                            queryFn: () => api.messages.list(dm.id, { limit: 50 }),
                                                            staleTime: 30_000,
                                                        });
                                                    }, 200);
                                                    prefetchTimers.current.set(dm.id, timer);
                                                }}
                                                onMouseLeave={() => {
                                                    const timer = prefetchTimers.current.get(dm.id);
                                                    if (timer) { clearTimeout(timer); prefetchTimers.current.delete(dm.id); }
                                                }}
                                                onContextMenu={(e) => {
                                                e.preventDefault();
                                                openMenu(e, [
                                                    { id: 'mark-read', label: 'Mark as Read', icon: Check, onClick: () => { api.messages.ack(dm.id).catch(() => {}); markReadStore(dm.id); addToast({ title: 'Marked as read', variant: 'info' }); }},
                                                    { id: 'mute', label: 'Mute Conversation', icon: Volume1, onClick: () => { api.channels.setNotificationPrefs(dm.id, { level: 'none' }).then(() => addToast({ title: 'Conversation muted', variant: 'info' })).catch(() => addToast({ title: 'Failed to mute', variant: 'error' })); }},
                                                    { divider: true, id: 'div1', label: '' },
                                                    { id: 'copy-id', label: 'Copy Channel ID', icon: Copy, onClick: () => { copyToClipboard(dm.id); addToast({ title: 'Channel ID copied', variant: 'info' }); }},
                                                    { id: 'close', label: 'Close DM', icon: X, color: 'var(--error)', onClick: () => { setDmChannels(prev => prev.filter((d: any) => d.id !== dm.id)); addToast({ title: 'Conversation closed', variant: 'info' }); }},
                                                ]);
                                            }}>
                                                {(() => {
                                                    const gdmActive = location.pathname === `/dm/${dm.id}`;
                                                    const gdmUn = unreadMap.get(dm.id);
                                                    const gdmHasUnread = !!gdmUn?.hasUnread && !gdmActive;
                                                    const gdmMentions = gdmUn?.mentionCount ?? 0;
                                                    return (
                                                <div className={`channel-item ${gdmActive ? 'active' : ''}`} style={{ justifyContent: 'space-between' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <Users size={16} color="var(--bg-app)" />
                                                        </div>
                                                        <div style={{ overflow: 'hidden', flex: 1 }}>
                                                            <span style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', fontWeight: gdmHasUnread ? 600 : undefined, color: gdmHasUnread ? 'var(--text-primary)' : undefined }}>{groupLabel}</span>
                                                            {memberCount > 0 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{memberCount} members</span>}
                                                        </div>
                                                    </div>
                                                    {gdmMentions > 0 && !gdmActive && (
                                                        <span style={{ background: 'var(--error, #ed4245)', color: 'white', borderRadius: '999px', padding: '0 5px', fontSize: '11px', minWidth: '16px', textAlign: 'center', fontWeight: 700, lineHeight: '16px', flexShrink: 0 }}>{gdmMentions}</span>
                                                    )}
                                                    {gdmHasUnread && gdmMentions === 0 && (
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                                                    )}
                                                </div>
                                                    );
                                                })()}
                                            </Link>
                                        );
                                    }
                                    const recipient = dm.otherUser || dm.recipients?.[0];
                                    const displayName = recipient?.displayName || recipient?.username || 'Unknown';
                                    return (
                                        <Link key={dm.id} to={`/dm/${dm.id}`} style={{ textDecoration: 'none' }}
                                            onMouseEnter={() => {
                                                const timer = setTimeout(() => {
                                                    queryClient.prefetchQuery({
                                                        queryKey: messagesQueryKey(dm.id),
                                                        queryFn: () => api.messages.list(dm.id, { limit: 50 }),
                                                        staleTime: 30_000,
                                                    });
                                                }, 200);
                                                prefetchTimers.current.set(dm.id, timer);
                                            }}
                                            onMouseLeave={() => {
                                                const timer = prefetchTimers.current.get(dm.id);
                                                if (timer) { clearTimeout(timer); prefetchTimers.current.delete(dm.id); }
                                            }}
                                            onContextMenu={(e) => {
                                            e.preventDefault();
                                            openMenu(e, [
                                                { id: 'mark-read', label: 'Mark as Read', icon: Check, onClick: () => { api.messages.ack(dm.id).catch(() => {}); markReadStore(dm.id); addToast({ title: 'Marked as read', variant: 'info' }); }},
                                                { id: 'mute', label: 'Mute Conversation', icon: Volume1, onClick: () => { api.channels.setNotificationPrefs(dm.id, { level: 'none' }).then(() => addToast({ title: 'Conversation muted', variant: 'info' })).catch(() => addToast({ title: 'Failed to mute', variant: 'error' })); }},
                                                { divider: true, id: 'div1', label: '' },
                                                { id: 'copy-id', label: 'Copy Channel ID', icon: Copy, onClick: () => { copyToClipboard(dm.id); addToast({ title: 'Channel ID copied', variant: 'info' }); }},
                                                { id: 'close', label: 'Close DM', icon: X, color: 'var(--error)', onClick: () => { setDmChannels(prev => prev.filter((d: any) => d.id !== dm.id)); addToast({ title: 'Conversation closed', variant: 'info' }); }},
                                            ]);
                                        }}>
                                            {(() => {
                                                const dmActive = location.pathname === `/dm/${dm.id}`;
                                                const dmUn = unreadMap.get(dm.id);
                                                const dmUnreadFlag = !!dmUn?.hasUnread && !dmActive;
                                                const dmMentionCount = dmUn?.mentionCount ?? 0;
                                                return (
                                            <div className={`channel-item ${dmActive ? 'active' : ''}`} style={{ justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                                        <Avatar
                                                            userId={recipient?.id || dm.id}
                                                            avatarHash={recipient?.avatarHash}
                                                            displayName={displayName}
                                                            size={32}
                                                        />
                                                        {(() => {
                                                            const status = dmPresenceMap[recipient?.id];
                                                            if (!status || status === 'offline' || status === 'invisible') return null;
                                                            const color = status === 'online' ? '#23a55a' : status === 'idle' ? '#f0b232' : status === 'dnd' ? '#f23f43' : '#23a55a';
                                                            return (
                                                                <div style={{
                                                                    position: 'absolute', bottom: '-1px', right: '-1px',
                                                                    width: '12px', height: '12px', borderRadius: '50%',
                                                                    background: color,
                                                                    border: '2.5px solid var(--bg-secondary)',
                                                                }} title={status} />
                                                            );
                                                        })()}
                                                    </div>
                                                    <span style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: dmUnreadFlag ? 600 : undefined, color: dmUnreadFlag ? 'var(--text-primary)' : undefined }}>{displayName}</span>
                                                </div>
                                                {dmMentionCount > 0 && !dmActive && (
                                                    <span style={{ background: 'var(--error, #ed4245)', color: 'white', borderRadius: '999px', padding: '0 5px', fontSize: '11px', minWidth: '16px', textAlign: 'center', fontWeight: 700, lineHeight: '16px', flexShrink: 0 }}>{dmMentionCount}</span>
                                                )}
                                                {dmUnreadFlag && dmMentionCount === 0 && (
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
                                                )}
                                            </div>
                                                );
                                            })()}
                                        </Link>
                                    );
                                })
                            )}
                        </>
                    )}
                </div>
                            );
                        case 'voice':
                            return null; // Voice section placeholder — no standalone voice section in DM sidebar yet
                        default:
                            return null;
                    }
                })}

                <UserPanel />
            </nav>
        );
    }

    return (
        <nav ref={sidebarRef} className={`channel-sidebar glass-panel ${isOpen ? 'open' : ''}`} aria-label="Channel navigation" style={{ width: `${sidebarWidth}px` }}>
            {/* Resize handle */}
            <div
                className="sidebar-resize-handle"
                onMouseDown={(e) => { e.preventDefault(); resizingRef.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }}
                title="Drag to resize sidebar"
            />
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

            <div className="channel-list" role="listbox" aria-label="Channels" onKeyDown={(e) => {
                const container = e.currentTarget;
                const items = Array.from(container.querySelectorAll<HTMLElement>('.channel-item[tabindex]'));
                const focused = document.activeElement as HTMLElement;
                const idx = items.indexOf(focused);
                if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); }
                else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
                else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
                else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); items[idx].click(); }
                else if (e.key === 'Escape') { focused?.blur(); }
            }}>
                <div
                    className={`channel-item ${location.pathname.includes('/events') ? 'active' : ''}`}
                    role="option"
                    aria-selected={location.pathname.includes('/events')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 8px' }}
                    onClick={() => navigate(`/guild/${activeGuildId}/events`)}
                >
                    <Calendar size={18} style={{ opacity: 0.7 }} />
                    <span>Events</span>
                </div>
                <div
                    className={`channel-item ${location.pathname.includes('/members') ? 'active' : ''}`}
                    role="option"
                    aria-selected={location.pathname.includes('/members')}
                    tabIndex={0}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 8px' }}
                    onClick={() => navigate(`/guild/${activeGuildId}/members`)}
                >
                    <Users size={18} style={{ opacity: 0.7 }} />
                    <span>Members</span>
                </div>
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

                        // Drag-and-drop indicator styles
                        const isDragging = dragChannelId === ch.id;
                        const isDropTarget = dragOverChannelId === ch.id && dragChannelId !== ch.id;
                        const dropIndicatorStyle: React.CSSProperties = isDropTarget ? {
                            [dragOverPosition === 'above' ? 'borderTop' : 'borderBottom']: '2px solid var(--accent-primary, #526df5)',
                        } : {};

                        // Common drag props for channel items
                        const dragProps = canManageChannels ? {
                            draggable: true,
                            onDragStart: (e: React.DragEvent) => handleChannelDragStart(e, ch.id),
                            onDragOver: (e: React.DragEvent) => handleChannelDragOver(e, ch.id),
                            onDragLeave: handleChannelDragLeave,
                            onDragEnd: handleChannelDragEnd,
                            onDrop: (e: React.DragEvent) => handleChannelDrop(e, ch.id),
                        } : {};

                        if (isVoice) {
                            // Voice channels: click joins voice, doesn't navigate away
                            return (
                                <div key={ch.id} onContextMenu={(e) => handleChannelContext(e, ch)} {...dragProps} style={{ opacity: isDragging ? 0.5 : undefined, ...dropIndicatorStyle }}>
                                    <div
                                        className={`channel-item ${isConnectedChannel ? 'active' : ''}`}
                                        tabIndex={0}
                                        role="option"
                                        aria-selected={isConnectedChannel}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: canManageChannels ? 'grab' : 'pointer' }}
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
                                            <div style={{ minWidth: 0 }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{ch.name}</span>
                                                {ch.topic && (
                                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', lineHeight: '14px', maxWidth: '140px' }}>{ch.topic}</span>
                                                )}
                                            </div>
                                        </div>
                                        {(voiceCount > 0 || ((ch as any).userLimit ?? 0) > 0) && (
                                            <span style={{
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                color: ((ch as any).userLimit ?? 0) > 0 && voiceCount >= ((ch as any).userLimit ?? 0) ? 'var(--error, #ed4245)' : isConnectedChannel ? '#43b581' : 'var(--text-muted)',
                                                background: isConnectedChannel ? 'rgba(67, 181, 129, 0.15)' : 'var(--bg-tertiary)',
                                                padding: '1px 6px',
                                                borderRadius: '8px', flexShrink: 0, lineHeight: '16px',
                                            }}>
                                                {((ch as any).userLimit ?? 0) > 0 ? `${voiceCount}/${(ch as any).userLimit}` : voiceCount}
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
                        const unreadEntry = unreadMap.get(ch.id);
                        const hasUnread = !!unreadEntry?.hasUnread && !isActive;
                        const mentions = unreadEntry?.mentionCount ?? 0;
                        const isMuted = mutedChannelIds.has(ch.id);
                        const isPrivate = ch.type === 'GUILD_PRIVATE';
                        return (
                            <div key={ch.id} {...dragProps} style={{ opacity: isDragging ? 0.5 : undefined, ...dropIndicatorStyle }}>
                                <Link to={linkTo} style={{ textDecoration: 'none' }} draggable={false} onContextMenu={(e) => handleChannelContext(e, ch)}
                                    onMouseEnter={() => {
                                        const timer = setTimeout(() => {
                                            queryClient.prefetchQuery({
                                                queryKey: messagesQueryKey(ch.id),
                                                queryFn: () => api.messages.list(ch.id, { limit: 50 }),
                                                staleTime: 30_000,
                                            });
                                        }, 200);
                                        prefetchTimers.current.set(ch.id, timer);
                                    }}
                                    onMouseLeave={() => {
                                        const timer = prefetchTimers.current.get(ch.id);
                                        if (timer) { clearTimeout(timer); prefetchTimers.current.delete(ch.id); }
                                    }}>
                                    <div className={`channel-item ${isActive ? 'active' : ''}`} tabIndex={0} role="option" aria-selected={isActive} data-channel-type={ch.type === 'GUILD_DOCUMENT' ? 'document' : undefined} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: isMuted ? 0.5 : undefined, cursor: canManageChannels ? 'grab' : undefined, position: 'relative' }}>
                                        {hasUnread && mentions === 0 && (
                                            <span style={{
                                                position: 'absolute', left: '-4px', top: '50%', transform: 'translateY(-50%)',
                                                width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-primary)',
                                            }} />
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                            {ch.type === 'GUILD_DOCUMENT' ? <FileText size={18} style={{ flexShrink: 0, opacity: 0.7 }} /> : isPrivate ? <Lock size={18} style={{ flexShrink: 0, opacity: 0.7 }} /> : <HashIcon size={18} style={{ flexShrink: 0, opacity: 0.7 }} />}
                                            {ch.topic ? (
                                                <Tooltip content={ch.topic} position="right" delay={400}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasUnread ? 600 : undefined, color: hasUnread ? 'var(--text-primary)' : undefined }}>{ch.name}</span>
                                                </Tooltip>
                                            ) : (
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasUnread ? 600 : undefined, color: hasUnread ? 'var(--text-primary)' : undefined }}>{ch.name}</span>
                                            )}
                                            {draftChannelIds.has(ch.id) && <PenLine size={12} style={{ flexShrink: 0, opacity: 0.7, color: 'var(--accent-primary)' }} />}
                                            {isMuted && <BellOff size={12} style={{ flexShrink: 0, opacity: 0.5, color: 'var(--text-muted)' }} />}
                                        </div>
                                        {mentions > 0 && !isActive && (
                                            <span style={{ background: 'var(--error, #ed4245)', color: 'white', borderRadius: '999px', padding: '0 5px', fontSize: '11px', minWidth: '16px', textAlign: 'center', fontWeight: 700, lineHeight: '16px', flexShrink: 0 }}>
                                                {mentions}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                                {channelTyping.has(ch.id) && (
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', padding: '0 0 2px 30px', display: 'block' }}>
                                        {channelTyping.get(ch.id)!.join(', ')} typing...
                                    </span>
                                )}
                            </div>
                        );
                    };

                    if (guildChannels.length === 0) {
                        return (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                <p>No channels yet.</p>
                                {canManageChannels && (
                                <button
                                    onClick={() => { setShowCreateChannel({ type: 'text' }); setNewChannelName(''); }}
                                    style={{ marginTop: '8px', padding: '8px 16px', background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    Create a Channel
                                </button>
                                )}
                            </div>
                        );
                    }

                    // Separate uncategorized channels into text and voice
                    const uncatText = uncategorized.filter(c => !isVoiceChannelType(c.type) && c.type !== 'GUILD_DOCUMENT');
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
                        const isCatCollapsed = !!collapsed[cat.id];
                        // When collapsed, still show channels with unread messages or that are currently active
                        const visibleChildren = isCatCollapsed
                            ? children.filter(ch => {
                                const entry = unreadMap.get(ch.id);
                                const isActive = location.pathname.includes(`/channel/${ch.id}`) || location.pathname.includes(`/voice/${ch.id}`);
                                return isActive || !!(entry?.hasUnread);
                            })
                            : children;
                        return (
                            <div key={cat.id}>
                                <div className="channel-category" style={{ marginTop: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} onContextMenu={(e) => handleCategoryContext(e, cat, children.map(c => c.id))}>
                                    <div onClick={() => toggleCategory(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
                                        <span style={{ transition: 'transform 0.15s ease', transform: isCatCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex' }}>
                                            <ChevronDown size={14} />
                                        </span>
                                        {cat.name.toUpperCase()}
                                    </div>
                                    {canManageChannels && <Plus size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.7 }}
                                        onClick={(e) => { e.stopPropagation(); setShowCreateChannel({ type: defaultType, parentId: cat.id }); setNewChannelName(''); }}
                                    />}
                                </div>
                                <div data-category-children={cat.id}>
                                    {visibleChildren.map(renderChannel)}
                                </div>
                            </div>
                        );
                    };

                    const favoriteChannels = guildChannels.filter(c => favoriteChannelIds.has(c.id));

                    return (
                        <>
                            {/* ── FAVORITES ── */}
                            {favoriteChannels.length > 0 && (
                                <>
                                    <div
                                        style={sectionHeaderStyle}
                                        onClick={() => toggleCategory('__favorites__')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ transition: 'transform 0.15s ease', transform: collapsed['__favorites__'] ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex' }}><ChevronDown size={10} /></span>
                                            <Star size={10} style={{ color: '#faa61a' }} />
                                            <span>Favorites</span>
                                        </div>
                                    </div>
                                    {!collapsed['__favorites__'] && favoriteChannels.map(renderChannel)}
                                </>
                            )}

                            {/* ── RECENT CHANNELS (Item 89) ── */}
                            <RecentChannels guildId={activeGuildId!} onChannelClick={(chId, gId) => {
                                const ch = guildChannels.find(c => c.id === chId);
                                if (ch && isVoiceChannelType(ch.type)) {
                                    navigate(`/guild/${gId}/voice/${chId}`);
                                } else {
                                    navigate(`/guild/${gId}/channel/${chId}`);
                                }
                            }} />

                            {/* ── TEXT CHANNELS ── */}
                            <div
                                style={sectionHeaderStyle}
                                onClick={() => toggleCategory('__text_channels__')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ transition: 'transform 0.15s ease', transform: collapsed['__text_channels__'] ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex' }}><ChevronDown size={10} /></span>
                                    <span>Text Channels</span>
                                </div>
                                {canManageChannels && <Plus size={14} style={{ cursor: 'pointer', opacity: 0.7 }}
                                    onClick={(e) => { e.stopPropagation(); setShowCreateChannel({ type: 'text' }); setNewChannelName(''); }}
                                />}
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
                                    <span style={{ transition: 'transform 0.15s ease', transform: collapsed['__voice_channels__'] ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex' }}><ChevronDown size={10} /></span>
                                    <span>Voice Channels</span>
                                </div>
                                {canManageChannels && <Plus size={14} style={{ cursor: 'pointer', opacity: 0.7 }}
                                    onClick={(e) => { e.stopPropagation(); setShowCreateChannel({ type: 'voice' }); setNewChannelName(''); }}
                                />}
                            </div>
                            {!collapsed['__voice_channels__'] && (
                                <>
                                    {uncatVoice.map(renderChannel)}
                                    {voiceCategories.map(cat => renderCategory(cat, 'voice'))}
                                </>
                            )}

                            {/* ── DOCUMENT CHANNELS ── */}
                            {(() => {
                                const docChannels = guildChannels.filter((ch: any) => ch.type === 'GUILD_DOCUMENT');
                                if (docChannels.length === 0 && !canManageChannels) return null;
                                return (
                                    <>
                                        <div
                                            style={{ ...sectionHeaderStyle, marginTop: '12px' }}
                                            onClick={() => toggleCategory('__document_channels__')}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{ transition: 'transform 0.15s ease', transform: collapsed['__document_channels__'] ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex' }}><ChevronDown size={10} /></span>
                                                <span>Document Channels</span>
                                            </div>
                                            {canManageChannels && <Plus size={14} style={{ cursor: 'pointer', opacity: 0.7 }}
                                                onClick={(e) => { e.stopPropagation(); setShowCreateChannel({ type: 'document' }); setNewChannelName(''); }}
                                            />}
                                        </div>
                                        {!collapsed['__document_channels__'] && docChannels.map(renderChannel)}
                                    </>
                                );
                            })()}
                        </>
                    );
                })()}
            </div>

            {/* Create Channel Modal — portal to body to escape contain:paint */}
            {showCreateChannel && createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => { setShowCreateChannel(null); setNewChannelName(''); setSelectedTemplate(null); }}>
                <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: '95vw', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--stroke)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Create {showCreateChannel.type === 'voice' ? 'Voice' : showCreateChannel.type === 'document' ? 'Document' : 'Text'} Channel
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                        {showCreateChannel.type === 'document' ? 'Collaborative documents your team can edit together.' : showCreateChannel.type === 'voice' ? 'A voice channel for hanging out and talking.' : 'A text channel for messaging and sharing.'}
                    </div>

                    {!newChannelName && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Start from a template</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                {(showCreateChannel.type === 'text' ? [
                                    { name: 'rules', icon: '\u{1F4DC}', desc: 'Server rules & guidelines', topic: 'Read and follow the server rules', rateLimitPerUser: 0, isAnnouncement: true },
                                    { name: 'introductions', icon: '\u{1F44B}', desc: 'Introduce yourself', topic: 'Tell us about yourself!', rateLimitPerUser: 60 },
                                    { name: 'media-share', icon: '\u{1F3A8}', desc: 'Share art & media', topic: 'Share your favorite media' },
                                    { name: 'general', icon: '#', desc: 'General chat', topic: '' },
                                    { name: 'support', icon: '\u{2753}', desc: 'Help & support', topic: 'Ask for help here', rateLimitPerUser: 10 },
                                    { name: 'announcements', icon: '\u{1F4E2}', desc: 'News & updates', topic: 'Important announcements', isAnnouncement: true },
                                ] : showCreateChannel.type === 'document' ? [
                                    { name: 'rules-info', icon: '\u{00A7}', desc: 'Server rules & info', topic: 'Rules and important information' },
                                    { name: 'wiki', icon: '\u{2261}', desc: 'Knowledge base', topic: 'Server wiki & documentation' },
                                    { name: 'resources', icon: '\u{2192}', desc: 'Links & guides', topic: 'Shared resources, guides, and links' },
                                    { name: 'raid-guide', icon: '\u{2020}', desc: 'Strategy & guides', topic: 'Boss strategies, team comp, loot tables' },
                                ] : [
                                    { name: 'voice-lounge', icon: '\u{1F3A7}', desc: 'Casual hangout', topic: 'Hang out and chat' },
                                    { name: 'gaming', icon: '\u{1F3AE}', desc: 'Gaming voice chat', topic: 'Game together' },
                                    { name: 'music', icon: '\u{1F3B5}', desc: 'Listen together', topic: 'Music listening party' },
                                    { name: 'meeting', icon: '\u{1F4CB}', desc: 'Team meetings', topic: 'Meetings' },
                                ]).map(tmpl => (
                                    <button key={tmpl.name} onClick={() => { setNewChannelName(tmpl.name); setSelectedTemplate({ name: tmpl.name, topic: tmpl.topic, rateLimitPerUser: (tmpl as any).rateLimitPerUser, isAnnouncement: (tmpl as any).isAnnouncement }); }} style={{ padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '13px', transition: 'border-color 0.15s, background 0.15s' }} className="hover-border-accent-bg">
                                        <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>{tmpl.icon}</span>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{tmpl.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tmpl.desc}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '16px 0 12px' }} />
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Or enter a custom name</div>
                        </div>
                    )}
                    {selectedTemplate && newChannelName && (
                        <div style={{ marginBottom: '12px', padding: '8px 12px', background: 'rgba(88, 101, 242, 0.08)', borderRadius: '8px', border: '1px solid rgba(88, 101, 242, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 600 }}>Template: {selectedTemplate.name}{selectedTemplate.topic ? ` \u2022 "${selectedTemplate.topic}"` : ''}</span>
                            <button onClick={() => setSelectedTemplate(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px', display: 'flex' }}><X size={14} /></button>
                        </div>
                    )}

                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>Channel Name</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        {showCreateChannel.type === 'voice' ? <Mic size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : showCreateChannel.type === 'document' ? <FileText size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /> : <HashIcon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                        <input type="text" placeholder={showCreateChannel.type === 'voice' ? 'new-voice' : showCreateChannel.type === 'document' ? 'new-document' : 'new-channel'} value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChannel(); if (e.key === 'Escape') { setShowCreateChannel(null); setNewChannelName(''); setSelectedTemplate(null); } }} autoFocus style={{ flex: 1, background: 'var(--bg-app)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowCreateChannel(null); setNewChannelName(''); setSelectedTemplate(null); }} style={{ padding: '8px 20px', background: 'none', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                        <button onClick={handleCreateChannel} disabled={!newChannelName.trim()} style={{ padding: '8px 20px', background: newChannelName.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: newChannelName.trim() ? '#000' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '13px', cursor: newChannelName.trim() ? 'pointer' : 'default', fontWeight: 600 }}>Create Channel</button>
                    </div>
                </div>
                </div>,
                document.body
            )}
            <UserPanel />

            {/* Channel Settings Modal */}
            {channelSettingsOpen && activeGuildId && (
                <ChannelSettingsModal
                    channelId={channelSettingsOpen.id}
                    channelName={channelSettingsOpen.name}
                    channelTopic={channelSettingsOpen.topic}
                    channelType={channelSettingsOpen.channelType}
                    guildId={activeGuildId}
                    rateLimitPerUser={channelSettingsOpen.rateLimitPerUser}
                    isNsfw={channelSettingsOpen.isNsfw}
                    userLimit={channelSettingsOpen.userLimit}
                    onClose={() => setChannelSettingsOpen(null)}
                    onUpdate={(changes) => {
                        if (changes.name) {
                            setGuildChannels((prev: any[]) => prev.map((c: any) => c.id === channelSettingsOpen.id ? { ...c, name: changes.name! } : c));
                        }
                    }}
                />
            )}
            {notifPrefs && (
                <NotificationPrefsModal
                    type={notifPrefs.type}
                    id={notifPrefs.id}
                    name={notifPrefs.name}
                    onClose={() => setNotifPrefs(null)}
                />
            )}
        </nav>
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

const MembersSidebar = ({ onOpenProfile: _onOpenProfile, isMobileOpen, onCloseMobile }: { onOpenProfile: () => void; isMobileOpen?: boolean; onCloseMobile?: () => void }) => {
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
    const [banDuration, setBanDuration] = useState(0);
    const [banSubmitting, setBanSubmitting] = useState(false);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
        if (!guildId) return {};
        try {
            const saved = localStorage.getItem(`gratonite:member-collapsed:${guildId}`);
            return saved ? JSON.parse(saved) : {};
        } catch { return {}; }
    });
    const toggleCategory = (key: string) => {
        setCollapsed(prev => {
            const next = { ...prev, [key]: !prev[key] };
            if (guildId) localStorage.setItem(`gratonite:member-collapsed:${guildId}`, JSON.stringify(next));
            return next;
        });
    };

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
            await api.guilds.ban(guildId, banDialog.userId, banReason || undefined, banDuration || undefined);
            setMembers(prev => prev.filter(m => m.userId !== banDialog.userId));
            addToast({ title: 'User banned', description: `${banDialog.name} has been banned${banDuration ? ` for ${banDuration === 60 ? '1 hour' : banDuration === 1440 ? '24 hours' : banDuration === 10080 ? '7 days' : '30 days'}` : ' permanently'}.`, variant: 'success' });
            setBanDialog(null);
            setBanReason('');
            setBanDuration(0);
        } catch {
            addToast({ title: 'Failed to ban user', variant: 'error' });
        } finally {
            setBanSubmitting(false);
        }
    };

    const handleMemberContext = (e: React.MouseEvent, member: MemberWithPresence) => {
        const name = member.nickname || member.user?.displayName || member.user?.username || member.userId.slice(0, 8);
        openMenu(e, [
            { id: 'profile', label: 'View Profile', icon: User, onClick: () => handleMemberClick(member, e) },
            { id: 'dm', label: 'Send DM', icon: MessageSquare, onClick: () => {
                api.relationships.openDm(member.userId).then((dm: any) => navigate(`/dm/${dm.id}`)).catch(() => addToast({ title: 'Failed to open DM', variant: 'error' }));
            }},
            { divider: true, id: 'div-m1', label: '' },
            { id: 'mute', label: 'Mute User', icon: BellOff, onClick: () => {
                fetch(`${API_BASE}/users/@me/mutes`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetUserId: member.userId }),
                }).then(r => {
                    if (r.ok) addToast({ title: `${name} muted`, description: 'You won\'t receive notifications from this user.', variant: 'success' });
                    else addToast({ title: 'Already muted', variant: 'info' });
                }).catch(() => addToast({ title: 'Failed to mute user', variant: 'error' }));
            }},
            { id: 'copy-id', label: 'Copy User ID', icon: Copy, onClick: () => { copyToClipboard(member.userId); addToast({ title: 'Copied to clipboard', variant: 'info' }); }},
            ...(guildId ? [
                { divider: true, id: 'div-m2', label: '' },
                { id: 'kick', label: 'Kick Member', icon: ShieldAlert, color: '#FFA500', onClick: () => {
                    if (!confirm(`Kick ${name} from this server?`)) return;
                    api.guilds.kickMember(guildId, member.userId).then(() => addToast({ title: `${name} was kicked`, variant: 'success' })).catch(() => addToast({ title: 'Failed to kick member', variant: 'error' }));
                }},
                { id: 'ban', label: 'Ban Member', icon: Ban, color: '#ED4245', onClick: () => { setBanDialog({ userId: member.userId, name }); setBanReason(''); } },
            ] : []),
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
        <>
        {isMobileOpen && <div className={`members-sidebar-backdrop ${isMobileOpen ? 'visible' : ''}`} onClick={onCloseMobile} />}
        <aside className={`members-sidebar glass-panel ${isMobileOpen ? 'open' : ''}`} aria-label="Members">
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
                    {visibleCustomGroups.map(group => {
                        const groupKey = `__members_group_${group.id}__`;
                        return (
                            <div key={group.id}>
                                <div className="member-category" style={{ color: group.color || 'var(--text-muted)', cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => toggleCategory(groupKey)}>
                                    <span style={{ transition: 'transform 0.15s ease', transform: collapsed[groupKey] ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex' }}><ChevronDown size={10} /></span>
                                    {group.name} — {group.members.length}
                                </div>
                                {!collapsed[groupKey] && group.members.map(m => renderMemberRow(m, false))}
                            </div>
                        );
                    })}
                    {(activeFilter === 'all' || activeFilter === 'online') && onlineMembers.length > 0 && (
                        <div>
                            <div className="member-category" style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => toggleCategory('__members_online__')}>
                                <span style={{ transition: 'transform 0.15s ease', transform: collapsed['__members_online__'] ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex' }}><ChevronDown size={10} /></span>
                                Online — {onlineMembers.length}
                            </div>
                            {!collapsed['__members_online__'] && onlineMembers.map((m) => renderMemberRow(m, false))}
                        </div>
                    )}
                    {(activeFilter === 'all' || activeFilter === 'offline') && offlineMembers.length > 0 && (
                        <div>
                            <div className="member-category" style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => toggleCategory('__members_offline__')}>
                                <span style={{ transition: 'transform 0.15s ease', transform: collapsed['__members_offline__'] ? 'rotate(-90deg)' : 'rotate(0deg)', display: 'inline-flex' }}><ChevronDown size={10} /></span>
                                Offline — {offlineMembers.length}
                            </div>
                            {!collapsed['__members_offline__'] && offlineMembers.map((m) => renderMemberRow(m, true))}
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
                    zIndex: 1000,
                }} onClick={() => { setBanDialog(null); setBanReason(''); setBanDuration(0); }}>
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
                                    {banDuration ? 'This user will be temporarily banned.' : 'This user will be permanently banned from the server.'}
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

                        <div>
                            <label style={{
                                display: 'block', fontSize: '12px', textTransform: 'uppercase',
                                color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px',
                            }}>BAN DURATION</label>
                            <select
                                value={banDuration}
                                onChange={(e) => setBanDuration(Number(e.target.value))}
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                    color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            >
                                <option value={0}>Permanent</option>
                                <option value={60}>1 hour</option>
                                <option value={1440}>24 hours</option>
                                <option value={10080}>7 days</option>
                                <option value={43200}>30 days</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => { setBanDialog(null); setBanReason(''); setBanDuration(0); }}
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
                                    background: 'var(--error, #ED4245)', color: 'white',
                                    fontSize: '14px', fontWeight: 600, cursor: banSubmitting ? 'not-allowed' : 'pointer',
                                    opacity: banSubmitting ? 0.6 : 1,
                                }}
                            >{banSubmitting ? 'Banning...' : (banDuration ? 'Temp Ban' : 'Ban')}</button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
        </>
    );
};

// MainChat abstracted to src/pages/guilds/ChannelChat.tsx


export const AppLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isMobile = useIsMobile();
    const { splitState, closeSplitView, setDividerPosition } = useSplitView();
    const [bgMedia, setBgMediaRaw] = useState<{ url: string, type: MediaType } | null>(null);
    const tour = useShouldShowTour();

    // Play join/leave sounds globally for all voice channels
    useVoiceSounds();

    // Sync React Query caches with real-time socket events
    useQuerySocketSync();

    // Desktop-specific hooks (no-ops when not in Electron)
    useDesktopDeepLinks();
    useDesktopIdleDetection();
    useDesktopMenuNavigation();
    useDesktopNotifications();
    useGameActivity();

    // Voice context for keyboard shortcuts (mute/deafen)
    const voiceCtx = useVoice();

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
    const setBgMedia = useCallback((media: { url: string, type: MediaType } | null) => {
        setBgMediaRaw(media);
        if (media) {
            try {
                localStorage.setItem(channelBgKey, JSON.stringify(media));
            } catch {}
        } else {
            localStorage.removeItem(channelBgKey);
        }
    }, [channelBgKey]);
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [pendingExternalLink, setPendingExternalLink] = useState<string | null>(null);
    const [showWhatsNew, setShowWhatsNew] = useState(false);
    const [incomingCall, setIncomingCall] = useState<CallInvitePayload | null>(null);
    const [isGuildRailOpen, setIsGuildRailOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMemberDrawerOpen, setIsMemberDrawerOpen] = useState(false);
    const mainContentRef = useRef<HTMLDivElement>(null);
    const { user: ctxUser, loading: userLoading, gratoniteBalance, setGratoniteBalance } = useUser();
    const { setTheme, setColorMode, setFontFamily, setFontSize, setAccentColor, setButtonShape, setGlassMode, setHighContrast, setCompactMode, setReducedEffects, reducedEffects, screenReaderMode } = useTheme();
    const routeAnnouncerRef = useRef<HTMLDivElement>(null);
    const [guilds, setGuilds] = useState<Array<{ id: string; name: string; ownerId: string; iconHash: string | null; description: string | null; memberCount: number; boostTier?: number }>>([]);
    const [dmChannels, setDmChannels] = useState<Array<{ id: string; recipientIds?: string[]; recipients?: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }> }>>([]);
    const activeGuildId = useMemo(() => {
        const match = location.pathname.match(/\/guild\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    // Rules gate state (used by the Server Rules Gate overlay below)
    const [rulesAgreedGuilds, setRulesAgreedGuilds] = useState<Set<string>>(new Set());
    const [showRulesGate, setShowRulesGate] = useState(false);

    // Global keyboard navigation (Feature 15)
    useKeyboardNav({
        onEscape: () => {
            if (activeModal) setActiveModal(null);
        },
        onQuickSwitch: () => setActiveModal('globalSearch'),
        onToggleMute: () => voiceCtx.toggleMute?.(),
        onToggleDeafen: () => voiceCtx.toggleDeafen?.(),
        onGoToInbox: () => setActiveModal('notifications'),
    });

    // Per-guild theme override
    const defaultThemeRef = useRef<string | null>(null);
    useEffect(() => {
        if (activeGuildId) {
            const guildTheme = getGuildTheme(activeGuildId);
            if (guildTheme) {
                if (!defaultThemeRef.current) {
                    // Store the user's base theme before overriding
                    defaultThemeRef.current = document.documentElement.getAttribute('data-theme') || 'dark';
                }
                setTheme(guildTheme as AppTheme);
            }
        } else if (defaultThemeRef.current) {
            // Revert to base theme when leaving guild
            setTheme(defaultThemeRef.current as AppTheme);
            defaultThemeRef.current = null;
        }

        // Also listen for guild-theme-changed events (from settings UI)
        const handleGuildThemeChange = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail.guildId === activeGuildId) {
                if (detail.theme) {
                    if (!defaultThemeRef.current) {
                        defaultThemeRef.current = document.documentElement.getAttribute('data-theme') || 'dark';
                    }
                    setTheme(detail.theme as AppTheme);
                } else if (defaultThemeRef.current) {
                    setTheme(defaultThemeRef.current as AppTheme);
                    defaultThemeRef.current = null;
                }
            }
        };
        window.addEventListener('gratonite:guild-theme-changed', handleGuildThemeChange);
        return () => window.removeEventListener('gratonite:guild-theme-changed', handleGuildThemeChange);
    }, [activeGuildId, setTheme]);

    useEffect(() => {
        const handler = (e: Event) => {
            const url = (e as CustomEvent<string>).detail;
            if (url) setPendingExternalLink(url);
        };
        window.addEventListener('gratonite:external-link', handler);
        return () => window.removeEventListener('gratonite:external-link', handler);
    }, []);

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

    // Derive guildInfo for rules gate overlay
    const guildInfo = guildSession.enabled ? guildSession.guildInfo : null;

    // Show rules gate when entering a guild that requires rules agreement
    useEffect(() => {
        if (!activeGuildId || !guildInfo) { setShowRulesGate(false); return; }
        if ((guildInfo as any).requireRulesAgreement && (guildInfo as any).rulesText && !(guildInfo as any).agreedRulesAt && !rulesAgreedGuilds.has(activeGuildId)) {
            setShowRulesGate(true);
        } else {
            setShowRulesGate(false);
        }
    }, [activeGuildId, guildInfo, rulesAgreedGuilds]);

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

    // Show "What's New" modal if user hasn't seen the latest changelog
    useEffect(() => {
        const lastSeen = localStorage.getItem('gratonite:last-seen-changelog');
        const latestId = CHANGELOG[0]?.id ?? '';
        if (lastSeen !== latestId && ctxUser.id) {
            const timer = setTimeout(() => setShowWhatsNew(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [ctxUser.id]);

    // Fetch unread state when guild changes
    useEffect(() => {
        if (!activeGuildId || !getAccessToken()) return;
        api.guilds.getChannelsUnread(activeGuildId).then((rows) => {
            for (const r of rows) {
                registerChannelGuild(r.channelId, activeGuildId);
                if (r.mentionCount > 0) {
                    incrementUnread(r.channelId, r.mentionCount);
                } else {
                    setChannelHasUnread(r.channelId);
                }
            }
        }).catch(() => {});
    }, [activeGuildId]);

    // Fetch unread/mention state for ALL guilds on app load (for guild-level badges)
    const guildsLoadedRef = useRef(false);
    useEffect(() => {
        if (guildsLoadedRef.current || guilds.length === 0 || !getAccessToken()) return;
        guildsLoadedRef.current = true;
        for (const guild of guilds) {
            api.guilds.getChannelsUnread(guild.id).then((rows) => {
                for (const r of rows) {
                    registerChannelGuild(r.channelId, guild.id);
                    if (r.mentionCount > 0) {
                        incrementUnread(r.channelId, r.mentionCount);
                    } else {
                        setChannelHasUnread(r.channelId);
                    }
                }
            }).catch(() => {});
        }
    }, [guilds.length]);

    // Listen for MESSAGE_CREATE and MENTION_CREATED globally for unread tracking
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onMsgCreate = (data: { channelId: string }) => {
            const channelMatch = location.pathname.match(/\/channel\/([^/]+)/);
            const dmMatch = location.pathname.match(/\/dm\/([^/]+)/);
            const currentChannelId = channelMatch?.[1] || dmMatch?.[1];
            if (data.channelId !== currentChannelId) {
                setChannelHasUnread(data.channelId);
            }
        };

        const onMentionCreated = (data: { channelId: string; guildId: string; mentionCount: number }) => {
            const channelMatch = location.pathname.match(/\/channel\/([^/]+)/);
            const dmMatch = location.pathname.match(/\/dm\/([^/]+)/);
            const currentChannelId = channelMatch?.[1] || dmMatch?.[1];
            if (data.channelId !== currentChannelId) {
                incrementUnread(data.channelId, 1);
            }
        };

        socket.on('MESSAGE_CREATE', onMsgCreate);
        socket.on('MENTION_CREATED', onMentionCreated);
        return () => {
            socket.off('MESSAGE_CREATE', onMsgCreate);
            socket.off('MENTION_CREATED', onMentionCreated);
        };
    }, [location.pathname]);

    // Listen for CHANNEL_CREATE to refresh sidebar channels
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onChannelCreate = () => {
            window.dispatchEvent(new CustomEvent('gratonite:guild-updated'));
        };

        socket.on('CHANNEL_CREATE', onChannelCreate);
        return () => { socket.off('CHANNEL_CREATE', onChannelCreate); };
    }, []);

    // Real-time guild, channel, friend, and DM updates (Wave 0)
    useEffect(() => {
        const unsubs = [
            onGuildJoined((data) => {
                setGuilds(prev => {
                    if (prev.some(g => g.id === data.guildId)) return prev;
                    return [...prev, {
                        id: data.guild.id,
                        name: data.guild.name,
                        ownerId: '',
                        iconHash: data.guild.iconHash,
                        description: null,
                        memberCount: data.guild.memberCount,
                    }];
                });
                joinGuildRoom(data.guildId);
                // Check if onboarding is configured for the new guild
                (async () => {
                    try {
                        const token = getAccessToken();
                        const res = await fetch(`${API_BASE}/guilds/${data.guildId}/onboarding`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (res.ok) {
                            const onboarding = await res.json();
                            if (onboarding.welcomeMessage || onboarding.rulesChannelId) {
                                setActiveModal('onboarding');
                            }
                        }
                    } catch { /* ignore — onboarding is optional */ }
                })();
            }),
            onGuildLeft((data) => {
                setGuilds(prev => prev.filter(g => g.id !== data.guildId));
                if (activeGuildId === data.guildId) {
                    navigate('/app');
                }
            }),
            onGuildUpdate((data) => {
                setGuilds(prev => prev.map(g =>
                    g.id === data.guildId ? { ...g, name: data.name ?? g.name, iconHash: data.iconHash ?? g.iconHash, description: data.description ?? g.description, memberCount: data.memberCount ?? g.memberCount } : g
                ));
            }),
            onGuildDelete((data) => {
                setGuilds(prev => prev.filter(g => g.id !== data.guildId));
                if (activeGuildId === data.guildId) {
                    navigate('/app');
                }
            }),
            onChannelUpdate(() => {
                window.dispatchEvent(new CustomEvent('gratonite:guild-updated'));
            }),
            onChannelDelete((data) => {
                window.dispatchEvent(new CustomEvent('gratonite:guild-updated'));
                // Notify sidebar to remove the deleted channel
                window.dispatchEvent(new CustomEvent('gratonite:channel-deleted', { detail: { channelId: data.channelId, guildId: data.guildId } }));
                const currentChannelMatch = location.pathname.match(/\/channel\/([^/]+)/);
                if (currentChannelMatch?.[1] === data.channelId) {
                    navigate(activeGuildId ? `/guild/${activeGuildId}` : '/app');
                }
            }),
            onGuildMemberAdd((data) => {
                setGuilds(prev => prev.map(g =>
                    g.id === data.guildId ? { ...g, memberCount: g.memberCount + 1 } : g
                ));
            }),
            onGuildMemberRemove((data) => {
                setGuilds(prev => prev.map(g =>
                    g.id === data.guildId ? { ...g, memberCount: Math.max(g.memberCount - 1, 0) } : g
                ));
            }),
            onDmChannelCreate((data) => {
                setDmChannels(prev => {
                    if (prev.some(d => d.id === data.channel.id)) return prev;
                    return [...prev, data.channel];
                });
            }),
        ];

        return () => unsubs.forEach(fn => fn());
    }, [activeGuildId, navigate, location.pathname]);

    // Browser tab title with unread count
    const tabTitleUnreadMap = useUnreadStore();
    useEffect(() => {
        let totalUnread = 0;
        for (const entry of tabTitleUnreadMap.values()) {
            if (entry.hasUnread) totalUnread += Math.max(entry.mentionCount, 1);
        }
        document.title = totalUnread > 0 ? `(${totalUnread}) Gratonite` : 'Gratonite';
    }, [tabTitleUnreadMap]);

    // Register service worker for web push + quick reply support
    useEffect(() => {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            navigator.serviceWorker.register('/app/sw.js').then(reg => {
                // Send auth token to service worker for notification quick reply
                const token = getAccessToken() ?? '';
                if (token && reg.active) {
                    reg.active.postMessage({ type: 'STORE_AUTH_TOKEN', token });
                }
            }).catch(() => {});

            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'GET_AUTH_TOKEN' && event.ports?.[0]) {
                    const token = localStorage.getItem('accessToken');
                    event.ports[0].postMessage({ token });
                }
                if (event.data?.type === 'NAVIGATE_TO_CHANNEL' && event.data.channelId) {
                    // Navigate to the channel - dispatch a custom event for the router
                    window.dispatchEvent(new CustomEvent('navigate-to-channel', {
                        detail: { channelId: event.data.channelId, guildId: event.data.guildId },
                    }));
                }
                if (event.data?.type === 'REPLY_FAILED' && event.data.channelId) {
                    // Could show a toast or pre-fill the chat input
                    window.dispatchEvent(new CustomEvent('reply-failed', {
                        detail: { channelId: event.data.channelId, content: event.data.content },
                    }));
                }
            });
        }
    }, []);

    // React Query: guilds and DM channels
    const guildsQuery = useGuildsQuery();
    const dmChannelsQuery = useDmChannelsQuery();

    // Sync React Query guilds data into local state for real-time socket mutations
    useEffect(() => {
        if (guildsQuery.data) {
            const normalized = Array.isArray(guildsQuery.data) ? guildsQuery.data.map((g: any) => ({
                id: g.id,
                name: g.name,
                ownerId: g.ownerId ?? '',
                iconHash: g.iconHash ?? null,
                description: g.description ?? null,
                memberCount: typeof g.memberCount === 'number' ? g.memberCount : 0,
            })) : [];
            setGuilds(normalized);
        }
    }, [guildsQuery.data]);

    // Sync React Query DM channels data into local state
    useEffect(() => {
        if (dmChannelsQuery.data) {
            setDmChannels(dmChannelsQuery.data);
        }
    }, [dmChannelsQuery.data]);

    const refreshGuilds = useCallback(() => {
        invalidateGuilds();
    }, []);

    const handleGuildLeave = useCallback((guildId: string) => {
        setGuilds(prev => prev.filter(g => g.id !== guildId));
    }, []);

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.guildId && detail?.iconHash) {
                setGuilds(prev => prev.map(g =>
                    g.id === detail.guildId ? { ...g, iconHash: detail.iconHash } : g
                ));
            }
            invalidateGuilds();
        };
        window.addEventListener('gratonite:guild-updated', handler);

        return () => {
            window.removeEventListener('gratonite:guild-updated', handler);
        };
    }, []);

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
            // Set Sentry user context for error attribution
            import('@sentry/react').then(Sentry => {
                Sentry.setUser({ id: ctxUser.id, username: ctxUser.handle });
            });
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

    // ── Incoming call listener ──────────────────────────────────────
    useEffect(() => {
        const unsubInvite = onCallInvite((payload) => {
            setIncomingCall(payload);
        });
        const unsubCancel = onCallCancel(() => {
            setIncomingCall(null);
        });
        return () => { unsubInvite(); unsubCancel(); };
    }, []);

    const handleAnswerCall = useCallback(async (withVideo: boolean) => {
        if (!incomingCall) return;
        try {
            await api.voice.callAnswer(incomingCall.channelId);
            setIncomingCall(null);
            // Navigate to the DM channel with call param
            navigate(`/dm/${incomingCall.callerId}?call=${withVideo ? 'video' : 'voice'}`);
        } catch {
            addToast({ title: 'Failed to answer call', variant: 'error' });
            setIncomingCall(null);
        }
    }, [incomingCall, navigate, addToast]);

    const handleDeclineCall = useCallback(async () => {
        if (!incomingCall) return;
        try {
            await api.voice.callReject(incomingCall.channelId);
        } catch {
            // best-effort
        }
        setIncomingCall(null);
    }, [incomingCall]);

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
    }, [userLoading, ctxUser.id]);

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
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault();
                setActiveModal(prev => prev === 'bugReport' ? null : 'bugReport');
            }
            if (e.key === 'Escape' && activeModal) {
                e.preventDefault();
                setActiveModal(null);
            }

            // Alt+ArrowUp / Alt+ArrowDown: Navigate channels
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                e.preventDefault();
                const guildId = location.pathname.match(/\/guild\/([^/]+)/)?.[1];
                if (!guildId) return;
                const channelMatch = location.pathname.match(/\/(?:channel|voice)\/([^/]+)/);
                const currentChannelId = channelMatch?.[1];
                const sessionChannels = guildSession.enabled ? guildSession.channels : [];
                const navigableChannels = sessionChannels.filter(
                    (c: any) => c.type !== 'GUILD_CATEGORY' && c.type !== 'category'
                );
                if (navigableChannels.length === 0) return;
                const currentIndex = currentChannelId
                    ? navigableChannels.findIndex((c: any) => c.id === currentChannelId)
                    : -1;
                let nextIndex: number;
                if (e.key === 'ArrowDown') {
                    nextIndex = currentIndex < navigableChannels.length - 1 ? currentIndex + 1 : 0;
                } else {
                    nextIndex = currentIndex > 0 ? currentIndex - 1 : navigableChannels.length - 1;
                }
                const nextChannel = navigableChannels[nextIndex];
                const isVoice = nextChannel.type === 'GUILD_VOICE' || nextChannel.type === 'voice' || nextChannel.type === 'GUILD_STAGE_VOICE';
                const prefix = isVoice ? 'voice' : 'channel';
                navigate(`/guild/${guildId}/${prefix}/${nextChannel.id}`);
            }

            // Ctrl+Shift+M: Toggle mute
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'M') {
                e.preventDefault();
                if (voiceCtx.connected) {
                    voiceCtx.toggleMute();
                }
            }

            // Ctrl+Shift+D: Toggle deafen
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                if (voiceCtx.connected) {
                    voiceCtx.toggleDeafen();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeModal, location.pathname, guildSession, navigate, voiceCtx]);

    // Push to Talk: Hold configured key to unmute while in voice, release to re-mute
    const pttActiveRef = useRef(false);
    const pttReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const getVoiceMode = () => localStorage.getItem('gratonite_voice_mode') || 'voice_activity';
        const getPttKeyCode = () => localStorage.getItem('gratonite_ptt_key') || 'Space';
        const getPttDelay = () => parseInt(localStorage.getItem('gratonite_ptt_release_delay') || '200', 10);

        const handlePttDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            if (getVoiceMode() !== 'push_to_talk') return;
            const pttKeyCode = getPttKeyCode();
            if (e.code !== pttKeyCode) return;
            const tag = (e.target as HTMLElement)?.tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
            if (isInput) return;
            // Cancel any pending release — user pressed again before delay expired
            if (pttReleaseTimerRef.current) {
                clearTimeout(pttReleaseTimerRef.current);
                pttReleaseTimerRef.current = null;
            }
            if (!voiceCtx.connected || !voiceCtx.muted) return;
            e.preventDefault();
            pttActiveRef.current = true;
            voiceCtx.toggleMute();
            window.dispatchEvent(new CustomEvent('ptt-active-change', { detail: { active: true } }));
        };
        const handlePttUp = (e: KeyboardEvent) => {
            if (getVoiceMode() !== 'push_to_talk') return;
            const pttKeyCode = getPttKeyCode();
            if (e.code !== pttKeyCode) return;
            if (!pttActiveRef.current) return;
            const tag = (e.target as HTMLElement)?.tagName;
            const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
            if (isInput) return;
            e.preventDefault();
            const delay = getPttDelay();
            // Delay the mic cutoff so the tail end of speech isn't clipped
            pttReleaseTimerRef.current = setTimeout(() => {
                pttReleaseTimerRef.current = null;
                pttActiveRef.current = false;
                window.dispatchEvent(new CustomEvent('ptt-active-change', { detail: { active: false } }));
                if (voiceCtx.connected && !voiceCtx.muted) {
                    voiceCtx.toggleMute();
                }
            }, delay);
        };
        window.addEventListener('keydown', handlePttDown);
        window.addEventListener('keyup', handlePttUp);
        return () => {
            window.removeEventListener('keydown', handlePttDown);
            window.removeEventListener('keyup', handlePttUp);
            if (pttReleaseTimerRef.current) clearTimeout(pttReleaseTimerRef.current);
        };
    }, [voiceCtx]);

    // Desktop push-to-talk: global toggle via Electron
    useEffect(() => {
        const desktop = window.gratoniteDesktop;
        if (!desktop?.isDesktop || !desktop.onPttToggle || !desktop.registerPushToTalk) return;

        // Map localStorage key code to Electron accelerator format
        const mapCodeToAccelerator = (code: string): string => {
            if (code === 'Space') return 'Space';
            if (code === 'Tab') return 'Tab';
            if (code === 'CapsLock') return 'CapsLock';
            if (code.startsWith('Key')) return code.slice(3); // KeyA → A
            if (code.startsWith('Digit')) return code.slice(5); // Digit1 → 1
            if (code.startsWith('F') && /^F\d+$/.test(code)) return code; // F1-F12
            return code;
        };

        const voiceMode = localStorage.getItem('gratonite_voice_mode') || 'voice_activity';
        const pttKeyCode = localStorage.getItem('gratonite_ptt_key') || 'Space';

        // Always register the global hotkey (CmdOrCtrl+Shift+T as fallback toggle)
        // Plus register the user's chosen key as a global accelerator if PTT mode
        const accelerator = voiceMode === 'push_to_talk'
            ? `CmdOrCtrl+Shift+${mapCodeToAccelerator(pttKeyCode)}`
            : 'CmdOrCtrl+Shift+T';

        desktop.registerPushToTalk(accelerator);

        // Listen for PTT toggle events from main process
        const cleanup = desktop.onPttToggle(() => {
            if (!voiceCtx.connected) return;
            voiceCtx.toggleMute();
        });

        return () => {
            cleanup();
            desktop.unregisterPushToTalk?.();
        };
    }, [voiceCtx]);

    // Close drawers on route change
    useEffect(() => {
        setIsGuildRailOpen(false);
        setIsSidebarOpen(false);
        setIsMemberDrawerOpen(false);
    }, [location.pathname]);

    // Browser back button: push history state when modal opens, pop to close
    useEffect(() => {
        if (activeModal) {
            window.history.pushState({ modal: activeModal }, '');
        }
    }, [activeModal]);

    useEffect(() => {
        const onPopState = () => {
            if (activeModal) {
                setActiveModal(null);
            }
            setIsGuildRailOpen(false);
            setIsSidebarOpen(false);
            setIsMemberDrawerOpen(false);
        };
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, [activeModal]);

    // Rate limit toast: listen for 429 events from API layer
    useEffect(() => {
        const handler = (e: Event) => {
            const { retryAfter } = (e as CustomEvent).detail ?? {};
            const seconds = Math.ceil((retryAfter || 5000) / 1000);
            addToast({ title: `Slow down! Try again in ${seconds}s`, variant: 'error' });
        };
        window.addEventListener('gratonite:rate-limited', handler);
        return () => window.removeEventListener('gratonite:rate-limited', handler);
    }, [addToast]);

    // Request timeout toast
    useEffect(() => {
        const handler = () => {
            addToast({ title: 'Request timed out. Please try again.', variant: 'error' });
        };
        window.addEventListener('gratonite:request-timeout', handler);
        return () => window.removeEventListener('gratonite:request-timeout', handler);
    }, [addToast]);

    // Only chat/channel routes show the members sidebar
    const isChatRoute = location.pathname.includes('/chat') || location.pathname.includes('/channel/');
    const isVoiceRoute = location.pathname.includes('/voice');
    const isDmRoute = location.pathname.match(/^\/dm\/[^/]+$/);
    const hideBottomNav = isChatRoute || isVoiceRoute || !!isDmRoute;

    // Derive a section key for page transitions — same guild = same key (no animation)
    const transitionKey = useMemo(() => {
        const path = location.pathname;
        const guildMatch = path.match(/^\/guild\/([^/]+)/);
        if (guildMatch) return `guild-${guildMatch[1]}`;
        const dmMatch = path.match(/^\/dm\//);
        if (dmMatch) return 'dm';
        // Top-level sections: /, /friends, /shop, /discover, etc.
        const section = path.split('/')[1] || 'home';
        return section;
    }, [location.pathname]);

    // Mobile swipe gestures
    useMobileSwipe(mainContentRef, {
        onSwipeRight: () => {
            haptic.swipe();
            if (isMobile) {
                const guildMatch = location.pathname.match(/\/guild\/([^/]+)\/(?:channel|voice)\//);
                if (guildMatch) navigate(`/guild/${guildMatch[1]}`);
                else if (isDmRoute) navigate('/friends');
                return;
            }
            if (isSidebarOpen) { setIsSidebarOpen(false); return; }
            setIsGuildRailOpen(true);
        },
        onSwipeLeft: () => {
            haptic.swipe();
            if (isMobile) return;
            if (isGuildRailOpen) { setIsGuildRailOpen(false); return; }
            if (isChatRoute) setIsSidebarOpen(true);
        },
    });

    // Screen reader: announce route changes
    useEffect(() => {
        if (!screenReaderMode || !routeAnnouncerRef.current) return;
        const path = location.pathname;
        let label = 'Page changed';
        if (path === '/') label = 'Home page';
        else if (path === '/friends') label = 'Friends page';
        else if (path.startsWith('/guild/')) label = 'Server channel';
        else if (path.startsWith('/dm/')) label = 'Direct message';
        else if (path === '/discover') label = 'Discover servers';
        else if (path === '/shop') label = 'Shop';
        else if (path === '/fame') label = 'FAME Dashboard';
        else if (path === '/inventory') label = 'Inventory';
        else if (path === '/marketplace') label = 'Marketplace';
        else if (path === '/me') label = 'Your profile';
        routeAnnouncerRef.current.textContent = label;
    }, [location.pathname, screenReaderMode]);

    // Screen reader: announce modal open/close
    const prevModalRef = useRef<ModalType>(null);
    useEffect(() => {
        if (!screenReaderMode) { prevModalRef.current = activeModal; return; }
        const MODAL_LABELS: Record<string, string> = {
            settings: 'Settings',
            userProfile: 'User Profile',
            createGuild: 'Create Server',
            guildSettings: 'Server Settings',
            memberOptions: 'Member Options',
            invite: 'Invite',
            globalSearch: 'Search',
            dmSearch: 'DM Search',
            notifications: 'Notifications',
            shortcuts: 'Keyboard Shortcuts',
            bugReport: 'Bug Report',
            onboarding: 'Onboarding',
            createGroupDm: 'Create Group DM',
            screenShare: 'Screen Share',
        };
        if (activeModal && !prevModalRef.current) {
            announce(`${MODAL_LABELS[activeModal] || 'Dialog'} opened`);
        } else if (!activeModal && prevModalRef.current) {
            announce('Dialog closed');
        }
        prevModalRef.current = activeModal;
    }, [activeModal, screenReaderMode]);

    return (
        <ContextMenuProvider>
            <GlobalBugReportContextMenu onOpenBugReport={() => setActiveModal('bugReport')} />
            <div className="app-container">
                {/* Visually hidden route announcer for screen readers */}
                <div ref={routeAnnouncerRef} className="sr-route-announcer" aria-live="assertive" aria-atomic="true" role="status" />
                <a href="#main-content" className="skip-link">Skip to content</a>
                <div
                    className={`mobile-backdrop ${isGuildRailOpen || isSidebarOpen ? 'visible' : ''}`}
                    onClick={() => { setIsGuildRailOpen(false); setIsSidebarOpen(false); }}
                />

                <ErrorBoundary fallback={<div style={{ width: 72, background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', padding: 8 }}>Server list unavailable.<br/><button onClick={() => window.location.reload()} style={{ marginTop: 8, background: 'var(--accent-primary)', border: 'none', borderRadius: 6, padding: '4px 12px', color: '#000', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>Reload</button></div>}>
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
                    onGuildLeave={handleGuildLeave}
                    guilds={guilds}
                    userProfile={userProfile}
                />
                </ErrorBoundary>
                <ErrorBoundary fallback={<div style={{ width: 240, background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24, gap: 12 }}>Sidebar crashed.<br/><button onClick={() => window.location.reload()} style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: 6, padding: '6px 16px', color: '#000', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Reload</button></div>}>
                <ChannelSidebar
                    isOpen={isSidebarOpen}
                    onOpenSettings={() => setActiveModal('settings')}
                    onOpenProfile={() => setActiveModal('userProfile')}
                    onOpenGlobalSearch={() => setActiveModal('globalSearch')}
                    onOpenDMSearch={() => setActiveModal('dmSearch')}
                    onOpenCreateGroupDm={() => setActiveModal('createGroupDm')}
                    onOpenWhatsNew={() => setShowWhatsNew(true)}
                    userProfile={userProfile}
                    guildSession={guildSession}
                />
                </ErrorBoundary>
                <main id="main-content" ref={mainContentRef} className={`main-content-wrapper ${bgMedia !== null ? 'has-custom-bg' : ''} ${!hideBottomNav ? 'has-bottom-nav' : ''}`} tabIndex={-1} style={(!isChatRoute && !isVoiceRoute) ? { flex: 1, display: 'flex', flexDirection: 'column' } : {}}>
                    {(() => {
                        const outletCtx = {
                            bgMedia,
                            hasCustomBg: bgMedia !== null,
                            setBgMedia,
                            setActiveModal,
                            toggleGuildRail: () => {
                                if (isMobile) { navigate('/'); return; }
                                setIsGuildRailOpen(!isGuildRailOpen);
                            },
                            toggleSidebar: () => {
                                if (isMobile) return;
                                setIsSidebarOpen(!isSidebarOpen);
                            },
                            toggleMemberDrawer: () => setIsMemberDrawerOpen(prev => !prev),
                            gratoniteBalance,
                            setGratoniteBalance,
                            userProfile,
                            setUserProfile,
                            userTheme,
                            setUserTheme,
                            guildSession,
                            guilds
                        };
                        const showSplit = splitState.enabled && splitState.rightChannelId && splitState.rightGuildId && isChatRoute && !isMobile;
                        if (showSplit) {
                            return (
                                <SplitViewContainer
                                    leftContent={
                                        <AnimatePresence mode="wait" initial={false}>
                                            <motion.div
                                                key={transitionKey}
                                                className="route-transition-wrapper route-container"
                                                style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}
                                                initial={reducedEffects ? false : { opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={reducedEffects ? undefined : { opacity: 0 }}
                                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                            >
                                                <Outlet context={outletCtx} />
                                            </motion.div>
                                        </AnimatePresence>
                                    }
                                    rightContent={
                                        <SplitViewRightPane
                                            channelId={splitState.rightChannelId!}
                                            guildId={splitState.rightGuildId!}
                                            outletContext={outletCtx}
                                        />
                                    }
                                    dividerPosition={splitState.dividerPosition}
                                    onDividerChange={setDividerPosition}
                                    onClose={closeSplitView}
                                />
                            );
                        }
                        return (
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={transitionKey}
                                    className="route-transition-wrapper route-container"
                                    style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}
                                    initial={reducedEffects ? false : { opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={reducedEffects ? undefined : { opacity: 0 }}
                                    transition={{ duration: 0.2, ease: 'easeOut' }}
                                >
                                    <Outlet context={outletCtx} />
                                </motion.div>
                            </AnimatePresence>
                        );
                    })()}
                    {isChatRoute && (isSidebarOpen || (isMobile && isMemberDrawerOpen)) && (
                        <ErrorBoundary fallback={<div style={{ width: 240, background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 24 }}>Members list unavailable.</div>}>
                            <MembersSidebar onOpenProfile={() => setActiveModal('userProfile')} isMobileOpen={isMemberDrawerOpen} onCloseMobile={() => setIsMemberDrawerOpen(false)} />
                        </ErrorBoundary>
                    )}
                </main>

                {/* Mobile Bottom Navigation (< 768px) — 5 tabs: Home, DMs, Search, Notifications, Settings */}
                {!hideBottomNav && (
                <nav className="mobile-bottom-nav" aria-label="Main navigation">
                    <Link to="/" className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`} aria-current={location.pathname === '/' ? 'page' : undefined}>
                        <Home size={20} aria-hidden="true" />
                        <span>Home</span>
                    </Link>
                    <Link to="/friends" className={`mobile-nav-item ${location.pathname.startsWith('/dm') || location.pathname === '/friends' ? 'active' : ''}`} aria-current={location.pathname.startsWith('/dm') || location.pathname === '/friends' ? 'page' : undefined}>
                        <MessageSquare size={20} aria-hidden="true" />
                        <span>DMs</span>
                    </Link>
                    <button className={`mobile-nav-item ${activeModal === 'globalSearch' ? 'active' : ''}`} onClick={() => setActiveModal('globalSearch')} type="button">
                        <Search size={20} aria-hidden="true" />
                        <span>Search</span>
                    </button>
                    <button className={`mobile-nav-item ${activeModal === 'notifications' ? 'active' : ''}`} onClick={() => setActiveModal('notifications')} type="button" style={{ position: 'relative' }}>
                        <Bell size={20} aria-hidden="true" />
                        <span>Alerts</span>
                    </button>
                    <button className={`mobile-nav-item ${activeModal === 'settings' ? 'active' : ''}`} onClick={() => setActiveModal('settings')} type="button">
                        <Settings size={20} aria-hidden="true" />
                        <span>Settings</span>
                    </button>
                </nav>
                )}
            </div>

            {/* Modals */}
            <Suspense fallback={null}>
            {isMobile ? (
                activeModal === 'settings' && <SettingsModal onClose={() => setActiveModal(null)} userProfile={userProfile} setUserProfile={setUserProfile as any} userTheme={userTheme} setUserTheme={setUserTheme as any} />
            ) : (
                <ModalWrapper isOpen={activeModal === 'settings'}>
                    <SettingsModal onClose={() => setActiveModal(null)} userProfile={userProfile} setUserProfile={setUserProfile as any} userTheme={userTheme} setUserTheme={setUserTheme as any} />
                </ModalWrapper>
            )}
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
                            const record = { ...g, ownerId: (g as any).ownerId ?? '', description: null, memberCount: 0 };
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
            <ModalWrapper isOpen={activeModal === 'memberOptions'}>
                {activeModal === 'memberOptions' && (() => {
                    const guildId = location.pathname.match(/\/guild\/([^/]+)/)?.[1] || '';
                    const guildName = guilds.find(g => g.id === guildId)?.name || '';
                    return <MemberOptionsModal onClose={() => setActiveModal(null)} guildId={guildId} guildName={guildName} userId={userProfile.id} />;
                })()}
            </ModalWrapper>
            <ModalWrapper isOpen={activeModal === 'invite'}>
                <InviteModal onClose={() => setActiveModal(null)} guildId={location.pathname.match(/\/guild\/([^/]+)/)?.[1] || null} />
            </ModalWrapper>
            {activeModal === 'dmSearch' && (
                <DMSearchModal onClose={() => setActiveModal(null)} />
            )}
            {activeModal === 'createGroupDm' && (
                <GroupDmCreateModal onClose={() => { setActiveModal(null); api.relationships.getDmChannels().then(setDmChannels).catch(() => {}); }} />
            )}

            {/* Server Rules Gate */}
            {showRulesGate && activeGuildId && guildInfo && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', maxWidth: '520px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '24px 24px 0', textAlign: 'center' }}>
                            <ShieldAlert size={36} style={{ color: 'var(--accent-primary)', marginBottom: '12px' }} />
                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', fontFamily: 'var(--font-display)' }}>Server Rules</h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Please read and accept the rules for <strong>{guildInfo.name}</strong> before participating.</p>
                        </div>
                        <div style={{ padding: '0 24px', flex: 1, overflow: 'auto' }}>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                                {(guildInfo as any).rulesText}
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'center' }}>
                            <button
                                onClick={() => {
                                    api.post(`/guilds/${activeGuildId}/agree-rules`, {}).then(() => {
                                        setRulesAgreedGuilds((prev: Set<string>) => new Set([...prev, activeGuildId!]));
                                        setShowRulesGate(false);
                                    }).catch(() => {});
                                }}
                                style={{ padding: '10px 32px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                            >
                                I Have Read and Agree to the Rules
                            </button>
                        </div>
                    </div>
                </div>
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
            {showWhatsNew && <WhatsNewModal onClose={() => { localStorage.setItem('gratonite:last-seen-changelog', CHANGELOG[0]?.id ?? ''); setShowWhatsNew(false); }} />}
            {pendingExternalLink && (
                <ExternalLinkModal url={pendingExternalLink} onClose={() => setPendingExternalLink(null)} />
            )}
            </Suspense>
            {incomingCall && (
                <IncomingCallModal
                    channelId={incomingCall.channelId}
                    callerId={incomingCall.callerId}
                    callerName={incomingCall.callerName}
                    callerAvatar={incomingCall.callerAvatar}
                    withVideo={incomingCall.withVideo}
                    onAnswerAudio={() => handleAnswerCall(false)}
                    onAnswerVideo={() => handleAnswerCall(true)}
                    onDecline={handleDeclineCall}
                />
            )}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
                id="sr-announcements"
            />
            {tour.show && <OnboardingTour onClose={tour.dismiss} />}
        </ContextMenuProvider>
    );
};

// Removed ChatRouteWrapper since ChannelChat uses outlet context directly

const LazyFallback = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div className="skeleton-pulse" style={{ width: 40, height: 40, borderRadius: '50%' }} />
    </div>
);

const appRouter = createBrowserRouter(
    createRoutesFromElements(
        <Route element={<Outlet />} errorElement={<RouteErrorBoundary />}>
            {/* Public Auth Routes */}
            <Route element={<AuthLayout />}>
                <Route path="login" element={<Login />} />
                <Route path="register" element={<Register />} />
                <Route path="verify" element={<Verify />} />
                <Route path="reset-password" element={<ResetPassword />} />
            </Route>

            {/* OAuth consent screen (must be logged in) */}
            <Route path="oauth/authorize" element={<RequireAuth><Suspense fallback={<LazyFallback />}><OAuthAuthorize /></Suspense></RequireAuth>} />

            {/* Embeddable document editor (for mobile WebView) */}
            <Route path="embed/document/:channelId" element={
                <RequireAuth>
                    <Suspense fallback={<LazyFallback />}>
                        <EmbedDocumentPage />
                    </Suspense>
                </RequireAuth>
            } />

            {/* Public Invite Route */}
            <Route path="invite/:code" element={<InviteAccept />} />

            {/* Public Vanity Profile */}
            <Route path="u/:vanityUrl" element={<Suspense fallback={<LazyFallback />}><VanityProfile /></Suspense>} />

            {/* Task #89: Desktop Mini Mode */}
            <Route path="mini-mode" element={<Suspense fallback={<LazyFallback />}><MiniMode /></Suspense>} />

            {/* Self-host setup wizard */}
            <Route path="setup" element={<Suspense fallback={<LazyFallback />}><SetupPage /></Suspense>} />

            {/* Private App Routes */}
            <Route path="/" element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route index element={<Suspense fallback={<LazyFallback />}><HomePage /></Suspense>} />
                <Route path="friends" element={<Suspense fallback={<LazyFallback />}><Friends /></Suspense>} />
                <Route path="gratonite" element={<Navigate to="/" replace />} />
                <Route path="shop" element={<Suspense fallback={<LazyFallback />}><Shop /></Suspense>} />
                <Route path="marketplace" element={<Suspense fallback={<LazyFallback />}><Marketplace /></Suspense>} />
                <Route path="inventory" element={<Suspense fallback={<LazyFallback />}><Inventory /></Suspense>} />
                <Route path="discover" element={<Suspense fallback={<LazyFallback />}><Discover /></Suspense>} />
                <Route path="download" element={<Download />} />
                <Route path="creator-dashboard" element={<Suspense fallback={<LazyFallback />}><CreatorDashboard /></Suspense>} />
                <Route path="fame" element={<Suspense fallback={<LazyFallback />}><FameDashboard /></Suspense>} />
                <Route path="theme-builder" element={<Suspense fallback={<LazyFallback />}><ThemeBuilder /></Suspense>} />
                <Route path="bot-builder" element={<Suspense fallback={<LazyFallback />}><BotBuilder /></Suspense>} />
                <Route path="bot-store" element={<Suspense fallback={<LazyFallback />}><BotStore /></Suspense>} />
                <Route path="help-center" element={<Suspense fallback={<LazyFallback />}><HelpCenter /></Suspense>} />
                <Route path="me" element={<Suspense fallback={<LazyFallback />}><MeProfile /></Suspense>} />
                <Route path="message-requests" element={<Suspense fallback={<LazyFallback />}><MessageRequests /></Suspense>} />
                <Route path="read-later" element={<Suspense fallback={<LazyFallback />}><ReadLater /></Suspense>} />
                <Route path="saved-messages" element={<Navigate to="/read-later" replace />} />
                <Route path="badges" element={<Suspense fallback={<LazyFallback />}><BadgesGallery /></Suspense>} />
                <Route path="friend-activity" element={<Suspense fallback={<LazyFallback />}><FriendActivity /></Suspense>} />
                <Route path="daily-challenges" element={<Suspense fallback={<LazyFallback />}><DailyChallenges /></Suspense>} />
                <Route path="trading" element={<Suspense fallback={<LazyFallback />}><Trading /></Suspense>} />
                <Route path="inbox" element={<Suspense fallback={<LazyFallback />}><UnifiedInbox /></Suspense>} />
                <Route path="activity" element={<ActivityFeedPage />} />
                <Route path="leaderboard" element={<LeaderboardPage />} />
                <Route path="schedule-calendar" element={<Suspense fallback={<LazyFallback />}><ScheduleCalendar /></Suspense>} />
                <Route path="gacha" element={<Suspense fallback={<LazyFallback />}><Gacha /></Suspense>} />
                <Route path="saved" element={<Navigate to="/read-later" replace />} />
                <Route path="admin" element={<RequireAdmin><Suspense fallback={<LazyFallback />}><AdminDashboard /></Suspense></RequireAdmin>} />
                <Route path="admin/team" element={<RequireAdmin><Suspense fallback={<LazyFallback />}><AdminTeam /></Suspense></RequireAdmin>} />
                <Route path="admin/audit" element={<RequireAdmin><Suspense fallback={<LazyFallback />}><AdminAuditLog /></Suspense></RequireAdmin>} />
                <Route path="admin/bot-moderation" element={<RequireAdmin><Suspense fallback={<LazyFallback />}><AdminBotModeration /></Suspense></RequireAdmin>} />
                <Route path="admin/feedback" element={<RequireAdmin><Suspense fallback={<LazyFallback />}><AdminFeedback /></Suspense></RequireAdmin>} />
                <Route path="admin/reports" element={<RequireAdmin><Suspense fallback={<LazyFallback />}><AdminReports /></Suspense></RequireAdmin>} />
                <Route path="admin/portals" element={<RequireAdmin><Suspense fallback={<LazyFallback />}><AdminPortals /></Suspense></RequireAdmin>} />
                <Route path="admin/federation" element={<RequireAdmin><Suspense fallback={<LazyFallback />}><FederationAdmin /></Suspense></RequireAdmin>} />
                <Route path="admin/cosmetics" element={<RequireAdmin><Suspense fallback={<LazyFallback />}><AdminCosmetics /></Suspense></RequireAdmin>} />
                <Route path="dm/:id" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><DirectMessage /></Suspense></ErrorBoundary>} />
                {/* Parameterized guild routes */}
                <Route path="guild/:guildId" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><GuildOverview /></Suspense></ErrorBoundary>} />
                <Route path="guild/:guildId/channel/:channelId" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><ChannelChat /></Suspense></ErrorBoundary>} />
                <Route path="guild/:guildId/voice/:channelId" element={<Suspense fallback={<LazyFallback />}><VoiceChannel /></Suspense>} />
                <Route path="guilds/:guildId/:channelId" element={<LegacyGuildChannelRedirect />} />
                <Route path="guilds/:guildId/voice/:channelId" element={<LegacyGuildVoiceRedirect />} />
                <Route path="guild/:guildId/:channelId" element={<LegacyGuildChannelRedirect />} />
                <Route path="guild/:guildId/overview" element={<ErrorBoundary><Suspense fallback={<LazyFallback />}><GuildOverview /></Suspense></ErrorBoundary>} />
                <Route path="guild/:guildId/audit-log" element={<Suspense fallback={<LazyFallback />}><AuditLog /></Suspense>} />
                <Route path="guild/:guildId/workflows" element={<Suspense fallback={<LazyFallback />}><GuildWorkflows /></Suspense>} />
                <Route path="guild/:guildId/events" element={<Suspense fallback={<LazyFallback />}><EventScheduler /></Suspense>} />
                <Route path="guild/:guildId/moderation" element={<Suspense fallback={<LazyFallback />}><ModerationDashboard /></Suspense>} />
                <Route path="guild/:guildId/members" element={<Suspense fallback={<LazyFallback />}><MemberDirectory /></Suspense>} />
                <Route path="guild/:guildId/stats" element={<Suspense fallback={<LazyFallback />}><PublicGuildStats /></Suspense>} />
                <Route path="guild/:guildId/clips" element={<Suspense fallback={<LazyFallback />}><ClipsGallery /></Suspense>} />
            </Route>

            <Route path="*" element={<NotFound />} />
        </Route>
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
            <ThemePreviewBanner />
            <ConnectionBanner />
            {(window as any).gratoniteDesktop?.isDesktop && <UpdateBanner />}
            <SeasonalOverlay />
            <LiveAnnouncer />
            {/* SVG filters for color-blind accessibility preview modes */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
                <defs>
                    <filter id="deuteranopia-filter">
                        <feColorMatrix type="matrix" values="0.625 0.375 0     0 0
                                                             0.7   0.3   0     0 0
                                                             0     0.3   0.7   0 0
                                                             0     0     0     1 0" />
                    </filter>
                    <filter id="protanopia-filter">
                        <feColorMatrix type="matrix" values="0.567 0.433 0     0 0
                                                             0.558 0.442 0     0 0
                                                             0     0.242 0.758 0 0
                                                             0     0     0     1 0" />
                    </filter>
                    <filter id="tritanopia-filter">
                        <feColorMatrix type="matrix" values="0.95  0.05  0     0 0
                                                             0     0.433 0.567 0 0
                                                             0     0.475 0.525 0 0
                                                             0     0     0     1 0" />
                    </filter>
                </defs>
            </svg>
            <RouterProvider router={appRouter} />
            </AchievementToastProvider>
        </ToastProvider>
        </VoiceProvider>
        </UserProvider>
        </ErrorBoundary>
    );
}

export default App;
