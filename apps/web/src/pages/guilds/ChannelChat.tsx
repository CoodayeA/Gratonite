import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useOutletContext, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import {
    Send, Smile, Image as ImageIcon, Reply, X, Play, Hash, Menu, ArrowLeft,
    Volume2, Trash2, Copy, Pin, Share2, Link2, FileText, Download,
    Pause, MessageSquare, MoreHorizontal, Square, Plus, Mic, BarChart2, Clock, Users,
    ThumbsUp, Star, Flag, Edit2, Search, ChevronUp, ChevronDown, Eye, ChevronLeft, ChevronRight,
    BookOpen, User as UserIcon, Ban, ShieldAlert, VolumeX, Zap, Megaphone, Rss, Bell, BellOff, Code
} from 'lucide-react';
// Extracted sub-components
import MessageList from '../../components/chat/MessageList';
import MessageInput from '../../components/chat/MessageInput';
import { MemoizedMessageItem } from '../../components/chat/MessageItem';
import type { Message, Attachment, MediaType, OutletContextType, ChannelDetail } from '../../components/chat/chatTypes';

import Skeleton from '../../components/ui/Skeleton';
import { SkeletonMessageList } from '../../components/ui/SkeletonLoader';
import { ErrorState } from '../../components/ui/ErrorState';
import { useContextMenu } from '../../components/ui/ContextMenu';
import { useToast } from '../../components/ui/ToastManager';
import { copyToClipboard } from '../../utils/clipboard';
import { TopBarActions } from '../../components/ui/TopBarActions';
import { BackgroundMedia } from '../../components/ui/BackgroundMedia';
import UserProfilePopover from '../../components/ui/UserProfilePopover';
import { playSound } from '../../utils/SoundManager';
import { api, API_BASE, getAccessToken } from '../../lib/api';
import type { SearchMessagesApiResponse } from '../../lib/api/messages';
import { markRead, setChannelHasUnread } from '../../store/unreadStore';
import { getSocket, joinChannel as socketJoinChannel, leaveChannel as socketLeaveChannel } from '../../lib/socket';
import { onTypingStart, onMessageCreate, onMessageUpdate, onMessageDelete, onMessageDeleteBulk, onReactionAdd, onReactionRemove, onChannelPinsUpdate, onSocketReconnect, onChannelBackgroundUpdated, onGroupKeyRotationNeeded, onThreadCreate, type TypingStartPayload, type MessageCreatePayload, type MessageUpdatePayload, type MessageDeletePayload, type MessageDeleteBulkPayload, type ReactionPayload, type ChannelPinsUpdatePayload, type GroupKeyRotationNeededPayload } from '../../lib/socket';
import Avatar from '../../components/ui/Avatar';
import ImageLightbox from '../../components/ui/ImageLightbox';
import SwipeableMessage from '../../components/chat/SwipeableMessage';
import { saveScrollPosition, getScrollPosition } from '../../store/scrollPositionStore';
import { queryClient } from '../../lib/queryClient';
import { userQueryKey } from '../../hooks/queries/useUserQuery';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useIsMobile } from '../../hooks/useIsMobile';
import { haptic } from '../../utils/haptics';
import { encrypt, decrypt, getOrCreateKeyPair, decryptGroupKey, generateGroupKey, encryptGroupKey, importPublicKey, encryptFile, decryptFile, exportPublicKey } from '../../lib/e2e';
import { Lock, Loader2 as Loader2Icon } from 'lucide-react';

// Types (Message, Attachment, MediaType, OutletContextType, ChannelDetail) are imported from chatTypes.ts

import { LazyEmbed, OgEmbed } from '../../components/chat/EmbedCard';
import { RichEmbedCard, RichEmbed } from '../../components/chat/RichEmbedCard';
import { MessageComponents } from '../../components/chat/MessageComponents';
import ThreadPanel from '../../components/chat/ThreadPanel';
import ThreadsPanel from '../../components/chat/ThreadsPanel';
import ChannelNotesPanel from '../../components/chat/ChannelNotesPanel';
import EventCountdownBanner from '../../components/EventCountdownBanner';
import EmbeddedWidget from '../../components/chat/EmbeddedWidget';
import SoundboardMenu from '../../components/chat/SoundboardMenu';
import { playSynthSound } from '../../lib/soundSynth';
import EmojiPicker from '../../components/chat/EmojiPicker';
import ChatPoll from '../../components/chat/ChatPoll';
import { EmptyState } from '../../components/ui/EmptyState';
import { RichTextRenderer } from '../../components/chat/RichTextRenderer';
import { MessageLinkPreview } from '../../components/chat/MessageLinkPreview';
import { addRecentChannel } from '../../components/guild/RecentChannels';
import { SharedMediaGallery } from '../../components/guild/SharedMediaGallery';
import { Tooltip } from '../../components/ui/Tooltip';
import ForwardModal from '../../components/modals/ForwardModal';
import EditHistoryPopover from '../../components/chat/EditHistoryPopover';
import { MemberListPanel } from '../../components/guild/MemberListPanel';
import { ReactionSummaryPopover } from '../../components/chat/ReactionSummaryPopover';
import { SlowClapReaction } from '../../components/chat/SlowClapReaction';
import { FormattingToolbar } from '../../components/chat/FormattingToolbar';
import { EmbedBuilder, type CustomEmbed } from '../../components/chat/EmbedBuilder';
import { ChannelWelcomeCard } from '../../components/chat/ChannelWelcomeCard';
import { VoiceMessagePlayer } from '../../components/chat/VoiceMessagePlayer';
import { JumpToDatePicker } from '../../components/chat/JumpToDatePicker';
import { BUILTIN_COMMANDS, TEXT_COMMANDS, parseRemindTime } from '../../components/chat/SlashCommandPalette';
import { RemindersList } from '../../components/chat/RemindersList';
import { GifReactionPicker } from '../../components/chat/GifReactionPicker';
import { Languages, Calendar, Timer } from 'lucide-react';
import ForumView from '../../components/chat/ForumView';
import DocumentChannel from '../../components/channel/DocumentChannel';
import WikiChannel from './WikiChannel';
import QAChannel from './QAChannel';
import KanbanBoard from '../../components/guild/KanbanBoard';
import ConfessionBoard from '../../components/chat/ConfessionBoard';


// Components extracted to: ../../components/chat/MessageItem.tsx, ReactionBar.tsx, chatTypes.ts


// ── Emoji Rain (Hype Mode) ──────────────────────────────────────────────────
const HYPE_EMOJIS = ['🔥', '⚡', '💥', '🌟', '✨', '🎉', '🎊', '💫', '🚀', '🎯', '💯', '👑'];

const EmojiRain = ({ active }: { active: boolean }) => {
    const [particles, setParticles] = React.useState<{ id: number; emoji: string; left: number; dur: number; delay: number; size: number }[]>([]);
    const counter = React.useRef(0);

    React.useEffect(() => {
        if (!active) { setParticles([]); return; }
        const interval = setInterval(() => {
            setParticles(prev => {
                const id = ++counter.current;
                const next = [...prev.slice(-30), {
                    id,
                    emoji: HYPE_EMOJIS[Math.floor(Math.random() * HYPE_EMOJIS.length)],
                    left: Math.random() * 98,
                    dur: 2.5 + Math.random() * 2,
                    delay: 0,
                    size: 18 + Math.random() * 20,
                }];
                return next;
            });
        }, 120);
        return () => clearInterval(interval);
    }, [active]);

    if (!active || particles.length === 0) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 8000, overflow: 'hidden' }}>
            {particles.map(p => (
                <span
                    key={p.id}
                    className="emoji-rain-particle"
                    style={{
                        left: `${p.left}%`,
                        fontSize: `${p.size}px`,
                        animationDuration: `${p.dur}s`,
                    }}
                >
                    {p.emoji}
                </span>
            ))}
        </div>
    );
};

// Stable waveform bar heights — deterministic so they don't jump on re-render
const WAVEFORM_HEIGHTS = [6, 14, 10, 18, 8, 16, 12, 20, 7, 15, 11, 17, 9, 13, 6];

function VoicePlayer({ url, duration }: { url: string; duration?: string }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [elapsed, setElapsed] = useState('0:00');

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
            audio.pause();
            setPlaying(false);
        } else {
            audio.play().catch(() => {});
            setPlaying(true);
        }
    };

    return (
        <div style={{ background: 'var(--bg-tertiary)', padding: '8px 16px', borderRadius: '24px', display: 'inline-flex', alignItems: 'center', gap: '12px', marginTop: '4px', border: '1px solid var(--stroke)' }}>
            <button
                onClick={toggle}
                style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
                {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '20px', opacity: playing ? 1 : 0.7 }}>
                {WAVEFORM_HEIGHTS.map((h, i) => (
                    <div key={i} style={{ width: '3px', height: `${h}px`, background: playing ? 'var(--accent-primary)' : 'var(--text-primary)', borderRadius: '2px', transition: 'background 0.2s' }} />
                ))}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '32px' }}>
                {playing ? elapsed : (duration || '0:00')}
            </span>
            <audio
                ref={audioRef}
                src={url}
                onTimeUpdate={() => {
                    const audio = audioRef.current;
                    if (audio) {
                        const s = Math.floor(audio.currentTime);
                        setElapsed(`${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`);
                    }
                }}
                onEnded={() => { setPlaying(false); setElapsed('0:00'); }}
            />
        </div>
    );
}

const ChannelChat = ({ channelIdProp, guildIdProp }: { channelIdProp?: string; guildIdProp?: string } = {}) => {
    const outletCtx = useOutletContext<OutletContextType>() ?? {} as OutletContextType;
    const { bgMedia, hasCustomBg, setBgMedia, toggleGuildRail, toggleSidebar, toggleMemberDrawer, userProfile } = outletCtx;
    const params = useParams<{ channelId: string; guildId: string }>();
    const channelId = channelIdProp || params.channelId;
    const guildId = guildIdProp || params.guildId;
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [newMsgCount, setNewMsgCount] = useState(0);
    const [inputValue, setInputValue] = useState('');
    const [replyingTo, setReplyingTo] = useState<{ id: number; apiId?: string; author: string; content: string } | null>(null);
    const [editingMessage, setEditingMessage] = useState<{ id: number; apiId: string; content: string } | null>(null);
    const [editContent, setEditContent] = useState('');
    const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);

    // Forward Modal State
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

    // Image Lightbox State
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [lightboxZoom, setLightboxZoom] = useState(1);
    const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });

    // Feature 5: Markdown Preview State
    const [showPreview, setShowPreview] = useState(false);
    // Item 106: Media Gallery
    const [showMediaGallery, setShowMediaGallery] = useState(false);

    // Feature 9: New Messages Divider — lastReadMessageId per channel
    const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);

    // Feature 12: Read Receipts — other users' read positions
    const [otherReadStates, setOtherReadStates] = useState<{ userId: string; lastReadMessageId: string | null }[]>([]);
    const showReadReceipts = (() => { try { return localStorage.getItem('gratonite:show-read-receipts') !== 'false'; } catch { return true; } })();

    // Feature 13: Compact Mode State
    const [compactMode, setCompactMode] = useState(() => localStorage.getItem('messageDisplay') === 'compact');

    // Feature 19: Sticker Picker State
    const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
    const [guildStickers, setGuildStickers] = useState<Array<{ id: string; name: string; url: string; packName?: string }>>([]);

    // Formatting Toolbar State
    const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);

    // Embed Builder State
    const [showEmbedBuilder, setShowEmbedBuilder] = useState(false);

    // Member List Panel State
    const [memberListOpen, setMemberListOpen] = useState(() => localStorage.getItem('memberListOpen') !== 'false');

    // Chat File Attachment State
    const chatFileInputRef = useRef<HTMLInputElement>(null);
    const [chatAttachedFiles, setChatAttachedFiles] = useState<{name: string, size: string, file: File, previewUrl?: string, _placeholderId?: string}[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);

    // E2E Encryption state for guild channels
    const [channelE2EKey, setChannelE2EKey] = useState<CryptoKey | null>(null);
    const [channelIsEncrypted, setChannelIsEncrypted] = useState(false);
    const [channelKeyRecoveryRequired, setChannelKeyRecoveryRequired] = useState(false);
    const [channelE2EBootstrapNonce, setChannelE2EBootstrapNonce] = useState(0);
    const [channelAttachmentsEnabled, setChannelAttachmentsEnabled] = useState(true);
    const [channelKeyVersion, setChannelKeyVersion] = useState<number | null>(null);
    const e2eKeyPairRef = useRef<{ publicKey: CryptoKey; privateKey: CryptoKey } | null>(null);
    const [decryptedFileUrls, setDecryptedFileUrls] = useState<Map<string, { url: string; filename: string; mimeType: string }>>(new Map());
    const decryptInFlightRef = useRef(new Set<string>());
    const blobUrlsRef = useRef<string[]>([]);

    // Clean up blob URLs when channel changes or component unmounts
    useEffect(() => {
        return () => {
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            blobUrlsRef.current = [];
            decryptInFlightRef.current.clear();
            setDecryptedFileUrls(new Map());
        };
    }, [channelId]);

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [voiceExpiry, setVoiceExpiry] = useState<number | null>(null); // seconds; null = never

    // Voice Playback State
    const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);

    // Highlighted Message State
    const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);

    // Soundboard State
    const [soundboardOpen, setSoundboardOpen] = useState(false);

    // Jump-to-Date State
    const [showJumpToDate, setShowJumpToDate] = useState(false);
    const [jumpToDateLoading, setJumpToDateLoading] = useState(false);
    const [isViewingHistory, setIsViewingHistory] = useState(false);

    // Channel management permission state (admin/moderator only can set themes)
    const [canManageChannel, setCanManageChannel] = useState(false);

    // Mentions State
    const [mentionSearch, setMentionSearch] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);

    // Group mention confirmation state
    const [groupMentionConfirm, setGroupMentionConfirm] = useState<{ type: string; memberCount: number } | null>(null);

    // Channel autocomplete state
    const [channelSearch, setChannelSearch] = useState<string | null>(null);
    const [channelIndex, setChannelIndex] = useState(0);
    const [guildChannelsList, setGuildChannelsList] = useState<{ id: string; name: string; type?: string }[]>([]);

    // Slash command picker state
    const [slashSearch, setSlashSearch] = useState<string | null>(null);
    const [slashIndex, setSlashIndex] = useState(0);
    const [guildCommands, setGuildCommands] = useState<Array<{ id: string; name: string; description: string; options?: any[] }>>([]);

    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduledMessages, setScheduledMessages] = useState<Array<{ id: string; content: string; scheduledAt: string }>>([]);

    // Draft state
    const [hasDraft, setHasDraft] = useState(false);
    const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Upload progress per file (0–100; -1 = failed)
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    // Flag to skip re-processing our own storage events
    const isLocalStorageDispatchRef = useRef(false);
    // Undo history buffer (last 50 textarea values)
    const undoBufferRef = useRef<string[]>([]);

    // Mentions display map: maps display token (@username) to wire format (<@userId>)
    const mentionsMapRef = useRef<Map<string, string>>(new Map());

    const resolveWireContent = useCallback((text: string) => {
        let result = text;
        mentionsMapRef.current.forEach((wire, display) => {
            result = result.split(display).join(wire);
        });
        return result;
    }, []);

    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [pollDuration, setPollDuration] = useState<number | null>(null); // minutes; null = no expiry
    const [pollMultiselect, setPollMultiselect] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [reactionTargetMessageApiId, setReactionTargetMessageApiId] = useState<string | null>(null);
    const [emojiSearch, setEmojiSearch] = useState<string | null>(null);
    const [emojiIndex, setEmojiIndex] = useState(0);

    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [messagesError, setMessagesError] = useState(false);
    const [profilePopover, setProfilePopover] = useState<{ user: string; userId: string; x: number; y: number } | null>(null);

    // Guild custom emojis for rendering :emojiName: in messages
    const [guildCustomEmojis, setGuildCustomEmojis] = useState<Array<{ name: string; url: string }>>([]);

    // Ctrl+F Search State
    const [showSearchBar, setShowSearchBar] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchMessagesApiResponse['results']>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ambient / Hype state
    const [roomVelocity, setRoomVelocity] = useState(0);
    const isHypeMode = roomVelocity >= 5;

    // Bulk message selection state
    const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

    const { openMenu } = useContextMenu();
    const { addToast } = useToast();
    const [currentUserName, setCurrentUserName] = useState('');
    const [currentUserId, setCurrentUserId] = useState('');
    const [currentUserAvatarHash, setCurrentUserAvatarHash] = useState<string | null>(null);
    const [channelName, setChannelName] = useState('general');
    const [channelTopic, setChannelTopic] = useState<string | null>(null);
    const [rateLimitPerUser, setRateLimitPerUser] = useState(0);
    const [lastSentAt, setLastSentAt] = useState<number | null>(null);
    const [slowRemaining, setSlowRemaining] = useState(0);
    const [isAnnouncementChannel, setIsAnnouncementChannel] = useState(false);
    const [channelForumTags, setChannelForumTags] = useState<Array<{ id: string; name: string; color?: string }>>([]);
    const [channelTypeStr, setChannelTypeStr] = useState('');
    const [channelDisappearTimer, setChannelDisappearTimer] = useState<number | null>(null);

    const loadOrBootstrapChannelKeyPair = useCallback(async () => {
        if (!currentUserId) return null;

        const localResult = await getOrCreateKeyPair(currentUserId, { createIfMissing: false });
        const remoteKeyState = await api.encryption.getPublicKey(currentUserId);

        if (localResult) {
            const localPublicKeyJwk = await exportPublicKey(localResult.keyPair.publicKey);
            if (!remoteKeyState.publicKeyJwk) {
                // No server key yet — upload local key
                await api.encryption.uploadPublicKey(localPublicKeyJwk);
                return localResult;
            }
            if (remoteKeyState.publicKeyJwk === localPublicKeyJwk) {
                // Keys match — all good
                return localResult;
            }
            // Local key differs from server — fall through to generate a fresh key pair.
        }

        // No local key (or stale key) — generate fresh key pair and upload.
        // Old encrypted messages will be unreadable but the user can communicate going forward.
        const created = await getOrCreateKeyPair(currentUserId);
        if (!created) return null;
        await api.encryption.uploadPublicKey(await exportPublicKey(created.keyPair.publicKey));
        return created;
    }, [currentUserId]);

    useEffect(() => {
        const handleKeyRestored = () => {
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            blobUrlsRef.current = [];
            decryptInFlightRef.current.clear();
            e2eKeyPairRef.current = null;
            setChannelKeyRecoveryRequired(false);
            setChannelE2EKey(null);
            setChannelKeyVersion(null);
            setDecryptedFileUrls(new Map());
            setMessages(prev => prev.map(m => m.isEncrypted ? { ...m, content: '[Encrypted message]' } : m));
            setChannelE2EBootstrapNonce(prev => prev + 1);
        };

        window.addEventListener('gratonite:e2e-key-restored', handleKeyRestored);
        return () => window.removeEventListener('gratonite:e2e-key-restored', handleKeyRestored);
    }, []);

    // Slowmode countdown timer
    useEffect(() => {
        if (!lastSentAt || !rateLimitPerUser) return;
        const tick = () => {
            const remaining = Math.max(0, rateLimitPerUser - Math.floor((Date.now() - lastSentAt) / 1000));
            setSlowRemaining(remaining);
            if (remaining === 0) clearInterval(interval);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [lastSentAt, rateLimitPerUser]);

    // API 429 rate-limit cooldown with countdown
    const [rateLimitRemaining, setRateLimitRemaining] = useState(0);
    useEffect(() => {
        const handler = (e: Event) => {
            const { retryAfter } = (e as CustomEvent).detail ?? {};
            const seconds = Math.ceil((retryAfter || 5000) / 1000);
            setRateLimitRemaining(seconds);
        };
        window.addEventListener('gratonite:rate-limited', handler);
        return () => window.removeEventListener('gratonite:rate-limited', handler);
    }, []);
    useEffect(() => {
        if (rateLimitRemaining <= 0) return;
        const id = setInterval(() => {
            setRateLimitRemaining(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(id);
    }, [rateLimitRemaining]);

    // Typing indicator state: map of userId -> username, with auto-expiry
    const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
    const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const lastTypingSentRef = useRef(0);

    // Feature 13: Listen for storage events to sync compact mode across tabs
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'messageDisplay') {
                setCompactMode(e.newValue === 'compact');
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // t3-read-unread: sync read state across tabs via storage events
    useEffect(() => {
        if (!channelId) return;
        const handleStorage = (e: StorageEvent) => {
            if (e.key === `gratonite:read-state:${channelId}` && e.newValue) {
                // Another tab marked this channel as read — mirror the change
                markRead(channelId);
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [channelId]);

    // Fetch current user info
    useEffect(() => {
        api.users.getMe().then(me => {
            setCurrentUserName(me.profile?.displayName || me.username);
            setCurrentUserId(me.id);
            setCurrentUserAvatarHash(me.profile?.avatarHash ?? null);
        }).catch(() => { addToast({ title: 'Failed to load user info', variant: 'error' }); });
    }, []);

    // Feature 9: Fetch last read message ID before marking as read
    useEffect(() => {
        if (!channelId) return;
        api.messages.getReadState(channelId).then((states: any[]) => {
            // Find current user's read state (works for both guild and DM channels)
            const myState = states.find((s: any) => s.userId === currentUserId) || states[0];
            if (myState?.lastReadMessageId) {
                setLastReadMessageId(myState.lastReadMessageId);
            } else {
                setLastReadMessageId(null);
            }
            // Feature 12: Store other users' read states for read receipts
            setOtherReadStates(states.filter((s: any) => s.userId !== currentUserId).map((s: any) => ({ userId: s.userId, lastReadMessageId: s.lastReadMessageId })));
        }).catch(() => { setLastReadMessageId(null); setOtherReadStates([]); });
    }, [channelId, currentUserId]);

    // Mark channel as read on mount — optimistic update with rollback on failure
    useEffect(() => {
        if (!channelId) return;
        markRead(channelId);
        api.messages.markRead(channelId).catch(() => {
            // Server failed to persist — restore unread indicator so it's not silently lost
            setChannelHasUnread(channelId);
        });
    }, [channelId]);

    // t3-read-unread: auto-mark as read when a new message arrives and the tab is focused.
    // Uses a 1.5s grace period so the user has a moment to see the notification badge.
    const autoMarkReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (autoMarkReadTimerRef.current) clearTimeout(autoMarkReadTimerRef.current);
        };
    }, [channelId]);
    const scheduleAutoMarkRead = useCallback(() => {
        if (!channelId) return;
        if (autoMarkReadTimerRef.current) clearTimeout(autoMarkReadTimerRef.current);
        autoMarkReadTimerRef.current = setTimeout(() => {
            if (document.visibilityState !== 'hidden') {
                markRead(channelId);
                // Broadcast to other tabs so their sidebar badges clear immediately
                try { localStorage.setItem(`gratonite:read-state:${channelId}`, Date.now().toString()); } catch { /* ignore */ }
                api.messages.markRead(channelId).catch(() => {});
            }
        }, 1500);
    }, [channelId]);

    // Listen for remote typing events
    useEffect(() => {
        if (!channelId) return;
        const unsub = onTypingStart((payload: TypingStartPayload) => {
            if (payload.channelId !== channelId) return;
            if (payload.userId === currentUserId) return;
            setTypingUsers(prev => {
                const next = new Map(prev);
                next.set(payload.userId, payload.username);
                return next;
            });
            // Clear existing timer for this user
            const existing = typingTimersRef.current.get(payload.userId);
            if (existing) clearTimeout(existing);
            // Auto-expire after 8s
            const timer = setTimeout(() => {
                setTypingUsers(prev => {
                    const next = new Map(prev);
                    next.delete(payload.userId);
                    return next;
                });
                typingTimersRef.current.delete(payload.userId);
            }, 8000);
            typingTimersRef.current.set(payload.userId, timer);
        });
        return () => {
            unsub();
            typingTimersRef.current.forEach(t => clearTimeout(t));
            typingTimersRef.current.clear();
            setTypingUsers(new Map());
        };
    }, [channelId, currentUserId]);

    // Send typing indicator (throttled to once per 5s)
    const sendTypingIndicator = useCallback(() => {
        if (!channelId) return;
        const now = Date.now();
        if (now - lastTypingSentRef.current < 5000) return;
        lastTypingSentRef.current = now;
        api.messages.startTyping(channelId).catch(() => { /* ignore */ });
    }, [channelId]);

    // Ctrl+F keyboard shortcut to open search + Ctrl+Shift+P for markdown preview
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Feature 5: Ctrl+Shift+P to toggle markdown preview
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                setShowPreview(p => !p);
                return;
            }
            // Ctrl+E: Toggle emoji picker
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                setIsEmojiPickerOpen(prev => !prev);
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setShowSearchBar(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
            if (e.key === 'Escape' && selectionMode) {
                setSelectionMode(false);
                setSelectedMessages(new Set());
            }
            if (e.key === 'Escape' && showSearchBar) {
                setShowSearchBar(false);
                setSearchQuery('');
                setSearchResults([]);
                setCurrentSearchIndex(0);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showSearchBar, selectionMode]);

    const handleMessageShiftClick = useCallback((e: React.MouseEvent, messageApiId: string | undefined) => {
        if (e.shiftKey && messageApiId && canManageChannel) {
            e.preventDefault();
            setSelectionMode(true);
            setSelectedMessages(prev => {
                const next = new Set(prev);
                if (next.has(messageApiId)) next.delete(messageApiId); else next.add(messageApiId);
                return next;
            });
        }
    }, [canManageChannel]);

    const handleBulkDelete = useCallback(async () => {
        if (!channelId || selectedMessages.size === 0) return;
        setConfirmDialog({
            title: `Delete ${selectedMessages.size} message${selectedMessages.size === 1 ? '' : 's'}?`,
            description: 'This action cannot be undone.',
            onConfirm: async () => {
                try {
                    await api.messages.bulkDelete(channelId, [...selectedMessages]);
                    setMessages(prev => prev.filter(m => !m.apiId || !selectedMessages.has(m.apiId)));
                    addToast({ title: `Deleted ${selectedMessages.size} messages`, variant: 'success' });
                } catch {
                    addToast({ title: 'Bulk delete failed', variant: 'error' });
                }
                setSelectedMessages(new Set());
                setSelectionMode(false);
            },
        });
    }, [channelId, selectedMessages, addToast]);

    // Debounced search API call
    const performSearch = useCallback((query: string) => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (!query.trim() || !channelId) {
            setSearchResults([]);
            setCurrentSearchIndex(0);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const res = await api.search.messages({ query: query.trim(), channelId, limit: 50 });
                setSearchResults(res.results || []);
                setCurrentSearchIndex(0);
                if (res.results && res.results.length > 0) {
                    // Scroll to first result
                    const firstId = res.results[0].id;
                    const el = document.querySelector(`[data-message-id="${firstId}"]`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setHighlightedMessageId(parseInt(firstId, 36) || 0);
                        setTimeout(() => setHighlightedMessageId(null), 2500);
                    }
                }
            } catch {
                addToast({ title: 'Search failed', variant: 'error' });
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    }, [channelId, addToast]);

    const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchQuery(val);
        performSearch(val);
    }, [performSearch]);

    const navigateSearchResult = useCallback((direction: 'up' | 'down') => {
        if (searchResults.length === 0) return;
        let newIndex: number;
        if (direction === 'down') {
            newIndex = (currentSearchIndex + 1) % searchResults.length;
        } else {
            newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        }
        setCurrentSearchIndex(newIndex);
        const resultId = searchResults[newIndex].id;
        const el = document.querySelector(`[data-message-id="${resultId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMessageId(parseInt(resultId, 36) || 0);
            setTimeout(() => setHighlightedMessageId(null), 2500);
        }
    }, [searchResults, currentSearchIndex]);

    const closeSearch = useCallback(() => {
        setShowSearchBar(false);
        setSearchQuery('');
        setSearchResults([]);
        setCurrentSearchIndex(0);
        setIsSearching(false);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    }, []);

    // Fetch channel info for name
    useEffect(() => {
        if (channelId) {
            api.channels.get(channelId).then(async (rawCh) => {
                const ch = rawCh as ChannelDetail;
                setChannelName(ch.name);
                setChannelTypeStr(ch.type || '');
                setChannelTopic(ch.topic || null);
                setRateLimitPerUser(ch.rateLimitPerUser || 0);
                setChannelIsEncrypted(!!ch.isEncrypted);
                setChannelAttachmentsEnabled(ch.attachmentsEnabled !== false);
                setIsAnnouncementChannel(!!(ch as any).isAnnouncement);
                if (Array.isArray((ch as any).forumTags)) setChannelForumTags((ch as any).forumTags);
                if ((ch as any).disappearTimer != null) setChannelDisappearTimer((ch as any).disappearTimer);
                // Item 89: Track recent channels
                if (guildId) {
                    addRecentChannel({ id: channelId!, name: ch.name, guildId, type: ch.type || 'text' });
                }
                // Load channel background if set (for all users to see same theme)
                if (ch.backgroundUrl) {
                    setBgMedia({
                        url: ch.backgroundUrl,
                        type: (ch.backgroundType || 'image') as MediaType
                    });
                }
                // Load E2E encryption key if channel is encrypted
                if (ch.isEncrypted && guildId && currentUserId) {
                    try {
                        const result = await loadOrBootstrapChannelKeyPair();
                        if (!result) {
                            setChannelKeyRecoveryRequired(false);
                            setChannelE2EKey(null);
                            setChannelKeyVersion(null);
                            return;
                        }
                        if ('missingLocalKey' in result) {
                            setChannelKeyRecoveryRequired(true);
                            setChannelE2EKey(null);
                            setChannelKeyVersion(null);
                            return;
                        }
                        setChannelKeyRecoveryRequired(false);
                        e2eKeyPairRef.current = result.keyPair;
                        const encKeyData = await api.channels.getEncryptionKeys(guildId, channelId);
                        setChannelKeyVersion(encKeyData.version ?? null);
                        const myWrappedKey = (encKeyData.keyData as Record<string, string>)[currentUserId];
                        if (myWrappedKey) {
                            const groupKey = await decryptGroupKey(myWrappedKey, result.keyPair.privateKey);
                            setChannelE2EKey(groupKey);
                        } else {
                            setChannelE2EKey(null);
                        }
                    } catch { /* No key available yet — show placeholder */ }
                } else {
                    setChannelKeyRecoveryRequired(false);
                    setChannelE2EKey(null);
                    setChannelKeyVersion(null);
                }
            }).catch(() => { addToast({ title: 'Failed to load channel info', variant: 'error' }); });
        }
    }, [channelId, setBgMedia, loadOrBootstrapChannelKeyPair, channelE2EBootstrapNonce]);

    // Group key rotation listener — when a member is added/removed, re-generate the group key
    useEffect(() => {
        if (!channelId || !guildId || !currentUserId || !channelIsEncrypted) return;
        const unsub = onGroupKeyRotationNeeded(async (payload: GroupKeyRotationNeededPayload) => {
            if (payload.channelId !== channelId) return;
            const myKeyPair = e2eKeyPairRef.current;
            if (!myKeyPair) return;

            // Check if current user is guild owner (responsible for generating the new key)
            let isOwner = false;
            try {
                const guild = await api.guilds.get(guildId);
                isOwner = guild.ownerId === currentUserId;
            } catch { return; }

            if (!isOwner) {
                // Non-owner: wait for the owner to generate & upload the new key, then fetch it
                await new Promise(r => setTimeout(r, 3000));
                try {
                    const encKeyData = await api.channels.getEncryptionKeys(guildId, channelId);
                    const myWrappedKey = (encKeyData.keyData as Record<string, string>)[currentUserId];
                    if (myWrappedKey) {
                        const groupKey = await decryptGroupKey(myWrappedKey, myKeyPair.privateKey);
                        if (groupKey) {
                            setChannelE2EKey(groupKey);
                            setChannelKeyVersion(encKeyData.version ?? null);
                        }
                    }
                } catch { /* will retry on next event */ }
                return;
            }

            // Owner: generate new group key and distribute to all guild members
            try {
                const members = await api.guilds.getMembers(guildId);
                const memberKeys = await Promise.all(
                    members.map(async (m: any) => {
                        const d = await api.encryption.getPublicKey(m.userId);
                        if (!d.publicKeyJwk) return { id: m.userId, key: null };
                        const key = await importPublicKey(d.publicKeyJwk).catch(() => null);
                        return { id: m.userId, key };
                    }),
                );

                const newGroupKey = await generateGroupKey();
                const encryptedKeys: Record<string, string> = {};
                for (const { id, key } of memberKeys) {
                    if (key) encryptedKeys[id] = await encryptGroupKey(newGroupKey, key);
                }
                // Ensure current user's key is included
                if (!encryptedKeys[currentUserId]) {
                    encryptedKeys[currentUserId] = await encryptGroupKey(newGroupKey, myKeyPair.publicKey);
                }

                const newVersion = (channelKeyVersion ?? 0) + 1;
                await api.channels.uploadEncryptionKeys(guildId, channelId, { version: newVersion, keyData: encryptedKeys });
                setChannelE2EKey(newGroupKey);
                setChannelKeyVersion(newVersion);
            } catch {
                // Key rotation failed — will retry on next event
            }
        });
        return unsub;
    }, [channelId, guildId, currentUserId, channelIsEncrypted, channelKeyVersion]);

    // Check if current user can manage channel (owner or has MANAGE_CHANNELS permission)
    useEffect(() => {
        if (!guildId || !currentUserId) return;
        api.guilds.get(guildId).then(guild => {
            // Check if user is guild owner
            if (guild.ownerId === currentUserId) {
                setCanManageChannel(true);
                return;
            }
            // For non-owners, check if any role grants MANAGE_CHANNELS, MANAGE_MESSAGES, or ADMINISTRATOR
            api.guilds.getMemberRoles(guildId, currentUserId).then((roles: any[]) => {
                const ADMINISTRATOR = 1n << 0n;
                const MANAGE_CHANNELS = 1n << 2n;
                const MANAGE_MESSAGES = 1n << 6n;
                const hasPermission = roles?.some((r: any) => {
                    const perms = BigInt(r.permissions || '0');
                    return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_CHANNELS) !== 0n || (perms & MANAGE_MESSAGES) !== 0n;
                });
                setCanManageChannel(!!hasPermission);
            }).catch(() => setCanManageChannel(false));
        }).catch(() => setCanManageChannel(false));
    }, [guildId, currentUserId]);

    const handleMessageContext = (e: React.MouseEvent, msg: Message) => {
        const isOwn = msg.authorId === currentUserId;
        openMenu(e, [
            { id: 'reply', label: 'Reply', icon: Reply, onClick: () => setReplyingTo({ id: msg.id, apiId: msg.apiId, author: msg.author, content: (msg.content || '').slice(0, 80) }) },
            ...(isOwn && msg.apiId ? [{
                id: 'edit', label: 'Edit Message', icon: Edit2, onClick: () => {
                    setEditingMessage({ id: msg.id, apiId: msg.apiId!, content: msg.content });
                    setEditContent(msg.content);
                }
            }] : []),
            { id: 'react', label: 'Add Reaction', icon: Smile, onClick: () => { setReactionTargetMessageApiId(msg.apiId || null); setIsEmojiPickerOpen(true); } },
            { id: 'forward', label: 'Forward Message', icon: Share2, onClick: () => setForwardingMessage(msg) },
            { id: 'thread', label: 'Create Thread', icon: MessageSquare, onClick: () => setActiveThreadMessage(msg) },
            {
                id: 'copy', label: 'Copy Text', icon: Copy, onClick: () => {
                    if (msg.content) copyToClipboard(msg.content);
                    addToast({ title: 'Copied to clipboard', variant: 'info' });
                }
            },
            {
                id: 'copy-link', label: 'Copy Message Link', icon: Link2, onClick: () => {
                    const link = msg.apiId
                        ? `${window.location.origin}/guild/${guildId}/channel/${channelId}?msg=${msg.apiId}`
                        : window.location.href;
                    copyToClipboard(link);
                    addToast({ title: 'Message link copied', variant: 'info' });
                }
            },
            {
                id: 'pin', label: pinnedMessages.some(p => p.id === msg.apiId) ? 'Unpin Message' : 'Pin Message', icon: Pin, onClick: () => {
                    if (!channelId || !msg.apiId) return;
                    const isPinned = pinnedMessages.some(p => p.id === msg.apiId);
                    if (isPinned) {
                        api.messages.unpin(channelId, msg.apiId).then(() => {
                            setPinnedMessages(prev => prev.filter(p => p.id !== msg.apiId));
                            addToast({ title: 'Message Unpinned', variant: 'success' });
                        }).catch(() => addToast({ title: 'Failed to unpin message', variant: 'error' }));
                    } else {
                        api.messages.pin(channelId, msg.apiId).then(() => {
                            addToast({ title: 'Message Pinned', variant: 'success' });
                            loadPinnedMessages();
                        }).catch(() => addToast({ title: 'Failed to pin message', variant: 'error' }));
                    }
                }
            },
            ...(msg.apiId ? [{
                id: 'bookmark', label: 'Bookmark Message', icon: Star, onClick: () => {
                    fetch(`${API_BASE}/users/@me/bookmarks`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messageId: msg.apiId }),
                    }).then(r => {
                        if (r.ok) addToast({ title: 'Message bookmarked', variant: 'success' });
                        else addToast({ title: 'Already bookmarked', variant: 'info' });
                    }).catch(() => addToast({ title: 'Failed to bookmark', variant: 'error' }));
                }
            }] : []),
            ...(msg.apiId ? [{
                id: 'remind', label: 'Remind Me', icon: Clock, onClick: () => {
                    const remindAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
                    api.reminders.create({ messageId: msg.apiId!, channelId: channelId!, remindAt, note: (msg.content || '').slice(0, 100) })
                      .then(() => addToast({ title: 'Reminder set for 1 hour', variant: 'success' }))
                      .catch(() => addToast({ title: 'Failed to set reminder', variant: 'error' }));
                }
            }] : []),
            ...(msg.apiId ? [{
                id: 'mark-unread', label: 'Mark as Unread', icon: Eye, onClick: () => {
                    if (!channelId || !msg.apiId) return;
                    // Find the message right before this one to set as the last-read position
                    const idx = messages.findIndex(m => m.id === msg.id);
                    const prevApiId = idx > 0 ? messages[idx - 1].apiId : undefined;
                    // Ack with the previous message ID (or clear read state if it's the first message)
                    api.messages.ack(channelId, prevApiId).then(() => {
                        setLastReadMessageId(prevApiId || null);
                        setChannelHasUnread(channelId);
                        addToast({ title: 'Marked as unread', variant: 'info' });
                    }).catch(() => addToast({ title: 'Failed to mark as unread', variant: 'error' }));
                }
            }] : []),
            { divider: true, id: 'div1', label: '', onClick: () => { } },
            ...(!isOwn ? [{
                id: 'report', label: 'Report Message', icon: Flag, color: 'var(--warning)', onClick: () => {
                    if (!msg.apiId) return;
                    api.reports.submit({ targetType: 'message', targetId: msg.apiId, reason: 'User reported' })
                      .then(() => addToast({ title: 'Report Submitted', description: `Message by ${msg.author} has been reported.`, variant: 'info' }))
                      .catch(() => addToast({ title: 'Failed to report message', variant: 'error' }));
                }
            }] : []),
            ...((isOwn || canManageChannel) ? [{
                id: 'delete', label: 'Delete Message', icon: Trash2, color: 'var(--error)', onClick: () => {
                    const removedMsg = messages.find(m => m.id === msg.id);
                    setMessages(prev => prev.filter(m => m.id !== msg.id));
                    addToast({
                        title: 'Message deleted',
                        variant: 'undo' as const,
                        onUndo: () => { if (removedMsg) setMessages(prev => [...prev, removedMsg].sort((a, b) => a.id - b.id)); },
                        onExpire: () => { if (channelId && msg.apiId) { api.messages.delete(channelId, msg.apiId).catch(() => { if (removedMsg) setMessages(prev => [...prev, removedMsg].sort((a, b) => a.id - b.id)); addToast({ title: 'Failed to delete message', variant: 'error' }); }); } },
                    });
                }
            }] : [])
        ]);
    };

    const handleUserContext = (e: React.MouseEvent, userId: string, username: string) => {
        if (!userId) return;
        const isOwnUser = userId === currentUserId;
        openMenu(e, [
            { id: 'profile', label: 'View Profile', icon: UserIcon, onClick: () => setProfilePopover({ user: username, userId, x: e.clientX, y: e.clientY }) },
            ...(!isOwnUser ? [{ id: 'dm', label: 'Send DM', icon: MessageSquare, onClick: () => {
                api.relationships.openDm(userId).then((dm: any) => navigate(`/dm/${dm.id}`)).catch(() => addToast({ title: 'Failed to open DM', variant: 'error' }));
            }}] : []),
            { divider: true, id: 'div-user-1', label: '', onClick: () => {} },
            { id: 'copy-id', label: 'Copy User ID', icon: Copy, onClick: () => { copyToClipboard(userId); addToast({ title: 'User ID copied', variant: 'info' }); }},
            ...(!isOwnUser && canManageChannel && guildId ? [
                { divider: true, id: 'div-user-2', label: '', onClick: () => {} },
                { id: 'kick', label: 'Kick Member', icon: ShieldAlert, color: 'var(--warning)', onClick: () => {
                    if (!confirm(`Kick ${username} from this server?`)) return;
                    api.guilds.kickMember(guildId, userId).then(() => addToast({ title: `${username} was kicked`, variant: 'success' })).catch(() => addToast({ title: 'Failed to kick member', variant: 'error' }));
                }},
                { id: 'ban', label: 'Ban Member', icon: Ban, color: 'var(--error)', onClick: () => {
                    if (!confirm(`Ban ${username} from this server?`)) return;
                    api.guilds.ban(guildId, userId, 'Banned via context menu').then(() => addToast({ title: `${username} was banned`, variant: 'success' })).catch(() => addToast({ title: 'Failed to ban member', variant: 'error' }));
                }},
            ] : []),
        ]);
    };

    // User cache for displaying author names from IDs
    const userCacheRef = useRef<Map<string, { username: string; displayName: string }>>(new Map());
    // Role color cache: userId -> hex color string of their highest role
    const roleColorCacheRef = useRef<Map<string, string>>(new Map());
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);

    // Pinned Messages Panel State
    const [showPinnedPanel, setShowPinnedPanel] = useState(false);
    const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
    const [pinBannerDismissed, setPinBannerDismissed] = useState<boolean>(() => {
        return sessionStorage.getItem(`gratonite:pin-banner-dismissed-${channelId}`) === '1';
    });
    const [pinBoardView, setPinBoardView] = useState(false);
    const [showThreadsPanel, setShowThreadsPanel] = useState(false);
    const [showNotesPanel, setShowNotesPanel] = useState(false);
    const [isLoadingPins, setIsLoadingPins] = useState(false);
    const [channelNotifLevel, setChannelNotifLevel] = useState<string>('default');
    const [showNotifDropdown, setShowNotifDropdown] = useState(false);

    const handleAddToReadLater = useCallback(() => {
        if (!channelId) return;
        const STORAGE_KEY = 'gratonite-read-later-queue';
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const items = saved ? JSON.parse(saved) : [];
            if (items.some((i: any) => i.id === channelId)) {
                addToast({ title: 'Already in Read Later', variant: 'info' });
                return;
            }
            items.push({
                id: channelId,
                type: 'channel',
                channelId,
                channelName,
                guildId,
                addedAt: new Date().toISOString(),
                unreadCount: 0,
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            addToast({ title: 'Added to Read Later', variant: 'success' });
        } catch {}
    }, [channelId, channelName, guildId, addToast]);

    const loadPinnedMessages = useCallback(async () => {
        if (!channelId) return;
        setIsLoadingPins(true);
        try {
            const pins = await api.messages.getPins(channelId);
            setPinnedMessages(pins || []);
        } catch {
            addToast({ title: 'Failed to load pinned messages', variant: 'error' });
        } finally {
            setIsLoadingPins(false);
        }
    }, [channelId]);

    const oldestMessageIdRef = useRef<string | null>(null);

    // Convert an API message into a local Message shape
    const convertApiMessage = (m: any): Message => {
        const authorInfo = userCacheRef.current.get(m.authorId);
        const authorName = m.author?.displayName || m.author?.username || authorInfo?.displayName || authorInfo?.username || m.authorId?.slice(0, 8) || 'Unknown';
        const attachments = Array.isArray(m.attachments) && m.attachments.length > 0 ? m.attachments : undefined;
        const isVoice = attachments?.length === 1 && attachments[0]?.mimeType?.startsWith('audio/');
        return {
            id: typeof m.id === 'string' ? parseInt(m.id, 36) || Date.now() : m.id,
            apiId: typeof m.id === 'string' ? m.id : undefined,
            authorId: m.authorId,
            author: authorName,
            system: m.type !== 0 && m.type !== undefined,
            avatar: authorName.charAt(0).toUpperCase(),
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: m.content || '',
            edited: m.edited || false,
            replyToId: m.replyToId || undefined,
            threadReplyCount: m.threadReplyCount ?? 0,
            isEncrypted: m.isEncrypted ?? false,
            encryptedContent: m.encryptedContent ?? null,
            attachments,
            ...(isVoice ? { type: 'voice' as const } : {}),
            reactions: Array.isArray(m.reactions) && m.reactions.length > 0 ? m.reactions : undefined,
            embeds: Array.isArray(m.embeds) && m.embeds.length > 0 ? m.embeds : undefined,
            authorRoleColor: m.authorId ? roleColorCacheRef.current.get(m.authorId) : undefined,
            authorAvatarHash: m.author?.avatarHash ?? null,
            authorNameplateStyle: (m.author as any)?.nameplateStyle ?? null,
            isBot: (m.author as any)?.isBot ?? false,
            isFederated: !!(m as any).isFederated,
            components: Array.isArray((m as any).components) && (m as any).components.length > 0 ? (m as any).components : undefined,
            expiresAt: m.expiresAt ?? null,
            _isAnnouncementChannel: isAnnouncementChannel,
            createdAt: m.createdAt ?? null,
        };
    };

    // Resolve author summaries for a batch of messages
    const resolveAuthors = async (authorIds: string[]) => {
        if (authorIds.length === 0) return;
        const unknownIds = authorIds.filter(id => !userCacheRef.current.has(id));
        if (unknownIds.length === 0) return;
        try {
            const summaries = await api.users.getSummaries(unknownIds);
            for (const s of summaries) {
                userCacheRef.current.set(s.id, { username: s.username, displayName: s.displayName });
            }
        } catch { /* ignore - will show IDs */ }
    };

    // Fetch messages from API
    const fetchMessages = useCallback(async (options?: { signal?: AbortSignal }) => {
        if (!channelId) {
            setIsLoadingMessages(false);
            return;
        }
        setIsLoadingMessages(true);
        setMessagesError(false);
        setHasMoreMessages(true);
        oldestMessageIdRef.current = null;
        try {
            const [apiMessages, apiPolls] = await Promise.all([
                api.messages.list(channelId, { limit: 50 }),
                api.polls.list(channelId).catch(() => [] as any[]),
            ]);
            // If this fetch was superseded by a newer one (channel changed), discard
            if (options?.signal?.aborted) return;
            const authorIds = [...new Set(apiMessages.map((m: any) => m.authorId))];
            await resolveAuthors(authorIds);
            if (options?.signal?.aborted) return;
            // API returns newest-first; reverse so oldest is at index 0 (top of chat)
            const converted = apiMessages.map(convertApiMessage).reverse();
            // Resolve reply references from loaded messages
            const apiMap = new Map(apiMessages.map((m: any) => [m.id, m]));
            for (const msg of converted) {
                if (msg.replyToId && apiMap.has(msg.replyToId)) {
                    const ref = apiMap.get(msg.replyToId);
                    const refAuthor = ref.author?.displayName || ref.author?.username || userCacheRef.current.get(ref.authorId)?.displayName || 'Unknown';
                    msg.replyToAuthor = refAuthor;
                    msg.replyToContent = (ref.content || '').slice(0, 100);
                }
            }
            // Merge polls into the message list, sorted by createdAt
            const pollMessages: Message[] = (apiPolls as any[]).map((poll: any) => ({
                id: Math.abs(parseInt(poll.id.replace(/-/g, '').slice(0, 8), 16)) || Date.now(),
                apiId: `poll:${poll.id}`,
                authorId: poll.creatorId,
                author: poll.creatorName || 'Unknown',
                system: false,
                avatar: (poll.creatorName || 'U').charAt(0).toUpperCase(),
                time: new Date(poll.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: '',
                createdAt: poll.createdAt,
                type: 'poll' as const,
                pollData: {
                    pollId: poll.id,
                    question: poll.question,
                    options: poll.options?.map((o: any) => ({ id: o.id, text: o.text, votes: o.voteCount ?? 0 })) ?? [],
                    totalVotes: poll.totalVoters ?? 0,
                    multipleChoice: poll.multipleChoice ?? false,
                    myVotes: poll.myVotes ?? [],
                },
            }));
            const merged = [...converted, ...pollMessages].sort((a, b) =>
                new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
            );
            setMessages(merged);
            if (apiMessages.length > 0) {
                // API returns newest-first; the last element is the oldest message
                oldestMessageIdRef.current = apiMessages[apiMessages.length - 1].id;
                // Ack with newest message ID so the read-state is persisted for next visit
                const latestMessageId = apiMessages[0].id;
                api.messages.ack(channelId, latestMessageId).catch(() => {});
            } else {
                api.messages.ack(channelId).catch(() => {});
            }
            if (apiMessages.length < 50) {
                setHasMoreMessages(false);
            }
        } catch {
            if (options?.signal?.aborted) return;
            setMessagesError(true);
        } finally {
            if (!options?.signal?.aborted) {
                setIsLoadingMessages(false);
            }
        }
    }, [channelId]);

    // Channel switch crossfade
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const prevChannelIdRef = useRef(channelId);
    useEffect(() => {
        if (prevChannelIdRef.current !== channelId && chatContainerRef.current) {
            const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!prefersReduced) {
                gsap.fromTo(chatContainerRef.current,
                    { opacity: 0, y: 8 },
                    { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }
                );
            }
        }
        prevChannelIdRef.current = channelId;
    }, [channelId]);

    useEffect(() => {
        setPinBannerDismissed(sessionStorage.getItem(`gratonite:pin-banner-dismissed-${channelId}`) === '1');
    }, [channelId]);

    // Reset state and fetch messages when channelId changes
    useEffect(() => {
        // Clear stale messages immediately so we don't show previous channel's messages
        setMessages([]);
        setIsLoadingMessages(true);
        setMessagesError(false);
        setHasMoreMessages(true);
        setIsViewingHistory(false);
        oldestMessageIdRef.current = null;

        const abortController = new AbortController();
        fetchMessages({ signal: abortController.signal });
        return () => { abortController.abort(); };
    }, [fetchMessages]);

    // Jump to a specific date — replaces current messages with a window around the target
    const handleJumpToDate = useCallback(async (dateStr: string) => {
        if (!channelId) return;
        setJumpToDateLoading(true);
        try {
            const result = await api.messages.jumpToDate(channelId, dateStr);
            const authorIds = [...new Set(result.messages.map((m: any) => m.authorId))];
            await resolveAuthors(authorIds);
            const converted = result.messages.map(convertApiMessage);
            // Resolve reply references
            const apiMap = new Map(result.messages.map((m: any) => [m.id, m]));
            for (const msg of converted) {
                if (msg.replyToId && apiMap.has(msg.replyToId)) {
                    const ref = apiMap.get(msg.replyToId);
                    msg.replyToAuthor = ref.author?.displayName || ref.author?.username || 'Unknown';
                    msg.replyToContent = (ref.content || '').slice(0, 100);
                }
            }
            setMessages(converted);
            setHasMoreMessages(true);
            if (result.messages.length > 0) {
                oldestMessageIdRef.current = result.messages[0].id;
            }
            // Highlight and scroll to the target message
            const targetConverted = converted.find(m => m.apiId === result.targetMessageId);
            if (targetConverted) {
                setHighlightedMessageId(targetConverted.id);
                setTimeout(() => setHighlightedMessageId(null), 3000);
                // Scroll to the target after render
                requestAnimationFrame(() => {
                    const el = document.querySelector(`[data-message-id="${result.targetMessageId}"]`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }
            setShowJumpToDate(false);
            setIsViewingHistory(true);
        } catch {
            addToast({ title: 'No messages found for this date', variant: 'error' });
        } finally {
            setJumpToDateLoading(false);
        }
    }, [channelId, addToast]);

    // Jump to a specific message by ID — used for notification click-through
    const handleJumpToMessage = useCallback(async (targetMessageId: string) => {
        if (!channelId) return;
        try {
            const result = await api.messages.jumpToMessage(channelId, targetMessageId);
            const authorIds = [...new Set(result.messages.map((m: any) => m.authorId))];
            await resolveAuthors(authorIds);
            const converted = result.messages.map(convertApiMessage);
            // Resolve reply references
            const apiMap = new Map(result.messages.map((m: any) => [m.id, m]));
            for (const msg of converted) {
                if (msg.replyToId && apiMap.has(msg.replyToId)) {
                    const ref = apiMap.get(msg.replyToId);
                    msg.replyToAuthor = ref.author?.displayName || ref.author?.username || 'Unknown';
                    msg.replyToContent = (ref.content || '').slice(0, 100);
                }
            }
            setMessages(converted);
            setHasMoreMessages(true);
            if (result.messages.length > 0) {
                oldestMessageIdRef.current = result.messages[0].id;
            }
            // Highlight and scroll to the target message
            const targetConverted = converted.find(m => m.apiId === result.targetMessageId);
            if (targetConverted) {
                setHighlightedMessageId(targetConverted.id);
                setTimeout(() => setHighlightedMessageId(null), 3000);
                requestAnimationFrame(() => {
                    const el = document.querySelector(`[data-message-id="${result.targetMessageId}"]`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                });
            }
            setIsViewingHistory(true);
        } catch {
            // Message may be deleted — just navigate to the channel normally
        }
    }, [channelId]);

    // Handle ?messageId= search param for notification click-through
    useEffect(() => {
        const messageId = searchParams.get('messageId');
        if (messageId && channelId) {
            handleJumpToMessage(messageId);
            // Clear the param so refresh doesn't re-jump
            setSearchParams({}, { replace: true });
        }
    }, [searchParams, channelId, handleJumpToMessage, setSearchParams]);

    // Load draft and scheduled messages when channel changes
    useEffect(() => {
        if (!channelId) return;
        mentionsMapRef.current.clear();
        // Fast-path: load draft from localStorage immediately (server will override)
        try {
            const localDraft = localStorage.getItem(`gratonite:draft:${channelId}`);
            if (localDraft) {
                setInputValue(localDraft);
                setHasDraft(true);
            } else {
                setInputValue('');
                setHasDraft(false);
            }
        } catch { /* ignore */ }
        // Load draft
        fetch(`${API_BASE}/channels/${channelId}/draft`, {
            headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
        }).then(r => r.ok ? r.json() : null).then(draft => {
            if (draft?.content) {
                // Convert wire-format mentions (<@userId>) back to display tokens (@username)
                mentionsMapRef.current.clear();
                let displayContent = draft.content as string;
                displayContent = displayContent.replace(/<@([a-zA-Z0-9_-]+)>/g, (match, uid) => {
                    const member = guildMembers.find(m => m.id === uid);
                    if (member) {
                        const displayToken = `@${member.username}`;
                        mentionsMapRef.current.set(displayToken, `<@${uid}>`);
                        return displayToken;
                    }
                    return match;
                });
                displayContent = displayContent.replace(/<#([a-zA-Z0-9_-]+)>/g, (match, cid) => {
                    const ch = guildChannelsList.find(c => c.id === cid);
                    if (ch) {
                        const displayToken = `#${ch.name}`;
                        mentionsMapRef.current.set(displayToken, `<#${cid}>`);
                        return displayToken;
                    }
                    return match;
                });
                setInputValue(displayContent);
                setHasDraft(true);
            } else {
                setHasDraft(false);
            }
        }).catch(() => {});
        // Load scheduled messages
        fetch(`${API_BASE}/channels/${channelId}/messages/scheduled`, {
            headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
        }).then(r => r.ok ? r.json() : []).then(data => {
            setScheduledMessages(Array.isArray(data) ? data : []);
        }).catch(() => {});
        // Load channel notification prefs
        api.channelNotifPrefs.get(channelId).then(data => {
            setChannelNotifLevel(data?.level || 'default');
        }).catch(() => {});
    }, [channelId]);

    // Load older messages when scrolling to top
    const loadOlderMessages = useCallback(async () => {
        if (!channelId || !hasMoreMessages || isLoadingOlder || !oldestMessageIdRef.current) return;
        setIsLoadingOlder(true);
        const el = parentRef.current;
        const prevScrollHeight = el ? el.scrollHeight : 0;
        const prevScrollTop = el ? el.scrollTop : 0;
        try {
            const olderMessages = await api.messages.list(channelId, { limit: 50, before: oldestMessageIdRef.current });
            if (olderMessages.length === 0) {
                setHasMoreMessages(false);
                return;
            }
            const authorIds = [...new Set(olderMessages.map((m: any) => m.authorId))];
            await resolveAuthors(authorIds);
            // API returns newest-first; reverse so oldest is first, then prepend
            const converted = olderMessages.map(convertApiMessage).reverse();
            // The last element in the API response (newest-first) is the oldest
            oldestMessageIdRef.current = olderMessages[olderMessages.length - 1].id;
            setMessages(prev => [...converted, ...prev]);
            if (olderMessages.length < 50) {
                setHasMoreMessages(false);
            }
            // Preserve scroll position after prepending older messages
            requestAnimationFrame(() => {
                if (el) {
                    el.scrollTop = el.scrollHeight - prevScrollHeight + prevScrollTop;
                }
            });
        } catch {
            addToast({ title: 'Failed to load older messages', variant: 'error' });
        } finally {
            setIsLoadingOlder(false);
        }
    }, [channelId, hasMoreMessages, isLoadingOlder, addToast]);

    // Fetch guild members for @mention autocomplete + role colors
    const [guildMembers, setGuildMembers] = useState<{ id: string; username: string; displayName: string; avatar?: string }[]>([]);
    useEffect(() => {
        if (guildId) {
            api.guilds.getMembers(guildId).then(async (members) => {
                const ids = members.map((m: any) => m.userId);
                if (ids.length === 0) return;

                // Fetch roles + summaries in parallel
                const [summaries, rolesData] = await Promise.all([
                    api.users.getSummaries(ids).catch(() => [] as any[]),
                    api.guilds.getRoles(guildId).catch(() => [] as any[]),
                ]);

                // Build sorted role map for computing highest role color
                const sortedRoles = (rolesData as any[]).sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0));
                const roleById = new Map(sortedRoles.map((r: any) => [r.id, r]));

                // Compute highest role color per member
                roleColorCacheRef.current.clear();
                for (const m of members as any[]) {
                    const memberRoleIds: string[] = m.roleIds || [];
                    let highestRole: any = null;
                    for (const rid of memberRoleIds) {
                        const r = roleById.get(rid);
                        if (r && (!highestRole || (r.position ?? 0) > (highestRole.position ?? 0))) {
                            highestRole = r;
                        }
                    }
                    if (highestRole && highestRole.color) {
                        roleColorCacheRef.current.set(m.userId, `#${highestRole.color.toString(16).padStart(6, '0')}`);
                    }
                }

                // Update existing messages with role colors
                setMessages(prev => prev.map(msg => {
                    if (msg.authorId && roleColorCacheRef.current.has(msg.authorId)) {
                        return { ...msg, authorRoleColor: roleColorCacheRef.current.get(msg.authorId) };
                    }
                    return msg;
                }));

                setGuildMembers((summaries as any[]).map((s: any) => ({
                    id: s.id,
                    username: s.username,
                    displayName: s.displayName,
                    avatar: s.avatarHash || undefined,
                })));
            }).catch(() => { addToast({ title: 'Failed to load member list', variant: 'error' }); });
        } else {
            roleColorCacheRef.current.clear();
        }
    }, [guildId]);

    // Fetch guild channels for #channel autocomplete
    useEffect(() => {
        if (!guildId) { setGuildChannelsList([]); return; }
        api.channels.getGuildChannels(guildId).then((channels: any[]) => {
            setGuildChannelsList(channels.map((c: any) => ({ id: c.id, name: c.name, type: c.type })));
        }).catch(() => {});
    }, [guildId]);

    // Fetch slash commands for this guild
    useEffect(() => {
        if (!guildId) { setGuildCommands([]); return; }
        api.guilds.getCommands(guildId).then((cmds: any[]) => {
            if (Array.isArray(cmds)) {
                setGuildCommands(cmds.map((c: any) => ({ id: c.id, name: c.name, description: c.description || '', options: c.options })));
            }
        }).catch(() => {});
    }, [guildId]);

    // Feature 19: Fetch guild stickers
    useEffect(() => {
        if (!guildId) { setGuildStickers([]); return; }
        fetch(`${API_BASE}/guilds/${guildId}/stickers`, {
            headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
        }).then(r => r.ok ? r.json() : []).then(data => {
            if (Array.isArray(data)) {
                setGuildStickers(data.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    url: s.assetUrl || '',
                    packName: s.packName || 'Stickers',
                })).filter((s: any) => s.url));
            }
        }).catch(() => {});
    }, [guildId]);

    // Fetch guild custom emojis for :name: rendering in messages
    useEffect(() => {
        if (!guildId) { setGuildCustomEmojis([]); return; }
        api.guilds.getEmojis(guildId).then((emojis: any[]) => {
            setGuildCustomEmojis(emojis.map((e: any) => ({
                name: e.name,
                url: e.imageHash ? `${API_BASE}/files/${e.imageHash}` : '',
            })).filter((e: { name: string; url: string }) => e.url));
        }).catch(() => {});
    }, [guildId]);

    const STANDARD_EMOJIS = [
        { name: 'smile', emoji: '😄' },
        { name: 'rocket', emoji: '🚀' },
        { name: 'fire', emoji: '🔥' },
        { name: 'skull', emoji: '💀' },
        { name: 'heart', emoji: '❤️' },
        { name: 'thumbsup', emoji: '👍' },
        { name: 'wave', emoji: '👋' },
        { name: 'laugh', emoji: '😂' },
        { name: 'thinking', emoji: '🤔' },
        { name: 'star', emoji: '⭐' },
    ];

    const allEmojis = [
        ...guildCustomEmojis.map(e => ({ name: e.name, emoji: e.url ? `custom:${e.name}:${e.url}` : e.name, isCustom: true, url: e.url })),
        ...STANDARD_EMOJIS.map(e => ({ ...e, isCustom: false, url: '' })),
    ];

    const filteredEmojis = allEmojis.filter(e =>
        emojiSearch !== null && e.name.toLowerCase().includes(emojiSearch.toLowerCase())
    );

    const [messages, setMessages] = useState<Message[]>([]);
    const messagesRef = useRef<Message[]>([]);
    const retryBackoffRef = useRef<Map<number, { attempts: number; nextAt: number }>>(new Map());

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Group mention entries shown at top of mention autocomplete
    const GROUP_MENTION_ENTRIES = [
        { id: '__everyone__', username: 'everyone', displayName: '@everyone — Notify all members', avatarHash: null },
        { id: '__here__', username: 'here', displayName: '@here — Notify online members', avatarHash: null },
        { id: '__channel__', username: 'channel', displayName: '@channel — Notify all members', avatarHash: null },
        { id: '__online__', username: 'online', displayName: '@online — Notify online members (same as @here)', avatarHash: null },
    ];

    const filteredUsers = React.useMemo(() => {
        if (mentionSearch === null) return [];
        const search = mentionSearch.toLowerCase();

        // Filter group mention entries
        const matchingGroups = GROUP_MENTION_ENTRIES.filter(g =>
            g.username.toLowerCase().includes(search)
        );

        const matching = guildMembers.filter(u =>
            u.username.toLowerCase().includes(search) || u.displayName.toLowerCase().includes(search)
        );
        // Smart sort: recently active in channel first, then alphabetical
        const recentAuthorIds = new Set<string>();
        // Use last 50 messages to determine "recently active" users
        for (let i = messages.length - 1; i >= Math.max(0, messages.length - 50); i--) {
            if (messages[i].authorId) recentAuthorIds.add(messages[i].authorId!);
        }
        const sortedUsers = matching.sort((a, b) => {
            const aRecent = recentAuthorIds.has(a.id) ? 0 : 1;
            const bRecent = recentAuthorIds.has(b.id) ? 0 : 1;
            if (aRecent !== bRecent) return aRecent - bRecent;
            return a.displayName.localeCompare(b.displayName);
        });
        return [...matchingGroups, ...sortedUsers] as typeof guildMembers;
    }, [guildMembers, mentionSearch, messages]);

    const filteredChannels = guildChannelsList.filter(c =>
        channelSearch !== null &&
        c.name.toLowerCase().includes(channelSearch.toLowerCase())
    );

    // Close mention popup when there are no matching results
    useEffect(() => {
        if (mentionSearch !== null && filteredUsers.length === 0) {
            setMentionSearch(null);
        }
    }, [mentionSearch, filteredUsers]);

    // Cross-tab draft sync: listen for storage events from other tabs
    useEffect(() => {
        if (!channelId) return;
        const draftKey = `gratonite:draft:${channelId}`;
        const handler = (e: StorageEvent) => {
            if (e.key !== draftKey) return;
            if (isLocalStorageDispatchRef.current) return;
            if (e.newValue !== null) {
                setInputValue(e.newValue);
                setHasDraft(true);
            } else {
                setInputValue('');
                setHasDraft(false);
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, [channelId]);

    // Batch-decrypt encrypted messages when E2E key becomes available (for history messages)
    useEffect(() => {
        if (!channelE2EKey) return;
        const encryptedMsgs = messages.filter(m => m.isEncrypted && m.encryptedContent && m.content === '[Encrypted message]');
        if (encryptedMsgs.length === 0) return;

        (async () => {
            const updates: Array<{ id: number; content: string }> = [];
            for (const m of encryptedMsgs) {
                try {
                    const plain = await decrypt(channelE2EKey, m.encryptedContent!);
                    let text = plain;
                    try {
                        const parsed = JSON.parse(plain);
                        if (parsed && parsed._e2e === 2) {
                            text = parsed.text || '';
                            // Trigger file decryption for v2 payloads
                            if (Array.isArray(parsed.files) && parsed.files.length > 0 && m.attachments) {
                                for (const fileMeta of parsed.files) {
                                    const att = m.attachments.find((a: any) => a.id === fileMeta.id);
                                    if (att && !decryptInFlightRef.current.has(fileMeta.id)) {
                                        decryptInFlightRef.current.add(fileMeta.id);
                                        fetch(att.url).then(r => r.blob()).then(async (blob) => {
                                            const decrypted = await decryptFile(channelE2EKey, blob, fileMeta.iv, fileMeta.ef);
                                            const blobUrl = URL.createObjectURL(decrypted);
                                            blobUrlsRef.current.push(blobUrl);
                                            setDecryptedFileUrls(prev => {
                                                const next = new Map(prev);
                                                next.set(fileMeta.id, { url: blobUrl, filename: decrypted.name, mimeType: fileMeta.mt });
                                                return next;
                                            });
                                        }).catch(() => { decryptInFlightRef.current.delete(fileMeta.id); });
                                    }
                                }
                            }
                        }
                    } catch { /* not JSON — plain text */ }
                    updates.push({ id: m.id, content: text });
                } catch {
                    updates.push({ id: m.id, content: '[Encrypted message - unable to decrypt]' });
                }
            }
            if (updates.length > 0) {
                setMessages(prev => prev.map(m => {
                    const u = updates.find(u => u.id === m.id);
                    return u ? { ...m, content: u.content } : m;
                }));
            }
        })();
    }, [channelE2EKey, messages]);

    // Reset channel-specific UI state when switching channels (since the component
    // is reused across channels without a key-based remount)
    useEffect(() => {
        setReplyingTo(null);
        setEditingMessage(null);
        setEditContent('');
        setActiveThreadMessage(null);
        setForwardingMessage(null);
        setLightboxUrl(null);
        setLightboxZoom(1);
        setLightboxPan({ x: 0, y: 0 });
        setShowPinnedPanel(false);
        setPinnedMessages([]);
        setShowSearchBar(false);
        setSearchQuery('');
        setSearchResults([]);
        setTypingUsers(new Map());
        setHighlightedMessageId(null);
        setProfilePopover(null);
        setRoomVelocity(0);
        setShowPreview(false);
        setLastReadMessageId(null);
        setStickerPickerOpen(false);
    }, [channelId]);

    // Join/leave channel rooms for real-time events
    useEffect(() => {
        if (!channelId) return;
        socketJoinChannel(channelId);
        const unsubReconnect = onSocketReconnect(() => {
            socketJoinChannel(channelId);
            // Re-fetch read state after reconnect so the unread divider stays accurate
            api.messages.getReadState(channelId).then((states: any[]) => {
                const myState = states.find((s: any) => s.userId === currentUserId) || states[0];
                setLastReadMessageId(myState?.lastReadMessageId ?? null);
            }).catch(() => {});
        });
        return () => {
            unsubReconnect();
            socketLeaveChannel(channelId);
        };
    }, [channelId, currentUserId]);

    // Listen for channel background updates from other users/admins
    useEffect(() => {
        if (!channelId) return;
        return onChannelBackgroundUpdated((data) => {
            if (data.channelId !== channelId) return;
            if (data.backgroundUrl) {
                setBgMedia({ url: data.backgroundUrl, type: (data.backgroundType || 'image') as MediaType });
            } else {
                setBgMedia(null);
            }
        });
    }, [channelId, setBgMedia]);

    // Socket listener for real-time messages (create, update, delete)
    useEffect(() => {
        if (!channelId) return;

        const unsubCreate = onMessageCreate(async (data: MessageCreatePayload) => {
            if (data.channelId !== channelId) return;
            // Clear typing indicator for the user who sent a message
            if (data.authorId) {
                setTypingUsers(prev => {
                    if (!prev.has(data.authorId)) return prev;
                    const next = new Map(prev);
                    next.delete(data.authorId);
                    return next;
                });
                const existingTimer = typingTimersRef.current.get(data.authorId);
                if (existingTimer) {
                    clearTimeout(existingTimer);
                    typingTimersRef.current.delete(data.authorId);
                }
            }
            // Don't duplicate normal messages we sent optimistically.
            // Keep system events (e.g. FAME announcements) even when authored by us.
            if (data.authorId === currentUserId && !data.isSystem) return;
            const authorInfo = userCacheRef.current.get(data.authorId);
            const authorName = data.author?.displayName || data.author?.username || authorInfo?.displayName || authorInfo?.username || data.authorId?.slice(0, 8) || 'Unknown';
            // Resolve reply reference if present
            let replyToAuthor: string | undefined;
            let replyToContent: string | undefined;
            if ((data as any).replyToId) {
                setMessages(currentMsgs => {
                    const refMsg = currentMsgs.find(m => m.apiId === (data as any).replyToId);
                    if (refMsg) {
                        replyToAuthor = refMsg.author;
                        replyToContent = (refMsg.content || '').slice(0, 100);
                    }
                    return currentMsgs;
                });
            }
            const incomingPollData = (data as any).pollData;
            const incomingAttachments = Array.isArray((data as any).attachments) && (data as any).attachments.length > 0 ? (data as any).attachments : undefined;
            const isVoiceMsg = incomingAttachments?.length === 1 && incomingAttachments[0]?.mimeType?.startsWith('audio/');
            // Decrypt E2E encrypted messages if we have the key
            let decryptedContent = data.content || '';
            if ((data as any).isEncrypted && (data as any).encryptedContent && channelE2EKey) {
                try {
                    const plain = await decrypt(channelE2EKey, (data as any).encryptedContent);
                    // Check for structured E2E payload (v2 — includes file metadata)
                    try {
                        const parsed = JSON.parse(plain);
                        if (parsed && parsed._e2e === 2) {
                            decryptedContent = parsed.text || '';
                            // Decrypt file attachments in background
                            if (Array.isArray(parsed.files) && parsed.files.length > 0 && incomingAttachments) {
                                for (const fileMeta of parsed.files) {
                                    const att = incomingAttachments.find((a: any) => a.id === fileMeta.id);
                                    if (att && !decryptInFlightRef.current.has(fileMeta.id)) {
                                        decryptInFlightRef.current.add(fileMeta.id);
                                        fetch(att.url).then(r => r.blob()).then(async (blob) => {
                                            const decrypted = await decryptFile(channelE2EKey, blob, fileMeta.iv, fileMeta.ef);
                                            const blobUrl = URL.createObjectURL(decrypted);
                                            blobUrlsRef.current.push(blobUrl);
                                            setDecryptedFileUrls(prev => {
                                                const next = new Map(prev);
                                                next.set(fileMeta.id, { url: blobUrl, filename: decrypted.name, mimeType: fileMeta.mt });
                                                return next;
                                            });
                                        }).catch(() => { decryptInFlightRef.current.delete(fileMeta.id); });
                                    }
                                }
                            }
                        } else {
                            decryptedContent = plain;
                        }
                    } catch { decryptedContent = plain; /* not JSON — plain text */ }
                } catch {
                    decryptedContent = '[Encrypted message - unable to decrypt]';
                }
            } else if ((data as any).isEncrypted && !channelE2EKey) {
                decryptedContent = '[Encrypted message]';
            }
            setMessages(prev => [...prev, {
                id: typeof data.id === 'string' ? parseInt(data.id, 36) || Date.now() : data.id,
                apiId: data.id,
                authorId: data.authorId,
                author: data.isSystem ? 'System' : authorName,
                system: data.isSystem ?? false,
                avatar: authorName.charAt(0).toUpperCase(),
                time: new Date(data.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: decryptedContent,
                edited: data.edited || false,
                replyToId: (data as any).replyToId || undefined,
                replyToAuthor,
                replyToContent,
                isEncrypted: (data as any).isEncrypted ?? false,
                attachments: incomingAttachments,
                embeds: Array.isArray((data as any).embeds) && (data as any).embeds.length > 0 ? (data as any).embeds : undefined,
                authorRoleColor: data.authorId ? roleColorCacheRef.current.get(data.authorId) : undefined,
                authorAvatarHash: (data as any).author?.avatarHash ?? null,
                authorNameplateStyle: (data as any).author?.nameplateStyle ?? null,
                isBot: (data as any).author?.isBot ?? false,
                components: Array.isArray((data as any).components) && (data as any).components.length > 0 ? (data as any).components : undefined,
                expiresAt: data.expiresAt ?? null,
                createdAt: data.createdAt ?? null,
                ...(incomingPollData ? {
                    type: 'poll' as const,
                    pollData: {
                        pollId: incomingPollData.id,
                        question: incomingPollData.question,
                        options: incomingPollData.options?.map((o: any) => ({ id: o.id, text: o.text, votes: o.voteCount ?? 0 })) ?? [],
                        totalVotes: incomingPollData.totalVoters ?? 0,
                        multipleChoice: incomingPollData.multipleChoice ?? false,
                        myVotes: incomingPollData.myVotes ?? [],
                    },
                } : {}),
                ...(!incomingPollData && isVoiceMsg ? { type: 'voice' as const } : {}),
            }]);
            playSound('messageReceive');
            // Auto-mark as read when tab is focused (1.5s delay)
            scheduleAutoMarkRead();
        });

        const unsubUpdate = onMessageUpdate((data: MessageUpdatePayload) => {
            if (data.channelId !== channelId) return;
            setMessages(prev => prev.map(msg =>
                msg.apiId === data.id
                    ? { ...msg, content: data.content || '', edited: true }
                    : msg
            ));
        });

        const unsubDelete = onMessageDelete((data: MessageDeletePayload) => {
            if (data.channelId !== channelId) return;
            setMessages(prev => prev.filter(msg => msg.apiId !== data.id));
        });

        const unsubDeleteBulk = onMessageDeleteBulk((data: MessageDeleteBulkPayload) => {
            if (data.channelId !== channelId) return;
            const deletedSet = new Set(data.ids);
            setMessages(prev => prev.filter(msg => !msg.apiId || !deletedSet.has(msg.apiId)));
        });

        const unsubReactionAdd = onReactionAdd((data: ReactionPayload) => {
            if (data.channelId !== channelId) return;
            // Skip own reactions (handled optimistically)
            if (data.userId === currentUserId) return;
            setMessages(prev => prev.map(msg => {
                if (msg.apiId !== data.messageId) return msg;
                const existing = (msg.reactions || []).slice();
                const idx = existing.findIndex(r => r.emoji === data.emoji);
                if (idx >= 0) existing[idx] = { ...existing[idx], count: existing[idx].count + 1 };
                else existing.push({ emoji: data.emoji, count: 1, me: false });
                return { ...msg, reactions: existing };
            }));
        });

        const unsubReactionRemove = onReactionRemove((data: ReactionPayload) => {
            if (data.channelId !== channelId) return;
            if (data.userId === currentUserId) return;
            setMessages(prev => prev.map(msg => {
                if (msg.apiId !== data.messageId) return msg;
                const existing = (msg.reactions || []).slice();
                const idx = existing.findIndex(r => r.emoji === data.emoji);
                if (idx >= 0) {
                    if (existing[idx].count <= 1) existing.splice(idx, 1);
                    else existing[idx] = { ...existing[idx], count: existing[idx].count - 1 };
                }
                return { ...msg, reactions: existing };
            }));
        });

        // Listen for new thread creation — update the origin message to show thread indicator
        const unsubThreadCreate = onThreadCreate((data) => {
            if (data.channelId !== channelId || !data.originMessageId) return;
            setMessages(prev => prev.map(msg => {
                if (msg.apiId !== data.originMessageId) return msg;
                // Mark origin message as having a thread (set to 1 if it was 0)
                if ((msg.threadReplyCount ?? 0) === 0) {
                    return { ...msg, threadReplyCount: 1 };
                }
                return msg;
            }));
        });

        return () => { unsubCreate(); unsubUpdate(); unsubDelete(); unsubDeleteBulk(); unsubReactionAdd(); unsubReactionRemove(); unsubThreadCreate(); };
    }, [channelId, currentUserId, scheduleAutoMarkRead]);

    // Socket listener for MESSAGE_READ events (read receipts real-time update)
    useEffect(() => {
        if (!channelId) return;
        const socket = getSocket();
        if (!socket) return;
        const handler = (data: { channelId: string; userId: string; lastReadMessageId: string | null }) => {
            if (data.channelId !== channelId || data.userId === currentUserId) return;
            setOtherReadStates(prev => {
                const existing = prev.findIndex(s => s.userId === data.userId);
                const updated = { userId: data.userId, lastReadMessageId: data.lastReadMessageId };
                if (existing >= 0) {
                    const next = [...prev];
                    next[existing] = updated;
                    return next;
                }
                return [...prev, updated];
            });
        };
        socket.on('MESSAGE_READ', handler);
        return () => { socket.off('MESSAGE_READ', handler); };
    }, [channelId, currentUserId]);

    // Socket listener for embed updates (URL unfurling)
    useEffect(() => {
        if (!channelId) return;
        const socket = getSocket();
        if (!socket) return;
        const handler = ({ messageId, embeds }: { messageId: string; embeds: any[] }) => {
            setMessages(prev => prev.map(m =>
                m.apiId === messageId ? { ...m, embeds } : m
            ));
        };
        socket.on('MESSAGE_EMBED_UPDATE', handler);
        return () => { socket.off('MESSAGE_EMBED_UPDATE', handler); };
    }, [channelId]);

    // Socket listener for pin updates
    useEffect(() => {
        if (!channelId) return;

        const unsubPins = onChannelPinsUpdate((data: ChannelPinsUpdatePayload) => {
            if (data.channelId !== channelId) return;
            
            if (data.pinned) {
                // Message was pinned - reload pins if panel is open
                if (showPinnedPanel) {
                    loadPinnedMessages();
                }
            } else {
                // Message was unpinned - remove from local state
                setPinnedMessages(prev => prev.filter(p => p.id !== data.messageId));
            }
        });

        return () => { unsubPins(); };
    }, [channelId, showPinnedPanel]);

    // Silently load pins for the banner on channel open
    useEffect(() => {
        if (channelId) loadPinnedMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId]);

    // Decay velocity
    useEffect(() => {
        const interval = setInterval(() => {
            setRoomVelocity(prev => Math.max(0, prev - 0.25));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const parentRef = useRef<HTMLDivElement>(null);
    const isMobile = useIsMobile();

    // Pull-to-refresh: reload messages when user pulls down on mobile
    const { isRefreshing: isPullRefreshing, pullDistance } = usePullToRefresh(parentRef, {
        onRefresh: async () => {
            haptic.pullThreshold();
            await fetchMessages();
        },
        disabled: !isMobile,
    });

    const rowVirtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80, // estimated height of a message
        overscan: 10, // preload outside view for smooth scrolling
    });

    // Remove expired disappearing messages from the display list (A2)
    useEffect(() => {
        const now = Date.now();
        const hasAnyExpiry = messages.some(m => m.expiresAt);
        if (!hasAnyExpiry) return;
        // Immediately remove already-past-due messages
        setMessages(prev => {
            const filtered = prev.filter(m => !m.expiresAt || new Date(m.expiresAt).getTime() > Date.now());
            return filtered.length < prev.length ? filtered : prev;
        });
        // Schedule removal of the next-to-expire message
        const futureExpiries = messages
            .filter(m => m.expiresAt && new Date(m.expiresAt).getTime() > now)
            .map(m => new Date(m.expiresAt!).getTime())
            .sort((a, b) => a - b);
        if (futureExpiries.length === 0) return;
        const delay = futureExpiries[0] - Date.now() + 500;
        const timer = setTimeout(() => {
            setMessages(prev => prev.filter(m => !m.expiresAt || new Date(m.expiresAt).getTime() > Date.now()));
        }, delay);
        return () => clearTimeout(timer);
    }, [messages]);

    const scrollToBottom = useCallback(() => {
        if (messages.length > 0 && parentRef.current) {
            parentRef.current.scrollTop = parentRef.current.scrollHeight;
        }
    }, [messages.length]);

    // Load older messages when user scrolls near top + save scroll position
    const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const el = parentRef.current;
        if (!el) return;
        const handleScroll = () => {
            if (el.scrollTop < 200 && hasMoreMessages && !isLoadingOlder) {
                loadOlderMessages();
            }
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            const isScrolledUp = distFromBottom > 200;
            setShowScrollButton(isScrolledUp);
            if (!isScrolledUp) setNewMsgCount(0);
            // Debounced save of scroll position per channel
            if (channelId) {
                if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
                scrollSaveTimer.current = setTimeout(() => saveScrollPosition(channelId, el.scrollTop), 150);
            }
        };
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', handleScroll);
            if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
        };
    }, [hasMoreMessages, isLoadingOlder, loadOlderMessages, channelId]);

    // Track whether we need to scroll to bottom after initial load
    const needsInitialScrollRef = useRef(false);

    // On channel change: flag that we need to scroll once messages arrive
    useEffect(() => {
        needsInitialScrollRef.current = true;
    }, [channelId]);

    // After messages load/change: scroll to bottom if this is initial load, or if near bottom
    useEffect(() => {
        if (messages.length === 0) return;
        if (needsInitialScrollRef.current) {
            needsInitialScrollRef.current = false;
            // Restore saved scroll position, or scroll to unread divider, or scroll to bottom
            requestAnimationFrame(() => {
                if (!parentRef.current) return;
                const savedPos = channelId ? getScrollPosition(channelId) : null;
                if (savedPos !== null && savedPos > 0) {
                    parentRef.current.scrollTop = savedPos;
                } else {
                    const unreadDivider = parentRef.current.querySelector('.new-messages-divider');
                    if (unreadDivider) {
                        unreadDivider.scrollIntoView({ block: 'center' });
                    } else {
                        parentRef.current.scrollTop = parentRef.current.scrollHeight;
                    }
                }
            });
            return;
        }
        // On new message: only auto-scroll if user is near the bottom
        if (!parentRef.current) return;
        const el = parentRef.current;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom < 300) { scrollToBottom(); setNewMsgCount(0); }
        else setNewMsgCount(c => c + 1);
    }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (isRecording) {
            recordingInterval.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingInterval.current) clearInterval(recordingInterval.current);
        }
        return () => {
            if (recordingInterval.current) clearInterval(recordingInterval.current);
        };
    }, [isRecording]);

    const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) {
            addToast({ title: 'File too large', description: 'Background files must be under 25MB.', variant: 'error' });
            return;
        }
        const isVideo = file.type.startsWith('video/');
        const bgType: 'image' | 'video' = isVideo ? 'video' : 'image';

        try {
            // Upload the file via the files API to get a proper URL
            const uploaded = await api.files.upload(file);
            const url = uploaded.url;

            // Update local background immediately for this user
            setBgMedia({ url, type: bgType });

            // Persist to the channel so all users see the same background
            if (channelId) {
                await api.channels.update(channelId, { backgroundUrl: url, backgroundType: bgType });
                addToast({ title: 'Channel theme updated', description: 'All users in this channel will now see this background.', variant: 'success' });
            }

            setMessages(prev => [...prev, {
                id: Date.now(),
                author: 'System',
                system: true,
                avatar: <ImageIcon size={24} />,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: `${currentUserName || 'User'} updated the channel theme.`
            }]);
        } catch {
            addToast({ title: 'Failed to update channel theme', variant: 'error' });
        }
    };

    const emoticonMap: Record<string, string> = {
        ':)': '🙂', ':D': '😃', ':(': '🙁', ':O': '😲', ';)': '😉', ':/': '😕'
    };

    const processEmojis = (text: string) => {
        // Protect URLs from emoticon replacement (e.g. :/ in https://)
        const urlPlaceholders: string[] = [];
        let result = text.replace(/https?:\/\/[^\s]+/g, (url) => {
            urlPlaceholders.push(url);
            return `\x00URL${urlPlaceholders.length - 1}\x00`;
        });

        for (const [emoticon, emoji] of Object.entries(emoticonMap)) {
            const escapedEmoticon = emoticon.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
            const regex = new RegExp(`(?<!\\\\)${escapedEmoticon}`, 'g');
            result = result.replace(regex, emoji);
        }
        for (const emoticon of Object.keys(emoticonMap)) {
            const escapedEmoticon = emoticon.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
            const regex = new RegExp(`\\\\${escapedEmoticon}`, 'g');
            result = result.replace(regex, emoticon);
        }

        // Restore URLs
        const nul = String.fromCharCode(0);
        result = result.replace(new RegExp(`${nul}URL(\\d+)${nul}`, 'g'), (_, idx) => urlPlaceholders[Number(idx)]);

        result = result.replace(/(?<!\\):([a-zA-Z0-9_]+):/g, (match, name) => {
            const found = allEmojis.find(e => e.name === name);
            if (found) return found.isCustom && found.url ? `custom:${found.name}:${found.url}` : found.isCustom ? `:${found.name}:` : found.emoji;
            return match;
        });
        result = result.replace(/\\:([a-zA-Z0-9_]+):/g, ':$1:');
        return result;
    };

    const markRetryBackoff = useCallback((messageId: number) => {
        const prev = retryBackoffRef.current.get(messageId);
        const attempts = (prev?.attempts ?? 0) + 1;
        const delayMs = Math.min(60000, 1200 * (2 ** Math.max(0, attempts - 1)));
        retryBackoffRef.current.set(messageId, { attempts, nextAt: Date.now() + delayMs });
    }, []);

    const clearRetryBackoff = useCallback((messageId: number) => {
        retryBackoffRef.current.delete(messageId);
    }, []);

    const sendFailedMessage = useCallback((messageId: number, silent = false) => {
        const msg = messagesRef.current.find(m => m.id === messageId);
        if (!msg?._retryPayload || msg.sendStatus !== 'failed') return;

        if (!navigator.onLine) {
            markRetryBackoff(messageId);
            return;
        }

        const { channelId: cId, payload } = msg._retryPayload;
        setMessages(prev => prev.map(m =>
            m.id === messageId ? { ...m, sendStatus: 'sending' as const } : m
        ));

        api.messages.send(cId, payload).then((sent: any) => {
            if (sent?.id) {
                clearRetryBackoff(messageId);
                setMessages(prev => prev.map(m =>
                    m.id === messageId ? {
                        ...m,
                        apiId: sent.id,
                        authorId: sent.authorId,
                        authorAvatarHash: sent.author?.avatarHash ?? m.authorAvatarHash,
                        attachments: sent.attachments?.length > 0 ? sent.attachments : undefined,
                        sendStatus: undefined,
                        _retryPayload: undefined,
                    } : m
                ));
            }
        }).catch(() => {
            setMessages(prev => prev.map(m =>
                m.id === messageId ? { ...m, sendStatus: 'failed' as const } : m
            ));
            markRetryBackoff(messageId);
            if (!silent) {
                addToast({ title: 'Still trying to send message in background.', variant: 'error' });
            }
        });
    }, [addToast, clearRetryBackoff, markRetryBackoff]);

    const uploadWithProgress = useCallback(
        (file: File, purpose: string, onProgress: (pct: number) => void) =>
            new Promise<{ id: string; url: string; filename: string; size: number; mimeType: string }>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const fd = new FormData();
                fd.append('file', file);
                fd.append('purpose', purpose);
                xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
                    else reject(new Error(xhr.statusText));
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.open('POST', `${API_BASE}/files/upload`);
                const token = getAccessToken();
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(fd);
            }),
        [],
    );

    const handleSendMessage = async () => {
        if (channelTypeStr === 'GUILD_FORUM') {
            addToast({ title: 'Use New Post or forum replies to add content here.', variant: 'error' });
            return;
        }
        if (inputValue.trim() === '' && chatAttachedFiles.length === 0) return;
        if (!channelId) return;

        // Check for group mentions and show confirmation if not already confirmed
        if (!groupMentionConfirm) {
            const groupMentionRe = /@(everyone|here|channel|online)\b/;
            const gm = groupMentionRe.exec(inputValue);
            if (gm) {
                const memberCount = guildMembers.length;
                setGroupMentionConfirm({ type: gm[1], memberCount });
                return; // Wait for confirmation
            }
        }
        // Clear confirmation state (user confirmed or no group mention)
        setGroupMentionConfirm(null);

        const wireContent = resolveWireContent(inputValue);
        if (wireContent.length > 2000) {
            addToast({ title: `Message too long (${wireContent.length}/2000)`, variant: 'error' });
            return;
        }
        if (slowRemaining > 0) {
            addToast({ title: `Slowmode active. Wait ${slowRemaining}s`, variant: 'error' });
            return;
        }
        if (rateLimitRemaining > 0) {
            addToast({ title: `Rate limited. Wait ${rateLimitRemaining}s`, variant: 'error' });
            return;
        }
        // Handle /remind command locally
        const remindMatch = inputValue.match(/^\/remind\s+(\S+)\s+(.+)/i);
        if (remindMatch) {
            const timeMs = parseRemindTime(remindMatch[1]);
            if (!timeMs) {
                addToast({ title: 'Invalid time format. Use e.g. 30m, 2h, 1d', variant: 'error' });
                return;
            }
            const remindAt = new Date(Date.now() + timeMs).toISOString();
            try {
                const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
                await api.reminders.create({
                    messageId: lastMsg?.apiId || 'self',
                    channelId: channelId!,
                    remindAt,
                    note: remindMatch[2],
                });
                addToast({ title: 'Reminder set', description: `I'll remind you: ${remindMatch[2]}`, variant: 'success' });
            } catch {
                addToast({ title: 'Failed to set reminder', variant: 'error' });
            }
            setInputValue('');
            return;
        }

        playSound('messageSend');
        haptic.messageSent();

        const processedContent = processEmojis(wireContent);

        // Upload attached files — encrypt if channel has E2E enabled
        let attachmentIds: string[] = [];
        const encryptedFileMeta: Array<{ id: string; iv: string; ef: string; mt: string }> = [];
        if (chatAttachedFiles.length > 0) {
            setUploadProgress(Object.fromEntries(chatAttachedFiles.map(f => [f.name, 0])));
            try {
                if (channelE2EKey && channelIsEncrypted) {
                    for (const f of chatAttachedFiles) {
                        const { encryptedBlob, encryptedFilename, iv } = await encryptFile(channelE2EKey, f.file);
                        const encFile = new File([encryptedBlob], 'encrypted.bin', { type: 'application/octet-stream' });
                        let result: { id: string; url: string; filename: string; size: number; mimeType: string };
                        try {
                            result = await uploadWithProgress(encFile, 'attachment', (pct) => {
                                setUploadProgress(prev => ({ ...prev, [f.name]: pct }));
                            });
                        } catch (fileErr) {
                            setUploadProgress(prev => ({ ...prev, [f.name]: -1 }));
                            throw fileErr;
                        }
                        attachmentIds.push(result.id);
                        encryptedFileMeta.push({ id: result.id, iv, ef: encryptedFilename, mt: f.file.type || 'application/octet-stream' });
                    }
                } else {
                    const uploadResults = await Promise.all(
                        chatAttachedFiles.map(async (f) => {
                            try {
                                const result = await uploadWithProgress(f.file, 'attachment', (pct) => {
                                    setUploadProgress(prev => ({ ...prev, [f.name]: pct }));
                                });
                                return result;
                            } catch (fileErr) {
                                setUploadProgress(prev => ({ ...prev, [f.name]: -1 }));
                                throw fileErr;
                            }
                        })
                    );
                    attachmentIds = uploadResults.map(r => r.id);
                }
            } catch (uploadErr: any) {
                const detail = uploadErr?.body?.message || uploadErr?.message || '';
                addToast({ title: 'Failed to upload attachments', description: detail, variant: 'error' });
                return;
            }
        }

        // Build the reply reference for the optimistic message
        const replyToApiId = replyingTo?.apiId || undefined;
        const replyToAuthor = replyingTo?.author || undefined;
        const replyToContent = replyingTo?.content || undefined;

        // Build the send payload early so we can attach it to the optimistic message for retry
        const sendPayload: any = {
            content: processedContent || ' ',
            ...(replyToApiId ? { replyToId: replyToApiId } : {}),
            ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
        };
        if (channelE2EKey && channelIsEncrypted) {
            try {
                const plainPayload = encryptedFileMeta.length > 0
                    ? JSON.stringify({ _e2e: 2, text: processedContent || ' ', files: encryptedFileMeta })
                    : processedContent || ' ';
                const encrypted = await encrypt(channelE2EKey, plainPayload);
                sendPayload.content = '[Encrypted message]';
                sendPayload.isEncrypted = true;
                sendPayload.encryptedContent = encrypted;
            } catch {
                addToast({ title: 'Failed to encrypt message on this device', variant: 'error' });
                return;
            }
        }

        // Optimistic local message with "sending" status
        const optimisticId = Date.now();
        const optimisticCreatedAt = new Date().toISOString();
        setMessages(prev => [...prev, {
            id: optimisticId,
            authorId: currentUserId,
            author: currentUserName || 'You',
            system: false,
            avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: processedContent,
            createdAt: optimisticCreatedAt,
            sendStatus: 'sending',
            _retryPayload: { channelId, payload: sendPayload },
            ...(replyToApiId ? { replyToId: replyToApiId, replyToAuthor, replyToContent } : {}),
            authorRoleColor: currentUserId ? roleColorCacheRef.current.get(currentUserId) : undefined,
            authorAvatarHash: currentUserAvatarHash,
        }]);

        // Track slowmode
        if (rateLimitPerUser > 0) setLastSentAt(Date.now());

        // Send to API
        api.messages.send(channelId, sendPayload).then((sent: any) => {
            // Patch optimistic message with real API ID and clear sending status
            if (sent?.id) {
                clearRetryBackoff(optimisticId);
                setMessages(prev => prev.map(m =>
                    m.id === optimisticId ? {
                        ...m,
                        apiId: sent.id,
                        authorId: sent.authorId,
                        authorAvatarHash: sent.author?.avatarHash ?? m.authorAvatarHash,
                        attachments: sent.attachments?.length > 0 ? sent.attachments : undefined,
                        sendStatus: undefined,
                        _retryPayload: undefined,
                    } : m
                ));
            }
        }).catch(() => {
            // Mark as failed (keep message visible for retry)
            setMessages(prev => prev.map(m =>
                m.id === optimisticId ? { ...m, sendStatus: 'failed' as const } : m
            ));
            markRetryBackoff(optimisticId);
            addToast({ title: 'Message queued. Retrying automatically.', variant: 'error' });
        });

        setInputValue('');
        mentionsMapRef.current.clear();
        chatAttachedFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
        setChatAttachedFiles([]);
        setUploadProgress({});
        setReplyingTo(null);
        setMentionSearch(null);
        setChannelSearch(null);
        // Reset textarea height after send
        const ta = document.querySelector('.chat-input') as HTMLTextAreaElement | null;
        if (ta) ta.style.height = '24px';
        setEmojiSearch(null);
        setRoomVelocity(prev => Math.min(10, prev + 2));
        setHasDraft(false);
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };

    // Retry a failed optimistic message
    const handleRetryMessage = useCallback((messageId: number) => {
        sendFailedMessage(messageId, false);
    }, [sendFailedMessage]);

    // Dismiss a failed optimistic message
    const handleDismissFailedMessage = useCallback((messageId: number) => {
        setMessages(prev => prev.filter(m => m.id !== messageId));
    }, []);

    // Expose retry/dismiss to window for the MemoizedMessageItem buttons
    useEffect(() => {
        (window as any).__gratoniteRetryMessage = handleRetryMessage;
        (window as any).__gratoniteDismissMessage = handleDismissFailedMessage;
        return () => {
            delete (window as any).__gratoniteRetryMessage;
            delete (window as any).__gratoniteDismissMessage;
        };
    }, [handleRetryMessage, handleDismissFailedMessage]);

    // Background flush for failed outgoing messages (queue + exponential backoff)
    useEffect(() => {
        const flushFailed = () => {
            if (!navigator.onLine) return;
            const now = Date.now();
            const failed = messagesRef.current.filter(m => m.sendStatus === 'failed' && !!m._retryPayload);
            for (let i = 0; i < failed.length; i++) {
                const msg = failed[i];
                const meta = retryBackoffRef.current.get(msg.id);
                if (!meta || now >= meta.nextAt) {
                    sendFailedMessage(msg.id, true);
                }
            }
        };

        const intervalId = setInterval(flushFailed, 2500);
        window.addEventListener('online', flushFailed);
        return () => {
            clearInterval(intervalId);
            window.removeEventListener('online', flushFailed);
        };
    }, [sendFailedMessage]);

    // Edit message handler
    const handleEditSubmit = useCallback(async () => {
        if (!editingMessage || !channelId || !editContent.trim()) return;
        if (editContent.length > 2000) {
            addToast({ title: `Message too long (${editContent.length}/2000)`, variant: 'error' });
            return;
        }
        try {
            await api.messages.edit(channelId, editingMessage.apiId, { content: editContent.trim() });
            setMessages(prev => prev.map(m =>
                m.apiId === editingMessage.apiId ? { ...m, content: editContent.trim(), edited: true } : m
            ));
            setEditingMessage(null);
            setEditContent('');
        } catch {
            addToast({ title: 'Failed to edit message', variant: 'error' });
        }
    }, [editingMessage, channelId, editContent, addToast]);

    // Reaction handler — toggles add/remove via API
    const handleReaction = useCallback(async (messageApiId: string, emoji: string, alreadyReacted: boolean) => {
        if (!channelId || !messageApiId) return;
        haptic.reaction();

        // Optimistically update local state BEFORE the API call
        setMessages(prev => prev.map(m => {
            if (m.apiId !== messageApiId) return m;
            const existing = (m.reactions || []).slice();
            const idx = existing.findIndex((r: any) => r.emoji === emoji);
            if (alreadyReacted) {
                if (idx >= 0) {
                    if (existing[idx].count <= 1) existing.splice(idx, 1);
                    else existing[idx] = { ...existing[idx], count: existing[idx].count - 1, me: false };
                }
            } else {
                if (idx >= 0) existing[idx] = { ...existing[idx], count: existing[idx].count + 1, me: true };
                else existing.push({ emoji, count: 1, me: true });
            }
            return { ...m, reactions: existing };
        }));

        try {
            if (alreadyReacted) {
                await api.messages.removeReaction(channelId, messageApiId, emoji);
            } else {
                await api.messages.addReaction(channelId, messageApiId, emoji);
            }
        } catch {
            // Revert on failure
            setMessages(prev => prev.map(m => {
                if (m.apiId !== messageApiId) return m;
                const existing = (m.reactions || []).slice();
                const idx = existing.findIndex((r: any) => r.emoji === emoji);
                if (alreadyReacted) {
                    // Revert removal: re-add the reaction
                    if (idx >= 0) existing[idx] = { ...existing[idx], count: existing[idx].count + 1, me: true };
                    else existing.push({ emoji, count: 1, me: true });
                } else {
                    // Revert addition: remove the reaction
                    if (idx >= 0) {
                        if (existing[idx].count <= 1) existing.splice(idx, 1);
                        else existing[idx] = { ...existing[idx], count: existing[idx].count - 1, me: false };
                    }
                }
                return { ...m, reactions: existing };
            }));
        }
    }, [channelId]);

    const handleSendGif = (url: string, _previewUrl: string) => {
        const optimisticId = Date.now();
        setMessages(prev => [...prev, {
            id: optimisticId,
            authorId: currentUserId,
            author: currentUserName,
            system: false,
            avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: url,
            createdAt: new Date().toISOString(),
            type: 'media' as const,
            mediaUrl: url,
            mediaAspectRatio: 16 / 9
        }]);
        setIsEmojiPickerOpen(false);
        setReactionTargetMessageApiId(null);
        if (channelId) {
            api.messages.send(channelId, { content: url } as any).then((sent: any) => {
                if (sent?.id) {
                    setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, apiId: sent.id } : m));
                }
            }).catch(() => {
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
                addToast({ title: 'Failed to send GIF', variant: 'error' });
            });
        }
    };

    const handleSendSticker = (sticker: { id: string; name: string; url: string }) => {
        const optimisticId = Date.now();
        setMessages(prev => [...prev, {
            id: optimisticId,
            authorId: currentUserId,
            author: currentUserName || 'You',
            system: false,
            avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: '',
            createdAt: new Date().toISOString(),
            attachments: [{ id: sticker.id, url: sticker.url, filename: sticker.name, size: 0, mimeType: 'image/png', type: 'sticker' } as any],
        }]);
        setIsEmojiPickerOpen(false);
        setReactionTargetMessageApiId(null);
        if (channelId) {
            api.messages.send(channelId, { content: ' ', stickerId: sticker.id } as any).then((sent: any) => {
                if (sent?.id) {
                    setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, apiId: sent.id } : m));
                }
            }).catch(() => {
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
                addToast({ title: 'Failed to send sticker', variant: 'error' });
            });
        }
    };

    const cursorPosRef = useRef(0);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart ?? val.length;
        cursorPosRef.current = cursor;
        // Push current value onto undo buffer before updating
        undoBufferRef.current = [...undoBufferRef.current.slice(-49), inputValue];
        setInputValue(val);

        // Debounced draft auto-save (500ms) — server API + localStorage for cross-tab sync
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
        if (channelId) {
            const draftKey = `gratonite:draft:${channelId}`;
            if (val.trim().length > 0) {
                setHasDraft(true);
                try {
                    localStorage.setItem(draftKey, val);
                    isLocalStorageDispatchRef.current = true;
                    window.dispatchEvent(new StorageEvent('storage', { key: draftKey, newValue: val }));
                    isLocalStorageDispatchRef.current = false;
                } catch { /* ignore */ }
                draftSaveTimerRef.current = setTimeout(() => {
                    fetch(`${API_BASE}/channels/${channelId}/draft`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: resolveWireContent(val) }),
                    }).catch(() => {});
                }, 500);
            } else {
                setHasDraft(false);
                try {
                    localStorage.removeItem(draftKey);
                    isLocalStorageDispatchRef.current = true;
                    window.dispatchEvent(new StorageEvent('storage', { key: draftKey, newValue: null }));
                    isLocalStorageDispatchRef.current = false;
                } catch { /* ignore */ }
                fetch(`${API_BASE}/channels/${channelId}/draft`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
                }).catch(() => {});
            }
        }

        // Notify server that we're typing
        if (val.trim().length > 0) sendTypingIndicator();

        // Use text before cursor for autocomplete detection
        const beforeCursor = val.slice(0, cursor);

        // Slash command detection: starts with "/" and no spaces before cursor
        const slashMatch = beforeCursor.match(/^\/([a-zA-Z0-9_]*)$/);
        if (slashMatch) {
            setSlashSearch(slashMatch[1]);
            setSlashIndex(0);
            setMentionSearch(null);
            setChannelSearch(null);
            setEmojiSearch(null);
            return;
        } else {
            setSlashSearch(null);
        }

        const mentionMatch = beforeCursor.match(/@([a-zA-Z0-9_]*)$/);
        const channelMatch = beforeCursor.match(/#([a-zA-Z0-9_-]*)$/);
        const emojiMatch = beforeCursor.match(/(?<!\\):([a-zA-Z0-9_]{1,})$/); // at least 1 char for autocomplete

        if (mentionMatch) {
            setMentionSearch(mentionMatch[1]);
            setMentionIndex(0);
            setChannelSearch(null);
            setEmojiSearch(null);
        } else if (channelMatch) {
            setChannelSearch(channelMatch[1]);
            setChannelIndex(0);
            setMentionSearch(null);
            setEmojiSearch(null);
        } else if (emojiMatch) {
            setEmojiSearch(emojiMatch[1]);
            setEmojiIndex(0);
            setMentionSearch(null);
            setChannelSearch(null);
        } else {
            setMentionSearch(null);
            setChannelSearch(null);
            setEmojiSearch(null);
        }
    };

    const insertMention = (userId: string) => {
        if (mentionSearch === null) return;

        // Handle group mention entries
        const groupMentionMap: Record<string, string> = {
            '__everyone__': '@everyone',
            '__here__': '@here',
            '__channel__': '@channel',
            '__online__': '@online',
        };
        if (groupMentionMap[userId]) {
            const token = groupMentionMap[userId];
            const cursor = cursorPosRef.current;
            const beforeCursor = inputValue.slice(0, cursor);
            const afterCursor = inputValue.slice(cursor);
            const replaced = beforeCursor.replace(/@([a-zA-Z0-9_]*)$/, `${token} `);
            const newVal = replaced + afterCursor;
            setInputValue(newVal);
            const newCursor = replaced.length;
            cursorPosRef.current = newCursor;
            setTimeout(() => {
                const ta = document.querySelector('.chat-input') as HTMLTextAreaElement | null;
                if (ta) { ta.selectionStart = ta.selectionEnd = newCursor; }
            }, 0);
            setMentionSearch(null);
            return;
        }

        const member = guildMembers.find(m => m.id === userId);
        const username = member?.username || userId;
        // Handle duplicate usernames by appending a suffix
        let displayToken = `@${username}`;
        if (mentionsMapRef.current.has(displayToken) && mentionsMapRef.current.get(displayToken) !== `<@${userId}>`) {
            displayToken = `@${username}#${userId.slice(-4)}`;
        }
        mentionsMapRef.current.set(displayToken, `<@${userId}>`);
        // Replace the @search text at cursor position
        const cursor = cursorPosRef.current;
        const beforeCursor = inputValue.slice(0, cursor);
        const afterCursor = inputValue.slice(cursor);
        const replaced = beforeCursor.replace(/@([a-zA-Z0-9_]*)$/, `${displayToken} `);
        const newVal = replaced + afterCursor;
        setInputValue(newVal);
        // Update cursor position after insertion
        const newCursor = replaced.length;
        cursorPosRef.current = newCursor;
        setTimeout(() => {
            const ta = document.querySelector('.chat-input') as HTMLTextAreaElement | null;
            if (ta) { ta.selectionStart = ta.selectionEnd = newCursor; }
        }, 0);
        setMentionSearch(null);
    };

    const insertChannelMention = (chId: string) => {
        if (channelSearch === null) return;
        const channel = guildChannelsList.find(c => c.id === chId);
        const channelName = channel?.name || chId;
        const displayToken = `#${channelName}`;
        mentionsMapRef.current.set(displayToken, `<#${chId}>`);
        // Replace the #search text at cursor position
        const cursor = cursorPosRef.current;
        const beforeCursor = inputValue.slice(0, cursor);
        const afterCursor = inputValue.slice(cursor);
        const replaced = beforeCursor.replace(/#([a-zA-Z0-9_-]*)$/, `${displayToken} `);
        const newVal = replaced + afterCursor;
        setInputValue(newVal);
        const newCursor = replaced.length;
        cursorPosRef.current = newCursor;
        setTimeout(() => {
            const ta = document.querySelector('.chat-input') as HTMLTextAreaElement | null;
            if (ta) { ta.selectionStart = ta.selectionEnd = newCursor; }
        }, 0);
        setChannelSearch(null);
    };

    const [showGifPicker, setShowGifPicker] = useState(false);

    const selectSlashCommand = (cmd: { id: string; name: string; description: string; options?: any[] }) => {
        setSlashSearch(null);
        // Handle built-in commands
        if (cmd.id.startsWith('__')) {
            if (TEXT_COMMANDS[cmd.name]) { setInputValue(TEXT_COMMANDS[cmd.name]); return; }
            if (cmd.name === 'poll') { setShowPollCreator(true); setInputValue(''); return; }
            if (cmd.name === 'giphy') { setShowGifPicker(true); setInputValue(''); return; }
            if (cmd.name === 'remind') { setInputValue('/remind '); return; }
            return;
        }
        // Server commands
        setInputValue(`/${cmd.name} `);
        if (!cmd.options || cmd.options.length === 0) {
            api.post(`/channels/${channelId}/interactions`, { commandId: cmd.id, options: {} })
              .catch(() => { addToast({ title: 'Failed to execute command', variant: 'error' }); });
            setInputValue('');
        }
    };

    const allSlashCommands = [...BUILTIN_COMMANDS.map(c => ({ id: c.id, name: c.name, description: c.description, options: c.options })), ...guildCommands];
    const filteredCommands = slashSearch !== null ? allSlashCommands.filter(c => c.name.toLowerCase().includes(slashSearch.toLowerCase())).slice(0, 15) : [];

    const insertEmoji = (emojiName: string) => {
        if (emojiSearch === null) return;
        const val = inputValue.replace(/:([a-zA-Z0-9_]*)$/, `:${emojiName}: `);
        setInputValue(val);
        setEmojiSearch(null);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Undo buffer: Ctrl+Z / Cmd+Z
        if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            if (undoBufferRef.current.length > 0) {
                e.preventDefault();
                const prev = undoBufferRef.current[undoBufferRef.current.length - 1];
                undoBufferRef.current = undoBufferRef.current.slice(0, -1);
                setInputValue(prev);
                return;
            }
        }
        // Slash command navigation
        if (slashSearch !== null && filteredCommands.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSlashIndex(prev => (prev + 1) % filteredCommands.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSlashIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                selectSlashCommand(filteredCommands[slashIndex]);
                return;
            } else if (e.key === 'Escape') {
                setSlashSearch(null);
                return;
            }
        }

        if (mentionSearch !== null && filteredUsers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredUsers.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(filteredUsers[mentionIndex].id);
                return;
            } else if (e.key === 'Escape') {
                setMentionSearch(null);
                return;
            }
        }

        if (channelSearch !== null && filteredChannels.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setChannelIndex(prev => (prev + 1) % filteredChannels.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setChannelIndex(prev => (prev - 1 + filteredChannels.length) % filteredChannels.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertChannelMention(filteredChannels[channelIndex].id);
                return;
            } else if (e.key === 'Escape') {
                setChannelSearch(null);
                return;
            }
        }

        if (emojiSearch !== null && filteredEmojis.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setEmojiIndex(prev => (prev + 1) % filteredEmojis.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setEmojiIndex(prev => (prev - 1 + filteredEmojis.length) % filteredEmojis.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertEmoji(filteredEmojis[emojiIndex].name);
                return;
            } else if (e.key === 'Escape') {
                setEmojiSearch(null);
                return;
            }
        }

        if (e.key === 'Escape' && editingMessage) {
            setEditingMessage(null);
            setEditContent('');
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            // If the group mention confirmation is visible, don't call handleSendMessage
            // from the keyboard — the user must click "Send Anyway" or "Cancel".
            // Without this guard, both Enter and the button click can fire in the same
            // React batch, causing the message to be sent twice.
            if (groupMentionConfirm) return;
            handleSendMessage();
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
            const recorder = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch {
            addToast({ title: 'Microphone access denied', description: 'Allow microphone access to send voice messages.', variant: 'error' });
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current) {
            // Null out ondataavailable before stopping so stale chunks don't leak into the next recording
            mediaRecorderRef.current.ondataavailable = null;
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
        }
        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingTime(0);
    };

    const handleSendVoiceNote = async () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;

        // Collect the final chunk and wait for onstop — both inside onstop to guarantee ordering
        const chunks = await new Promise<Blob[]>(resolve => {
            const collected: Blob[] = [...audioChunksRef.current];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) collected.push(e.data); };
            recorder.onstop = () => resolve(collected);
            recorder.stop();
            // Stop tracks AFTER stop() so the encoder can flush its final buffer
            recorder.stream.getTracks().forEach(t => t.stop());
        });
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];

        const durationStr = `0:${recordingTime.toString().padStart(2, '0')}`;
        setIsRecording(false);
        setRecordingTime(0);
        setVoiceExpiry(null);
        setRoomVelocity(prev => Math.min(10, prev + 1.5));

        if (chunks.length === 0 || chunks.reduce((sum, b) => sum + b.size, 0) === 0) {
            addToast({ title: 'Recording too short', description: 'Hold the mic button longer to record a voice message.', variant: 'error' });
            return;
        }

        if (!channelId) return;
        const mimeType = chunks[0]?.type || 'audio/webm';
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(chunks, { type: mimeType });
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, { type: mimeType });

        try {
            const uploaded = await api.files.upload(audioFile, 'attachment');
            const optimisticId = Date.now();
            const expirySnapshot = voiceExpiry;
            setMessages(prev => [...prev, {
                id: optimisticId,
                authorId: currentUserId,
                author: currentUserName || 'You',
                system: false,
                avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: '',
                createdAt: new Date().toISOString(),
                type: 'voice' as const,
                duration: durationStr,
                attachments: [{ id: uploaded.id, url: uploaded.url, filename: audioFile.name, size: audioFile.size, mimeType }],
            }]);
            api.messages.send(channelId, {
                attachmentIds: [uploaded.id],
                ...(expirySnapshot ? { expiresIn: expirySnapshot } : {}),
            }).catch(() => {
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
                addToast({ title: 'Failed to send voice message', variant: 'error' });
            });
        } catch {
            addToast({ title: 'Failed to upload voice message', variant: 'error' });
        }
    };

    const submitPoll = async () => {
        if (!pollQuestion.trim()) {
            addToast({ title: 'Please enter a poll question', variant: 'error' });
            return;
        }
        const validOptions = pollOptions.filter(o => o.trim() !== '');
        if (validOptions.length < 2) {
            addToast({ title: 'Please provide at least 2 options', variant: 'error' });
            return;
        }

        // Try API first
        if (channelId) {
            try {
                const poll = await api.polls.create(channelId, {
                    question: pollQuestion.trim(),
                    options: validOptions.map(o => o.trim()),
                    ...(pollDuration ? { duration: pollDuration } : {}),
                    ...(pollMultiselect ? { multiselect: true } : {}),
                });
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    author: currentUserName,
                    system: false,
                    avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    content: 'Created a poll',
                    createdAt: new Date().toISOString(),
                    type: 'poll' as const,
                    pollData: {
                        pollId: poll?.id,
                        question: pollQuestion.trim(),
                        options: poll?.options
                            ? poll.options.map((o: any) => ({ id: o.id, text: o.text, votes: o.voteCount ?? 0 }))
                            : validOptions.map((text, i) => ({ id: String(i + 1), text: text.trim(), votes: 0 })),
                        totalVotes: poll?.totalVoters ?? 0,
                        multipleChoice: poll?.multipleChoice ?? false,
                        myVotes: poll?.myVotes ?? [],
                    }
                }]);
                setPollQuestion('');
                setPollOptions(['', '']);
                setPollDuration(null);
                setPollMultiselect(false);
                setShowPollCreator(false);
                return;
            } catch {
                addToast({
                    title: 'Could not create poll',
                    description: 'Please try again in a moment.',
                    variant: 'error',
                });
                return;
            }
        }
        addToast({
            title: 'Could not create poll',
            description: 'Missing channel context for poll creation.',
            variant: 'error',
        });
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handlePlaySound = (sound: { name: string, emoji: string }) => {
        playSynthSound(sound.name);
        setMessages(prev => [...prev, {
            id: Date.now(),
            author: 'System',
            system: true,
            avatar: '🔊',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: `${currentUserName || 'User'} played ${sound.emoji} ${sound.name}`
        }]);
        setSoundboardOpen(false);
        setRoomVelocity(prev => Math.min(10, prev + 1));
    };

    const bgWarmingOpacity = Math.min(0.15, roomVelocity / 60);

    return (
        <main
            className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`}
            style={{ position: 'relative' }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
                const droppedFiles = e.dataTransfer?.files;
                if (!droppedFiles || droppedFiles.length === 0) return;
                const newFiles = Array.from(droppedFiles).map(f => ({
                    name: f.name,
                    size: f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`,
                    file: f,
                    previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
                }));
                setChatAttachedFiles(prev => [...prev, ...newFiles]);
            }}
        >
            {/* Drag & Drop Overlay */}
            {isDragOver && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{
                        position: 'absolute', inset: 0, zIndex: 100,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none',
                        border: '3px dashed var(--accent-primary)',
                        borderRadius: '8px',
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        style={{
                            background: 'var(--bg-elevated)', padding: '32px 48px',
                            borderRadius: '16px', textAlign: 'center',
                            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                            border: '1px solid var(--stroke)',
                        }}
                    >
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '12px' }}>
                            <ImageIcon size={28} style={{ color: 'var(--accent-primary)' }} />
                            <FileText size={28} style={{ color: 'var(--accent-blue, #3b82f6)' }} />
                            <Play size={28} style={{ color: 'var(--accent-purple, #8b5cf6)' }} />
                            <Volume2 size={28} style={{ color: 'var(--success, #22c55e)' }} />
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Drop files to upload</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Images, videos, audio, documents</div>
                    </motion.div>
                </motion.div>
            )}
            <EmojiRain active={isHypeMode} />
            <BackgroundMedia media={bgMedia} />

            {/* Reactive Ambient Background */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'var(--accent-primary)',
                opacity: bgWarmingOpacity,
                pointerEvents: 'none',
                transition: 'opacity 1s ease-out',
                zIndex: 0
            }} />

            <div ref={chatContainerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1, background: 'transparent', overflow: 'hidden' }}>

            <header className="top-bar">
                {/* Mobile Toggles */}
                <div className="mobile-header-toggles">
                    <ArrowLeft size={20} className="mobile-toggle-btn" role="button" aria-label="Back to channels" tabIndex={0} onClick={() => navigate(`/guild/${guildId}`)} />
                    <Hash size={24} style={{ color: 'var(--text-muted)', marginLeft: '8px' }} />
                </div>

                <Hash size={24} className="desktop-hash-icon" style={{ color: 'var(--text-muted)' }} />
                <h2>{channelName}</h2>
                {channelIsEncrypted && (
                    <span title="End-to-end encrypted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', fontSize: '11px', fontWeight: 600, color: '#22c55e' }}>
                        <Lock size={12} /> Encrypted
                    </span>
                )}
                {isAnnouncementChannel && (
                    <span title="Announcement Channel" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '11px', fontWeight: 600, color: '#3b82f6' }}>
                        <Megaphone size={12} /> Announcements
                    </span>
                )}
                {channelDisappearTimer && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '11px', fontWeight: 600, color: '#f59e0b' }}>
                        <Timer size={12} /> Disappearing
                    </span>
                )}

                <div style={{ flex: 1 }}></div>

                <div className="unified-top-actions" style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                    {canManageChannel && (
                        <div className="bg-upload-btn action-icon-btn hidden-on-mobile" onClick={() => fileInputRef.current?.click()}>
                            <ImageIcon size={18} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Set Theme</span>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" onChange={handleUploadBg} />
                    {isAnnouncementChannel && (
                        <button
                            className="action-icon-btn hidden-on-mobile"
                            onClick={async () => {
                                try {
                                    await api.channels.follow(channelId!);
                                    addToast({ title: 'Following this channel!', variant: 'success' });
                                } catch { addToast({ title: 'Failed to follow channel', variant: 'error' }); }
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                        >
                            <Rss size={16} /> Follow
                        </button>
                    )}

                    <div
                        className="action-icon-btn hidden-on-mobile"
                        onClick={() => { setShowPinnedPanel(!showPinnedPanel); if (!showPinnedPanel) loadPinnedMessages(); }}
                        style={{ cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Pin size={18} style={{ color: showPinnedPanel ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                    </div>

                    <div
                        className="action-icon-btn hidden-on-mobile"
                        onClick={() => setShowThreadsPanel(!showThreadsPanel)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Threads"
                    >
                        <MessageSquare size={18} style={{ color: showThreadsPanel ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                    </div>

                    <div
                        className="action-icon-btn hidden-on-mobile"
                        onClick={() => setShowNotesPanel(!showNotesPanel)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Notes"
                    >
                        <FileText size={18} style={{ color: showNotesPanel ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                    </div>

                    <div
                        className="action-icon-btn hidden-on-mobile"
                        onClick={() => setShowJumpToDate(!showJumpToDate)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}
                        title="Jump to Date"
                    >
                        <Calendar size={18} style={{ color: showJumpToDate ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        {showJumpToDate && (
                            <JumpToDatePicker
                                onSelect={handleJumpToDate}
                                onClose={() => setShowJumpToDate(false)}
                                loading={jumpToDateLoading}
                            />
                        )}
                    </div>

                    <div
                        className="action-icon-btn hidden-on-mobile"
                        onClick={handleAddToReadLater}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="Read Later"
                    >
                        <BookOpen size={18} style={{ color: 'var(--text-secondary)' }} />
                    </div>

                    {/* Channel Notification Prefs — Item 14 */}
                    <div
                        className="action-icon-btn hidden-on-mobile"
                        onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}
                        title="Notification Settings"
                    >
                        {channelNotifLevel === 'none' ? (
                            <BellOff size={18} style={{ color: 'var(--text-muted)' }} />
                        ) : (
                            <Bell size={18} style={{ color: showNotifDropdown ? 'var(--accent-primary)' : channelNotifLevel !== 'default' ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        )}
                        {showNotifDropdown && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', padding: '6px', minWidth: '200px', zIndex: 50 }} onClick={e => e.stopPropagation()}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 10px', marginBottom: '4px' }}>NOTIFICATION LEVEL</div>
                                {([
                                    { value: 'default', label: 'Default', desc: 'Use server default' },
                                    { value: 'all', label: 'All Messages', desc: 'Notify for every message' },
                                    { value: 'mentions', label: 'Only Mentions', desc: 'Only when mentioned' },
                                    { value: 'none', label: 'Nothing', desc: 'Mute this channel' },
                                ] as const).map(opt => (
                                    <div
                                        key={opt.value}
                                        onClick={() => {
                                            setChannelNotifLevel(opt.value);
                                            setShowNotifDropdown(false);
                                            if (channelId) {
                                                api.channelNotifPrefs.set(channelId, opt.value).catch(() => {
                                                    addToast({ title: 'Failed to update notification preference', variant: 'error' });
                                                });
                                            }
                                        }}
                                        style={{
                                            padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                                            background: channelNotifLevel === opt.value ? 'var(--accent-primary)' : 'transparent',
                                            color: channelNotifLevel === opt.value ? 'white' : 'var(--text-secondary)',
                                            marginBottom: '2px',
                                        }}
                                    >
                                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{opt.label}</div>
                                        <div style={{ fontSize: '11px', opacity: 0.7 }}>{opt.desc}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <TopBarActions />

                    <div className="action-divider hidden-on-mobile" style={{ width: '1px', height: '24px', background: 'var(--stroke)' }}></div>

                    <div
                        className="action-icon-btn member-list-toggle-btn member-count-toggle"
                        onClick={() => {
                            // Desktop: toggle member list panel; Mobile: open slide-over drawer
                            if (window.innerWidth <= 768) {
                                toggleMemberDrawer?.();
                            } else {
                                const next = !memberListOpen;
                                setMemberListOpen(next);
                                localStorage.setItem('memberListOpen', String(next));
                            }
                        }}
                        style={{ cursor: 'pointer', color: memberListOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                        title="Members"
                    >
                        <Users size={20} />
                    </div>
                    {guildId && (
                        <div
                            onClick={() => setShowMediaGallery(true)}
                            style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
                            title="Media Gallery"
                        >
                            <ImageIcon size={20} />
                        </div>
                    )}
                </div>
            </header>

                {/* Pinned Message Banner */}
                {pinnedMessages.length > 0 && !pinBannerDismissed && (() => {
                    const latest = pinnedMessages[0];
                    const text = latest?.content || latest?.attachments?.[0]?.filename || 'Pinned message';
                    return (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '7px 16px',
                            background: 'linear-gradient(90deg, rgba(82,109,245,0.08), rgba(82,109,245,0.04))',
                            borderBottom: '1px solid rgba(82,109,245,0.2)',
                            fontSize: '13px', cursor: 'pointer', flexShrink: 0,
                        }}
                            onClick={() => { setShowPinnedPanel(true); loadPinnedMessages(); }}
                        >
                            <Pin size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>Pinned</span>
                            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {text.length > 80 ? text.slice(0, 80) + '…' : text}
                            </span>
                            {pinnedMessages.length > 1 && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>
                                    +{pinnedMessages.length - 1} more
                                </span>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPinBannerDismissed(true);
                                    sessionStorage.setItem(`gratonite:pin-banner-dismissed-${channelId}`, '1');
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                title="Dismiss"
                                aria-label="Dismiss pinned banner"
                            >
                                ✕
                            </button>
                        </div>
                    );
                })()}

            {channelIsEncrypted && !channelE2EKey && channelKeyRecoveryRequired && (
                <div style={{ padding: '8px 16px', background: 'var(--warning-bg, rgba(234,179,8,0.15))', borderBottom: '1px solid var(--warning, #eab308)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--warning, #eab308)' }}>
                    <Lock size={14} />
                    <span>Encrypted history is unavailable on this device. Restore your encryption key in Privacy settings to read and send in this channel.</span>
                </div>
            )}

            {guildId && <EventCountdownBanner guildId={guildId} />}

            {/* Ctrl+F Search Bar */}
            {showSearchBar && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--stroke)',
                    zIndex: 3,
                    position: 'relative',
                }}>
                    <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') { closeSearch(); return; }
                            if (e.key === 'Enter') {
                                if (e.shiftKey) navigateSearchResult('up');
                                else navigateSearchResult('down');
                                e.preventDefault();
                            }
                        }}
                        placeholder="Search messages in this channel..."
                        style={{
                            flex: 1,
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 10px',
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            outline: 'none',
                        }}
                    />
                    <span style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        minWidth: '60px',
                        textAlign: 'center',
                    }}>
                        {isSearching ? 'Searching...' :
                            searchQuery.trim() ?
                                searchResults.length > 0 ? `${currentSearchIndex + 1} / ${searchResults.length}` : 'No results'
                                : ''}
                    </span>
                    <button
                        onClick={() => navigateSearchResult('up')}
                        disabled={searchResults.length === 0}
                        style={{
                            background: 'transparent', border: 'none', cursor: searchResults.length > 0 ? 'pointer' : 'default',
                            color: searchResults.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                            padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: searchResults.length > 0 ? 1 : 0.4,
                        }}
                        title="Previous result (Shift+Enter)"
                    >
                        <ChevronUp size={16} />
                    </button>
                    <button
                        onClick={() => navigateSearchResult('down')}
                        disabled={searchResults.length === 0}
                        style={{
                            background: 'transparent', border: 'none', cursor: searchResults.length > 0 ? 'pointer' : 'default',
                            color: searchResults.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                            padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: searchResults.length > 0 ? 1 : 0.4,
                        }}
                        title="Next result (Enter)"
                    >
                        <ChevronDown size={16} />
                    </button>
                    <button
                        onClick={closeSearch}
                        style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', padding: '4px', borderRadius: '4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Close search (Escape)"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Content area wrapper — positions pinned panel between header and input */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
            {isViewingHistory && (
                <button
                    onClick={() => { setIsViewingHistory(false); fetchMessages(); }}
                    style={{
                        position: 'absolute',
                        bottom: 80,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 20,
                        padding: '8px 16px',
                        cursor: 'pointer',
                        zIndex: 10,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        fontWeight: 600,
                    }}
                    aria-label="Jump to present"
                >
                    <ChevronDown size={16} /> Jump to Present
                </button>
            )}
            {!isViewingHistory && showScrollButton && (
                <button
                    onClick={() => { parentRef.current?.scrollTo({ top: parentRef.current.scrollHeight, behavior: 'smooth' }); setNewMsgCount(0); }}
                    style={{
                        position: 'absolute',
                        bottom: 80,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--accent-primary)',
                        color: '#000',
                        border: 'none',
                        borderRadius: 20,
                        padding: '8px 16px',
                        cursor: 'pointer',
                        zIndex: 10,
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        animation: 'fadeInSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    aria-label={`Jump to bottom${newMsgCount > 0 ? `, ${newMsgCount} new messages` : ''}`}
                >
                    <ChevronDown size={16} />
                    {newMsgCount > 0 ? `${newMsgCount} new message${newMsgCount > 1 ? 's' : ''}` : 'Jump to bottom'}
                    {newMsgCount > 0 && (
                        <span style={{
                            background: '#000',
                            color: 'var(--accent-primary)',
                            fontSize: '11px',
                            fontWeight: 700,
                            borderRadius: '10px',
                            padding: '1px 7px',
                            minWidth: '20px',
                            textAlign: 'center',
                            lineHeight: '16px',
                        }}>
                            {newMsgCount > 99 ? '99+' : newMsgCount}
                        </span>
                    )}
                </button>
            )}
            {/* Document Channel — renders collaborative editor instead of message list */}
            {channelTypeStr === 'GUILD_DOCUMENT' ? (
                <DocumentChannel channelId={channelId!} channelName={channelName} guildId={guildId} readOnly={!canManageChannel} />
            ) : null}

            {/* Forum View — renders instead of message list for GUILD_FORUM channels */}
            {channelTypeStr === 'GUILD_FORUM' ? (
                <ForumView
                    channelId={channelId!}
                    channelName={channelName}
                    forumTags={channelForumTags}
                    channelIsEncrypted={channelIsEncrypted}
                    attachmentsEnabled={channelAttachmentsEnabled}
                    onOpenThread={(threadId) => setActiveThreadMessage?.({ id: 0, apiId: threadId } as any)}
                />
            ) : null}

            {/* Wiki Channel */}
            {channelTypeStr === 'GUILD_WIKI' && <WikiChannel />}

            {/* Q&A Channel */}
            {channelTypeStr === 'GUILD_QA' && <QAChannel />}

            {/* Task Board (Kanban) */}
            {channelTypeStr === 'GUILD_TASK' && <KanbanBoard channelId={channelId!} />}

            {/* Confession Board */}
            {channelTypeStr === 'GUILD_CONFESSION' && guildId && <ConfessionBoard channelId={channelId!} guildId={guildId} />}

            <div ref={parentRef} className="message-area" role="log" aria-label={`Messages in #${channelName}`} aria-live="polite" style={{ overflowY: 'auto', zIndex: 2, position: 'relative', ...(channelTypeStr === 'GUILD_FORUM' || channelTypeStr === 'GUILD_DOCUMENT' || channelTypeStr === 'GUILD_WIKI' || channelTypeStr === 'GUILD_QA' || channelTypeStr === 'GUILD_TASK' || channelTypeStr === 'GUILD_CONFESSION' ? { display: 'none' } : {}) }}>
                {/* Pull-to-refresh indicator (mobile) */}
                {isMobile && pullDistance > 0 && (
                    <div className="pull-to-refresh-indicator" style={{ height: `${pullDistance}px` }}>
                        <div className={`pull-to-refresh-spinner${isPullRefreshing ? ' spinning' : ''}`}
                            style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
                    </div>
                )}
                {/* Channel Welcome Card */}
                {channelId && !isLoadingMessages && (
                    <ChannelWelcomeCard channelId={channelId} channelName={channelName} topic={channelTopic} />
                )}
                {!isLoadingMessages && messages.length === 0 && (
                    <EmptyState
                        type="chat"
                        title={`No messages yet. Say hello! 👋`}
                        description="Be the first to say something in this channel."
                        actionLabel="Break the ice"
                        onAction={() => {
                            document.querySelector<HTMLInputElement>('.chat-input')?.focus();
                        }}
                    />
                )}

                {isLoadingMessages ? (
                    <SkeletonMessageList count={10} />
                ) : messagesError ? (
                    <ErrorState
                        message="Failed to load messages"
                        description="There was a problem loading the messages for this channel."
                        onRetry={fetchMessages}
                    />
                ) : (
                    <>
                    {isLoadingOlder && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                            <div style={{ width: '20px', height: '20px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    )}
                    {!hasMoreMessages && messages.length > 0 && (
                        <div style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            Beginning of channel history
                        </div>
                    )}
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative', flexShrink: 0 }}>
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const msg = messages[virtualRow.index];
                            const prevMsg = messages[virtualRow.index - 1];

                            return (
                                <div
                                    key={virtualRow.key}
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    onClick={(e) => handleMessageShiftClick(e, msg.apiId)}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                        ...(msg.apiId && selectedMessages.has(msg.apiId) ? { background: 'rgba(88, 101, 242, 0.15)', borderLeft: '3px solid var(--accent-primary, #5865f2)' } : {}),
                                    }}
                                >
                                    <SwipeableMessage onSwipeRight={() => !msg.system && msg.apiId && setReplyingTo({ id: Number(msg.apiId), author: msg.author, content: msg.content })} disabled={msg.system}>
                                    <MemoizedMessageItem
                                        msg={msg}
                                        prevMsg={prevMsg}
                                        highlightedMessageId={highlightedMessageId}
                                        playingMessageId={playingMessageId}
                                        setPlayingMessageId={setPlayingMessageId}
                                        handleMessageContext={handleMessageContext}
                                        setActiveThreadMessage={setActiveThreadMessage}
                                        activeThreadMessageId={activeThreadMessage?.id ?? null}
                                        isHypeMode={isHypeMode}
                                        onImageClick={(url: string) => { setLightboxUrl(url); setLightboxZoom(1); }}
                                        onReply={(r: any) => setReplyingTo(r)}
                                        onProfileClick={(p: any) => setProfilePopover(p)}
                                        onForward={(m: Message) => setForwardingMessage(m)}
                                        onReaction={handleReaction}
                                        onReplyHighlight={(replyApiId: string) => {
                                            const localMsg = messages.find(m => m.apiId === replyApiId);
                                            if (localMsg) {
                                                setHighlightedMessageId(localMsg.id);
                                                setTimeout(() => setHighlightedMessageId(null), 2500);
                                            }
                                        }}
                                        onUserContext={handleUserContext}
                                        channelId={channelId}
                                        customEmojis={guildCustomEmojis}
                                        members={guildMembers}
                                        channels={guildChannelsList}
                                        currentUserId={currentUserId || userProfile?.id || ''}
                                        currentUsername={currentUserName}
                                        currentUserAvatarFrame={userProfile?.avatarFrame || 'none'}
                                        currentUserNameplateStyle={userProfile?.nameplateStyle || 'none'}
                                        guildId={guildId}
                                        addToast={addToast}
                                        compactMode={compactMode}
                                        isNewMessageDivider={!!(lastReadMessageId && prevMsg?.apiId === lastReadMessageId && msg.apiId !== lastReadMessageId)}
                                        decryptedFileUrls={decryptedFileUrls}
                                        editingMessageApiId={editingMessage?.apiId ?? null}
                                        editContent={editContent}
                                        setEditContent={setEditContent}
                                        onEditSubmit={handleEditSubmit}
                                        onEditCancel={() => { setEditingMessage(null); setEditContent(''); }}
                                    />
                                    </SwipeableMessage>
                                    {/* Feature 12: Read Receipt Dots */}
                                    {showReadReceipts && msg.apiId && (() => {
                                        const nextMsg = messages[virtualRow.index + 1];
                                        const readers = otherReadStates.filter(s => s.lastReadMessageId === msg.apiId);
                                        if (readers.length === 0) return null;
                                        const readerMembers = readers.map(r => guildMembers.find(m => m.id === r.userId)).filter((m): m is NonNullable<typeof m> => Boolean(m));
                                        if (readerMembers.length === 0) return null;
                                        return (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '2px 8px 0', gap: '4px' }}>
                                                <Eye size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                {readerMembers.slice(0, 5).map((member: any) => (
                                                    <Avatar
                                                        key={member.id}
                                                        userId={member.id}
                                                        displayName={member.displayName || member.username}
                                                        avatarHash={member.avatar}
                                                        size={14}
                                                    />
                                                ))}
                                                {readerMembers.length > 5 && (
                                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: '14px' }}>+{readerMembers.length - 5}</span>
                                                )}
                                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }} title={readerMembers.map((m: any) => m.displayName || m.username).join(', ')}>
                                                    {readerMembers.length === 1 ? (readerMembers[0].displayName || readerMembers[0].username) : `${readerMembers.length} read`}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                    </div>
                    </>
                )}
            </div >

            {/* Bulk Delete Action Bar */}
            {selectedMessages.size > 0 && canManageChannel && (
                <div style={{
                    position: 'sticky', bottom: 0,
                    background: 'var(--bg-secondary, #2f3136)',
                    borderTop: '1px solid var(--stroke, #40444b)',
                    padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    zIndex: 50,
                    animation: 'fadeInSlideUp 0.2s ease-out',
                }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {selectedMessages.size} message{selectedMessages.size !== 1 ? 's' : ''} selected
                    </span>
                    <button
                        onClick={() => {
                            if (!channelId) return;
                            const ids = [...selectedMessages];
                            Promise.all(ids.map(id => api.messages.pin(channelId, id))).then(() => {
                                addToast({ title: `Pinned ${ids.length} messages`, variant: 'success' });
                                loadPinnedMessages();
                            }).catch(() => addToast({ title: 'Failed to pin some messages', variant: 'error' }));
                            setSelectedMessages(new Set()); setSelectionMode(false);
                        }}
                        style={{
                            padding: '8px 16px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                            border: '1px solid var(--stroke)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        <Pin size={14} /> Pin
                    </button>
                    <button
                        onClick={() => {
                            const ids = [...selectedMessages];
                            const token = getAccessToken() ?? '';
                            Promise.all(ids.map(id =>
                                fetch(`${API_BASE}/users/@me/bookmarks`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ messageId: id }),
                                })
                            )).then(() => {
                                addToast({ title: `Bookmarked ${ids.length} messages`, variant: 'success' });
                            }).catch(() => addToast({ title: 'Failed to bookmark some messages', variant: 'error' }));
                            setSelectedMessages(new Set()); setSelectionMode(false);
                        }}
                        style={{
                            padding: '8px 16px', background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                            border: '1px solid var(--stroke)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        <Star size={14} /> Bookmark
                    </button>
                    <button
                        onClick={handleBulkDelete}
                        style={{
                            padding: '8px 16px', background: 'var(--error, #ed4245)', color: '#fff',
                            border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        <Trash2 size={14} /> Delete {selectedMessages.size}
                    </button>
                    <button
                        onClick={() => { setSelectedMessages(new Set()); setSelectionMode(false); }}
                        style={{
                            padding: '8px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                            border: '1px solid var(--stroke)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Pinned Messages Panel */}
            {showPinnedPanel && (
                <div style={{
                    width: '340px', flexShrink: 0, borderLeft: '1px solid var(--stroke)',
                    background: 'var(--bg-secondary, #2f3136)', display: 'flex', flexDirection: 'column',
                    position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 30,
                }}>
                    <div style={{
                        padding: '16px', borderBottom: '1px solid var(--stroke)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Pinned Messages</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                                onClick={() => setPinBoardView(!pinBoardView)}
                                title={pinBoardView ? 'List View' : 'Board View'}
                                style={{
                                    background: pinBoardView ? 'var(--bg-tertiary)' : 'transparent',
                                    border: '1px solid var(--stroke)', cursor: 'pointer',
                                    color: pinBoardView ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center',
                                }}
                            >
                                <Square size={16} />
                            </button>
                            <button onClick={() => setShowPinnedPanel(false)} style={{
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: 'var(--text-muted)', padding: '4px', borderRadius: '4px'
                            }}>
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                        {isLoadingPins ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                                <div style={{ width: '24px', height: '24px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            </div>
                        ) : pinnedMessages.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                                <Pin size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                <p style={{ fontWeight: 600 }}>No pinned messages</p>
                                <p style={{ fontSize: '13px' }}>Pin important messages to keep them here.</p>
                            </div>
                        ) : pinBoardView ? (
                            /* Board/Grid View */
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                                {pinnedMessages.map((pin: any) => (
                                    <div key={pin.id} style={{
                                        padding: '10px', borderRadius: '10px',
                                        background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                        cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                        transition: 'border-color 0.15s',
                                    }}
                                    onClick={() => {
                                        setShowPinnedPanel(false);
                                        const msgEl = document.querySelector(`[data-message-id="${pin.id}"]`);
                                        if (msgEl) {
                                            msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            const localMsg = messages.find(m => m.apiId === pin.id);
                                            if (localMsg) { setHighlightedMessageId(localMsg.id); setTimeout(() => setHighlightedMessageId(null), 2500); }
                                        }
                                    }}
                                    className="hover-border-accent"
                                    >
                                        {pin.attachments?.[0]?.url && (
                                            <div style={{ width: '100%', height: '80px', borderRadius: '6px', background: 'var(--bg-tertiary)', marginBottom: '8px', overflow: 'hidden' }}>
                                                <img src={pin.attachments[0].url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => (e.currentTarget.style.display = 'none')} />
                                            </div>
                                        )}
                                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' as any, flex: 1 }}>
                                            {pin.content || '(attachment)'}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600 }}>
                                                {(pin.author?.displayName || pin.author?.username || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {pin.author?.displayName || pin.author?.username || 'Unknown'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* List View */
                            pinnedMessages.map((pin: any) => (
                                <div key={pin.id} style={{
                                    padding: '12px', margin: '4px 0', borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    setShowPinnedPanel(false);
                                    const msgEl = document.querySelector(`[data-message-id="${pin.id}"]`);
                                    if (msgEl) {
                                        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        const localMsg = messages.find(m => m.apiId === pin.id);
                                        if (localMsg) { setHighlightedMessageId(localMsg.id); setTimeout(() => setHighlightedMessageId(null), 2500); }
                                    }
                                }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                                            {(pin.author?.displayName || pin.author?.username || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {pin.author?.displayName || pin.author?.username || 'Unknown'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                            {pin.createdAt ? new Date(pin.createdAt).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                                        {pin.content || '(attachment)'}
                                    </p>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            if (channelId && pin.id) {
                                                api.messages.unpin(channelId, pin.id).then(() => {
                                                    setPinnedMessages(prev => prev.filter(p => p.id !== pin.id));
                                                    addToast({ title: 'Message Unpinned', variant: 'success' });
                                                }).catch(() => addToast({ title: 'Failed to unpin', variant: 'error' }));
                                            }
                                        }} style={{
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                            color: 'var(--text-muted)', fontSize: '12px', padding: '4px 8px',
                                            borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                        className="hover-text-error"
                                        >
                                            <X size={12} /> Unpin
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Threads Panel */}
            {showThreadsPanel && channelId && (
                <ThreadsPanel
                    channelId={channelId}
                    onClose={() => setShowThreadsPanel(false)}
                    onThreadSelect={(threadId) => {
                        const msg = messages.find(m => m.apiId === threadId);
                        if (msg) setActiveThreadMessage(msg);
                        setShowThreadsPanel(false);
                    }}
                />
            )}

            {/* Notes Panel */}
            {showNotesPanel && channelId && (
                <ChannelNotesPanel
                    channelId={channelId}
                    onClose={() => setShowNotesPanel(false)}
                />
            )}
            </div>{/* end content area wrapper */}

            <div className="input-area" style={{ zIndex: 2, position: 'relative', ...(channelTypeStr === 'GUILD_FORUM' ? { display: 'none' } : {}) }}>
                {slowRemaining > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 16px',
                        fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
                        margin: '0 16px 4px', borderRadius: '8px',
                    }}>
                        {/* Circular countdown timer */}
                        <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
                            <svg width="28" height="28" viewBox="0 0 28 28" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="14" cy="14" r="12" fill="none" stroke="var(--stroke)" strokeWidth="2" />
                                <circle
                                    cx="14" cy="14" r="12" fill="none"
                                    stroke="var(--accent-primary)" strokeWidth="2"
                                    strokeDasharray={`${2 * Math.PI * 12}`}
                                    strokeDashoffset={`${2 * Math.PI * 12 * (1 - slowRemaining / (rateLimitPerUser || 1))}`}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                                />
                            </svg>
                            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {slowRemaining}
                            </span>
                        </div>
                        <span>Slowmode active — wait <strong style={{ color: 'var(--text-primary)' }}>{slowRemaining}s</strong> to send</span>
                    </div>
                )}
                {typingUsers.size > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', paddingLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                            {[...typingUsers.entries()].slice(0, 3).map(([userId, uname]) => (
                                <Avatar key={userId} userId={userId} displayName={uname} size={18} />
                            ))}
                        </span>
                        <span style={{ display: 'flex', gap: '4px' }}>
                            <span className="typing-dot" style={{ animationDelay: '0ms' }}></span>
                            <span className="typing-dot" style={{ animationDelay: '150ms' }}></span>
                            <span className="typing-dot" style={{ animationDelay: '300ms' }}></span>
                        </span>
                        {(() => {
                            const names = [...typingUsers.values()];
                            if (names.length === 1) return `${names[0]} is typing...`;
                            if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
                            if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
                            return `Several people are typing...`;
                        })()}
                    </div>
                )}

                {/* Edit Banner */}
                {editingMessage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--warning)', margin: '0 16px 4px', borderRadius: '0 8px 8px 0' }}>
                        <Edit2 size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>Editing message</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{editingMessage.content}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>Esc to cancel</span>
                        <button onClick={() => { setEditingMessage(null); setEditContent(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Scheduled Messages Indicator */}
                {scheduledMessages.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 16px 4px', maxHeight: '100px', overflowY: 'auto' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={12} /> {scheduledMessages.length} scheduled
                        </div>
                        {scheduledMessages.map(sm => (
                            <div key={sm.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', padding: '2px 0' }}>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    "{sm.content.slice(0, 60)}" — {new Date(sm.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button onClick={() => {
                                    if (!channelId) return;
                                    fetch(`${API_BASE}/channels/${channelId}/messages/scheduled/${sm.id}`, {
                                        method: 'DELETE',
                                        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
                                    }).then(r => {
                                        if (r.ok) {
                                            setScheduledMessages(prev => prev.filter(s => s.id !== sm.id));
                                            addToast({ title: 'Scheduled message cancelled', variant: 'info' });
                                        }
                                    }).catch(() => {});
                                }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }} title="Cancel">
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Group mention confirmation bar */}
                {groupMentionConfirm && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
                        background: 'rgba(245, 158, 11, 0.1)', borderLeft: '3px solid #f59e0b',
                        margin: '0 16px 4px', borderRadius: '0 8px 8px 0',
                    }}>
                        <Megaphone size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>
                            {groupMentionConfirm.type === 'everyone' || groupMentionConfirm.type === 'channel'
                                ? <>This will notify <strong>all {groupMentionConfirm.memberCount} members</strong>. Consider @-mentioning specific people instead.</>
                                : <>This will notify <strong>all online members</strong> of this server.</>
                            }
                        </span>
                        <button
                            onClick={() => { setGroupMentionConfirm(null); }}
                            style={{
                                background: 'none', border: '1px solid var(--stroke)', color: 'var(--text-secondary)',
                                cursor: 'pointer', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => { handleSendMessage(); }}
                            style={{
                                background: '#f59e0b', border: 'none', color: '#000',
                                cursor: 'pointer', padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                            }}
                        >
                            Send Anyway
                        </button>
                    </div>
                )}

                {/* Feature 12: Reply Preview Bar */}
                {replyingTo && !editingMessage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent-primary)', margin: '0 16px 4px', borderRadius: '0 8px 8px 0' }}>
                        <Reply size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>Replying to</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{replyingTo.author}</span>
                        <span
                            onClick={() => {
                                const apiId = replyingTo.apiId;
                                if (apiId) {
                                    const el = document.querySelector(`[data-message-id="${apiId}"]`);
                                    if (el) {
                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        const localMsg = messages.find(m => m.apiId === apiId);
                                        if (localMsg) {
                                            setHighlightedMessageId(localMsg.id);
                                            setTimeout(() => setHighlightedMessageId(null), 2500);
                                        }
                                    }
                                }
                            }}
                            style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'pointer' }}
                            title="Click to scroll to original message"
                        >
                            {replyingTo.content || '(click to view)'}
                        </span>
                        <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }} title="Cancel reply">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Attached file chips */}
                {chatAttachedFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 16px 8px' }}>
                        {chatAttachedFiles.map((f, i) => {
                            const pct = uploadProgress[f.name];
                            const isUploading = pct !== undefined && pct >= 0 && pct < 100;
                            const isFailed = pct === -1;
                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--bg-tertiary)', border: `1px solid ${isFailed ? 'var(--error)' : 'var(--stroke)'}`, borderRadius: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {f.previewUrl ? <img src={f.previewUrl} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} alt="" /> : <ImageIcon size={12} />}
                                        <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{f.size}</span>
                                        {isUploading && <span style={{ color: 'var(--accent-primary)', fontSize: '10px' }}>{pct}%</span>}
                                        {isFailed && (
                                            <button onClick={handleSendMessage} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0 2px', fontSize: '13px', lineHeight: 1 }} title="Retry upload">↺</button>
                                        )}
                                        <button onClick={() => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); setChatAttachedFiles(prev => prev.filter((_, idx) => idx !== i)); setUploadProgress(prev => { const next = { ...prev }; delete next[f.name]; return next; }); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                    {isUploading && (
                                        <div style={{ height: '2px', background: 'var(--stroke)', borderRadius: '1px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-primary)', transition: 'width 0.2s ease' }} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Feature 5: Markdown Preview Pane */}
                {showPreview && inputValue.trim().length > 0 && (
                    <div style={{
                        padding: '12px 16px', margin: '0 16px 4px',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                        borderRadius: '8px', fontSize: '15px', color: 'var(--text-primary)',
                        lineHeight: '1.5', maxHeight: '200px', overflowY: 'auto',
                    }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                            Preview
                        </div>
                        <RichTextRenderer content={inputValue} customEmojis={guildCustomEmojis} members={guildMembers} channels={guildChannelsList} />
                    </div>
                )}

                {/* Formatting Toolbar */}
                {showFormattingToolbar && !editingMessage && (
                    <div style={{ margin: '0 16px' }}>
                        <FormattingToolbar
                            textareaSelector=".chat-input"
                            onInputChange={setInputValue}
                            getValue={() => inputValue}
                        />
                    </div>
                )}

                {/* Embed Builder */}
                {showEmbedBuilder && !editingMessage && (
                    <EmbedBuilder
                        onSend={(embed: CustomEmbed) => {
                            if (!channelId) return;
                            api.messages.send(channelId, { content: ' ', embeds: [embed as unknown as Record<string, unknown>] } as any).then(() => {
                                setShowEmbedBuilder(false);
                                playSound('messageSend');
                            }).catch(() => {
                                addToast({ title: 'Failed to send embed', variant: 'error' });
                            });
                        }}
                        onClose={() => setShowEmbedBuilder(false)}
                    />
                )}

                <div className="chat-input-wrapper" style={{ position: 'relative' }}>

                    {/* Mentions Autocomplete */}
                    {mentionSearch !== null && (
                        <div style={{
                            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '300px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '4px'
                        }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '4px 8px', marginBottom: '4px' }}>
                                Members
                            </div>
                            {filteredUsers.length > 0 ? filteredUsers.map((user, idx) => (
                                <div
                                    key={user.id}
                                    onClick={() => insertMention(user.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: mentionIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                        transition: 'background 0.1s'
                                    }}
                                    onMouseEnter={() => setMentionIndex(idx)}
                                >
                                    <Avatar
                                        userId={user.id}
                                        avatarHash={(user as any).avatar || undefined}
                                        displayName={user.displayName || user.username}
                                        size={28}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{user.displayName}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{user.username}</span>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>No members found</div>
                            )}
                        </div>
                    )}

                    {/* Channel Autocomplete */}
                    {channelSearch !== null && filteredChannels.length > 0 && (
                        <div style={{
                            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '300px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '4px'
                        }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '4px 8px', marginBottom: '4px' }}>
                                Channels
                            </div>
                            {filteredChannels.slice(0, 8).map((ch, idx) => (
                                <div
                                    key={ch.id}
                                    onClick={() => insertChannelMention(ch.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: channelIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                        transition: 'background 0.1s'
                                    }}
                                    onMouseEnter={() => setChannelIndex(idx)}
                                >
                                    <Hash size={18} style={{ color: 'var(--text-muted)' }} />
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{ch.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <SoundboardMenu
                        isOpen={soundboardOpen}
                        onClose={() => setSoundboardOpen(false)}
                        onPlaySound={handlePlaySound}
                    />

                    {isRecording ? (
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '12px', padding: '0 8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--error)', animation: 'pulse 1.5s infinite', flexShrink: 0 }}></div>
                            <span style={{ color: 'var(--error)', fontWeight: 600, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{formatTime(recordingTime)}</span>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: '24px', opacity: 0.5 }}>
                                {WAVEFORM_HEIGHTS.map((h, i) => (
                                    <div key={i} style={{ width: '4px', height: `${h}px`, background: 'var(--error)', borderRadius: '2px', animation: `pulse ${0.7 + i * 0.1}s infinite alternate` }} />
                                ))}
                            </div>
                            <select
                                value={voiceExpiry ?? ''}
                                onChange={e => setVoiceExpiry(e.target.value ? Number(e.target.value) : null)}
                                style={{ fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-secondary)', padding: '2px 4px', cursor: 'pointer', flexShrink: 0 }}
                                title="Voice message expiry"
                            >
                                <option value="">Never expires</option>
                                <option value={3600}>1 hour</option>
                                <option value={86400}>24 hours</option>
                                <option value={604800}>7 days</option>
                            </select>
                            <button className="input-icon-btn" style={{ color: 'var(--text-secondary)' }} onClick={cancelRecording} title="Cancel">
                                <Square size={18} />
                            </button>
                            <button className="input-icon-btn primary" onClick={handleSendVoiceNote} title="Send voice message">
                                <Send size={18} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <input id="channel-file-upload" type="file" multiple ref={chatFileInputRef} style={{ display: 'none' }} onChange={(e) => {
                                const files = e.target.files;
                                if (!files) return;
                                const newFiles = Array.from(files).map(f => ({
                                    name: f.name,
                                    size: f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`,
                                    file: f,
                                    previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
                                }));
                                setChatAttachedFiles(prev => [...prev, ...newFiles]);
                                e.target.value = '';
                            }} />
                            <label htmlFor={channelAttachmentsEnabled ? "channel-file-upload" : undefined} className="input-icon-btn" title={channelAttachmentsEnabled ? "Upload Attachment" : "Attachments disabled in this channel"} aria-label="Upload attachment" role="button" style={channelAttachmentsEnabled ? { cursor: 'pointer' } : { opacity: 0.3, cursor: 'not-allowed' }}>
                                <Plus size={20} />
                            </label>
                            {hasDraft && !editingMessage && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 15%, transparent)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Draft</span>
                            )}
                            <textarea
                                className="chat-input"
                                aria-label="Message input"
                                rows={1}
                                placeholder={`Message #${channelName}...`}
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={handleInputKeyDown}
                                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = '24px'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }}
                                onPaste={(e) => {
                                    const items = e.clipboardData?.items;
                                    if (!items) return;
                                    for (const item of Array.from(items)) {
                                        if (item.type.startsWith('image/')) {
                                            e.preventDefault();
                                            const file = item.getAsFile();
                                            if (file && channelAttachmentsEnabled) {
                                                setChatAttachedFiles(prev => [...prev, {
                                                    name: file.name || `pasted-image.${item.type.split('/')[1] || 'png'}`,
                                                    size: file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`,
                                                    file,
                                                    previewUrl: URL.createObjectURL(file),
                                                }]);
                                            }
                                            break;
                                        }
                                    }
                                }}
                            />
                            {(() => { const wireLen = resolveWireContent(inputValue).length; return !editingMessage && wireLen > 1800 ? (
                                <span style={{ fontSize: '11px', fontWeight: 600, color: wireLen > 2000 ? 'var(--error)' : 'var(--warning)', flexShrink: 0, padding: '0 4px' }}>
                                    {wireLen}/2000
                                </span>
                            ) : null; })()}
                            <button className="input-icon-btn" title="Record Voice Note" aria-label="Record voice note" onClick={startRecording}>
                                <Mic size={20} />
                            </button>
                            {/* Formatting Toolbar Toggle */}
                            <button
                                className={`input-icon-btn ${showFormattingToolbar ? 'primary' : ''}`}
                                title="Toggle Formatting Toolbar"
                                onClick={() => setShowFormattingToolbar(p => !p)}
                            >
                                <Edit2 size={16} />
                            </button>
                            {/* Embed Builder Toggle */}
                            <button
                                className={`input-icon-btn ${showEmbedBuilder ? 'primary' : ''}`}
                                title="Embed Builder"
                                onClick={() => setShowEmbedBuilder(p => !p)}
                            >
                                <FileText size={16} />
                            </button>
                            {/* Feature 5: Markdown Preview Toggle */}
                            <button
                                className={`input-icon-btn ${showPreview ? 'primary' : ''}`}
                                title="Toggle Markdown Preview (Ctrl+Shift+P)"
                                onClick={() => setShowPreview(p => !p)}
                            >
                                <Eye size={18} />
                            </button>
                            {inputValue.trim().length === 0 && (
                                <>
                                    <button className={`input-icon-btn ${isEmojiPickerOpen ? 'primary' : ''}`} title="Select Emoji" aria-label="Open emoji picker" onClick={() => { setIsEmojiPickerOpen(!isEmojiPickerOpen); setStickerPickerOpen(false); if (isEmojiPickerOpen) setReactionTargetMessageApiId(null); }} style={{ position: 'relative' }}>
                                        <Smile size={20} />
                                        <span className="shortcut-hint" style={{ position: 'absolute', bottom: '-14px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: 'var(--text-muted)', opacity: 0.4, whiteSpace: 'nowrap', pointerEvents: 'none', fontWeight: 500 }}>Ctrl+E</span>
                                    </button>
                                    {/* Feature 19: Sticker Picker Button */}
                                    <button className={`input-icon-btn ${stickerPickerOpen ? 'primary' : ''}`} title="Sticker Picker" onClick={() => { setStickerPickerOpen(!stickerPickerOpen); setIsEmojiPickerOpen(false); setReactionTargetMessageApiId(null); }}>
                                        <Square size={18} />
                                    </button>
                                    <button className="input-icon-btn" title="Create Poll" onClick={() => setShowPollCreator(!showPollCreator)}>
                                        <BarChart2 size={20} />
                                    </button>
                                    <button className={`input-icon-btn ${soundboardOpen ? 'primary' : ''}`} title="Soundboard" onClick={() => setSoundboardOpen(!soundboardOpen)}>
                                        <Volume2 size={20} />
                                    </button>
                                </>
                            )}
                            {inputValue.trim().length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                        className="input-icon-btn"
                                        title="Schedule Message"
                                        onClick={() => setIsScheduleOpen(!isScheduleOpen)}
                                        style={{ color: isScheduleOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                    >
                                        <Clock size={18} />
                                    </button>
                                    <button
                                        className="input-icon-btn primary"
                                        aria-label={rateLimitRemaining > 0 ? `Rate limited, wait ${rateLimitRemaining}s` : 'Send message'}
                                        onClick={handleSendMessage}
                                        disabled={rateLimitRemaining > 0}
                                        style={{ position: 'relative', opacity: rateLimitRemaining > 0 ? 0.5 : 1, cursor: rateLimitRemaining > 0 ? 'not-allowed' : undefined }}
                                    >
                                        {rateLimitRemaining > 0 ? <span style={{ fontSize: '12px', fontWeight: 700 }}>{rateLimitRemaining}s</span> : <Send size={18} />}
                                        <span className="shortcut-hint" style={{ position: 'absolute', bottom: '-14px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: 'var(--text-muted)', opacity: 0.4, whiteSpace: 'nowrap', pointerEvents: 'none', fontWeight: 500 }}>Enter</span>
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Slash Command Picker Popover */}
                    {slashSearch !== null && filteredCommands.length > 0 && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '8px', width: '340px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '300px', overflowY: 'auto' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', padding: '0 8px' }}>COMMANDS</div>
                            {filteredCommands.map((cmd, idx) => (
                                <div
                                    key={cmd.id}
                                    onClick={() => selectSlashCommand(cmd)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: slashIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                    }}
                                >
                                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>/</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>/{cmd.name}</div>
                                        {cmd.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cmd.description}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Emoji Autocomplete Popover */}
                    {emojiSearch !== null && filteredEmojis.length > 0 && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '8px', width: '260px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', padding: '0 8px' }}>EMOJIS MATCHING "{emojiSearch}"</div>
                            {filteredEmojis.map((emoji, idx) => (
                                <div
                                    key={emoji.name}
                                    onClick={() => insertEmoji(emoji.name)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: emojiIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                        transition: 'background 0.1s'
                                    }}
                                    onMouseEnter={() => setEmojiIndex(idx)}
                                >
                                    {emoji.isCustom && emoji.url ? (
                                        <img src={emoji.url} alt={emoji.name} loading="lazy" decoding="async" width={20} height={20} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                    ) : (
                                        <span style={{ fontSize: '20px' }}>{emoji.isCustom ? emoji.name : emoji.emoji}</span>
                                    )}
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>:{emoji.name}:</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Emoji Picker Popover */}
                    {isEmojiPickerOpen && (
                        <EmojiPicker
                            onSelectEmoji={(emoji) => {
                                if (reactionTargetMessageApiId) {
                                    handleReaction(reactionTargetMessageApiId, emoji, false);
                                    setReactionTargetMessageApiId(null);
                                    setIsEmojiPickerOpen(false);
                                    return;
                                }
                                setInputValue(prev => prev + emoji);
                            }}
                            onSendGif={handleSendGif}
                            onStickerSelect={handleSendSticker}
                            guildId={guildId}
                        />
                    )}

                    {/* GIF Reaction Picker */}
                    {showGifPicker && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', right: '100px', zIndex: 15 }}>
                            <GifReactionPicker
                                onSelect={(gifUrl) => {
                                    handleSendGif(gifUrl, gifUrl);
                                    setShowGifPicker(false);
                                }}
                                onClose={() => setShowGifPicker(false)}
                            />
                        </div>
                    )}

                    {/* Feature 19: Sticker Picker Panel */}
                    {stickerPickerOpen && (
                        <div style={{
                            position: 'absolute', bottom: 'calc(100% + 12px)', right: '16px',
                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                            borderRadius: '12px', padding: '12px', width: '320px', maxHeight: '360px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10,
                            display: 'flex', flexDirection: 'column', gap: '8px',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Stickers</span>
                                <button onClick={() => setStickerPickerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>
                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                {guildStickers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        No stickers available in this server
                                    </div>
                                ) : (
                                    (() => {
                                        // Group stickers by pack name
                                        const packs = new Map<string, typeof guildStickers>();
                                        for (const s of guildStickers) {
                                            const pack = s.packName || 'Stickers';
                                            if (!packs.has(pack)) packs.set(pack, []);
                                            packs.get(pack)!.push(s);
                                        }
                                        return Array.from(packs.entries()).map(([packName, stickers]) => (
                                            <div key={packName}>
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0', marginBottom: '4px' }}>
                                                    {packName}
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                                                    {stickers.map(sticker => (
                                                        <div
                                                            key={sticker.id}
                                                            onClick={() => {
                                                                handleSendSticker(sticker);
                                                                setStickerPickerOpen(false);
                                                            }}
                                                            style={{
                                                                cursor: 'pointer', borderRadius: '8px', padding: '4px',
                                                                background: 'var(--bg-tertiary)', border: '1px solid transparent',
                                                                transition: 'border-color 0.15s, background 0.15s',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                aspectRatio: '1',
                                                            }}
                                                            className="hover-sticker-item"
                                                            title={sticker.name}
                                                        >
                                                            <img src={sticker.url} alt={sticker.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ));
                                    })()
                                )}
                            </div>
                        </div>
                    )}

                    {/* Schedule Message Popover */}
                    {isScheduleOpen && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', width: 'min(300px, 90vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '16px', animation: 'scaleIn 0.2s ease-out' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={16} color="var(--accent-primary)" />
                                    Schedule Message
                                </div>
                                <button onClick={() => setIsScheduleOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Date</label>
                                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', padding: '8px', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Time</label>
                                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', padding: '8px', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                                </div>
                            </div>

                            <button className="auth-button" style={{ margin: 0, padding: '8px 0', height: 'auto', fontSize: '13px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)' }} onClick={() => {
                                if (!channelId || !scheduleDate || !scheduleTime) {
                                    addToast({ title: 'Pick a date and time', variant: 'error' });
                                    return;
                                }
                                const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
                                const processedContent = processEmojis(resolveWireContent(inputValue));
                                fetch(`${API_BASE}/channels/${channelId}/messages`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ content: processedContent || ' ', scheduledAt }),
                                }).then(r => {
                                    if (r.ok) {
                                        r.json().then(sm => {
                                            setScheduledMessages(prev => [...prev, sm]);
                                            addToast({ title: 'Message scheduled', variant: 'success' });
                                        });
                                    } else {
                                        addToast({ title: 'Failed to schedule', variant: 'error' });
                                    }
                                }).catch(() => addToast({ title: 'Failed to schedule', variant: 'error' }));
                                setIsScheduleOpen(false);
                                setInputValue('');
                                mentionsMapRef.current.clear();
                                setScheduleDate('');
                                setScheduleTime('');
                                setHasDraft(false);
                                if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
                            }}>
                                Schedule Message
                            </button>
                        </div>
                    )}

                    {showPollCreator && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            right: '80px',
                            marginBottom: '8px',
                            width: 'min(360px, 90vw)',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            zIndex: 100,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <BarChart2 size={16} color="var(--accent-primary)" />
                                    Create Poll
                                </div>
                                <button onClick={() => setShowPollCreator(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Question</label>
                                <input
                                    type="text"
                                    value={pollQuestion}
                                    onChange={e => setPollQuestion(e.target.value)}
                                    placeholder="Ask a question..."
                                    style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Options</label>
                                {pollOptions.map((option, index) => (
                                    <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={e => {
                                                const updated = [...pollOptions];
                                                updated[index] = e.target.value;
                                                setPollOptions(updated);
                                            }}
                                            placeholder={`Option ${index + 1}`}
                                            style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {pollOptions.length < 6 && (
                                    <button
                                        onClick={() => setPollOptions([...pollOptions, ''])}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px dashed var(--stroke)', color: 'var(--text-secondary)', padding: '8px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', justifyContent: 'center' }}
                                    >
                                        <Plus size={14} />
                                        Add Option
                                    </button>
                                )}
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <input type="checkbox" checked={pollMultiselect} onChange={e => setPollMultiselect(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                                Allow multiple votes
                            </label>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Poll Duration</label>
                                <select
                                    value={pollDuration ?? ''}
                                    onChange={e => setPollDuration(e.target.value ? Number(e.target.value) : null)}
                                    style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                                >
                                    <option value="">No expiry</option>
                                    <option value={60}>1 hour</option>
                                    <option value={60 * 6}>6 hours</option>
                                    <option value={60 * 24}>24 hours</option>
                                    <option value={60 * 24 * 3}>3 days</option>
                                    <option value={60 * 24 * 7}>7 days</option>
                                </select>
                            </div>

                            <button
                                onClick={submitPoll}
                                style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', padding: '8px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                            >
                                Create Poll
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {
                activeThreadMessage && channelId && (
                    <ThreadPanel
                        originalMessage={activeThreadMessage}
                        channelId={channelId}
                        onClose={() => setActiveThreadMessage(null)}
                        onJumpToParent={() => {
                            if (!activeThreadMessage?.apiId) return;
                            const el = document.querySelector<HTMLElement>(`[data-message-id="${activeThreadMessage.apiId}"]`);
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setHighlightedMessageId(activeThreadMessage.id);
                                setTimeout(() => setHighlightedMessageId(null), 2500);
                            } else {
                                setHighlightedMessageId(activeThreadMessage.id);
                                setTimeout(() => setHighlightedMessageId(null), 2500);
                            }
                        }}
                    />
                )
            }

            {profilePopover && (
                <UserProfilePopover
                    user={{
                        id: profilePopover.userId,
                        name: profilePopover.user,
                        handle: profilePopover.user.toLowerCase().replace(/\s+/g, '_'),
                        status: 'online',
                        guildId: guildId,
                    }}
                    position={{ x: profilePopover.x, y: profilePopover.y }}
                    onClose={() => setProfilePopover(null)}
                    onMessage={async () => {
                        const userId = profilePopover.userId;
                        setProfilePopover(null);
                        if (userId) {
                            try {
                                const dm = await api.relationships.openDm(userId) as any;
                                navigate(`/dm/${dm.id}`);
                            } catch {
                                addToast({ title: 'Failed to open DM', variant: 'error' });
                            }
                        }
                    }}
                    onAddFriend={async () => {
                        const userId = profilePopover.userId;
                        setProfilePopover(null);
                        if (userId) {
                            try {
                                await api.relationships.sendFriendRequest(userId);
                                addToast({ title: 'Friend request sent!', variant: 'success' });
                            } catch {
                                addToast({ title: 'Failed to send friend request', variant: 'error' });
                            }
                        }
                    }}
                />
            )}

            {/* Feature 4: Image Gallery Lightbox */}
            {lightboxUrl && (() => {
                const allImageUrls: string[] = [];
                for (const m of messages) {
                    if (m.mediaUrl && /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(m.mediaUrl)) {
                        allImageUrls.push(m.mediaUrl);
                    }
                    if (m.attachments) {
                        for (const att of m.attachments) {
                            if (att.mimeType?.startsWith('image/')) {
                                allImageUrls.push(att.url);
                            }
                        }
                    }
                }
                return (
                    <ImageLightbox
                        url={lightboxUrl}
                        imageUrls={allImageUrls}
                        onClose={() => setLightboxUrl(null)}
                        onNavigate={(url) => setLightboxUrl(url)}
                    />
                );
            })()}

            {/* Member List Panel */}
            {memberListOpen && guildId && (
                <div style={{
                    position: 'absolute', right: 0, top: '64px', bottom: 0, zIndex: 4,
                    width: 'min(240px, 90vw)',
                }}>
                    <MemberListPanel
                        guildId={guildId}
                        onMemberClick={(userId, displayName, e) => {
                            setProfilePopover({
                                userId,
                                user: displayName,
                                x: e.clientX,
                                y: e.clientY,
                            });
                        }}
                    />
                </div>
            )}

            {/* Forward Modal */}
            {forwardingMessage && (
                <ForwardModal
                    message={{ author: forwardingMessage.author, content: forwardingMessage.content, mediaUrl: forwardingMessage.mediaUrl }}
                    onClose={() => setForwardingMessage(null)}
                    onForward={(destinations, note) => {
                        addToast({ title: 'Message Forwarded', description: `Sent to ${destinations.length} destination${destinations.length > 1 ? 's' : ''}`, variant: 'success' });
                        setForwardingMessage(null);
                    }}
                />
            )}

            {showMediaGallery && guildId && (
                <SharedMediaGallery guildId={guildId} onClose={() => setShowMediaGallery(false)} />
            )}

            {confirmDialog && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
                    onClick={() => setConfirmDialog(null)}
                >
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90vw', border: '1px solid var(--stroke)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>{confirmDialog.title}</h3>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>{confirmDialog.description}</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setConfirmDialog(null)} style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                            <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--error)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            </div>
        </main >
    );
};

export default ChannelChat;
