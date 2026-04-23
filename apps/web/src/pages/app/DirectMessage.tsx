import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { ConnectionState } from 'livekit-client';
import { Plus, Smile, Send, Phone, Video, Info, Image as ImageIcon, X, PhoneOff, MicOff, Mic, VideoOff, Settings, MonitorUp, Headphones, HeadphoneOff, Volume2, Loader2, Share2, Reply, Copy, Trash2, Download, FileIcon, ChevronDown, ChevronUp, Check, CheckCheck, Users, UserPlus, UserMinus, Pencil, LogOut, Clock, Lock, Star, Shield, ArrowLeft, MessageSquare, Pin, Link2, FolderArchive, Upload, Search } from 'lucide-react';
import JSZip from 'jszip';
import { getOrCreateKeyPair, exportPublicKey, importPublicKey, deriveSharedKey, encrypt, decrypt, isE2ESupported, generateGroupKey, encryptGroupKey, decryptGroupKey, computeSafetyNumber, encryptFile, decryptFile } from '../../lib/e2e';
import { onGroupKeyRotationNeeded, onUserKeyChanged, onE2EStateChanged } from '../../lib/socket';
import type { GroupKeyRotationNeededPayload, UserKeyChangedPayload, E2EStateChangedPayload } from '../../lib/socket';

import { BackgroundMedia } from '../../components/ui/BackgroundMedia';
import { useToast } from '../../components/ui/ToastManager';
import { useContextMenu } from '../../components/ui/ContextMenu';
import EmojiPicker from '../../components/chat/EmojiPicker';
import ForwardModal from '../../components/modals/ForwardModal';
import ThreadPanel from '../../components/chat/ThreadPanel';
import EditHistoryPopover from '../../components/chat/EditHistoryPopover';
import { RichTextRenderer } from '../../components/chat/RichTextRenderer';
import { LazyEmbed, type OgEmbed } from '../../components/chat/EmbedCard';
import { SkeletonMessageList } from '../../components/ui/SkeletonLoader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { api, ApiRequestError, RateLimitError, API_BASE, getAccessToken } from '../../lib/api';
import { classifyCallErrorToast, getConnectionErrorHint } from '../../lib/callErrors';
import { markRead as markReadStore } from '../../store/unreadStore';
import { getSocket, joinChannel as socketJoinChannel, leaveChannel as socketLeaveChannel } from '../../lib/socket';
import { onTypingStart, onMessageCreate, onMessageUpdate, onMessageDelete, onReactionAdd, onReactionRemove, onMessageRead, onCallAnswer, onCallReject, onPresenceUpdate, onThreadCreate, type TypingStartPayload, type MessageCreatePayload, type MessageUpdatePayload, type MessageDeletePayload, type ReactionPayload, type MessageReadPayload, type PresenceUpdatePayload } from '../../lib/socket';
import { getDeterministicGradient } from '../../utils/colors';
import { copyToClipboard } from '../../utils/clipboard';
import { useLiveKit, type LiveKitParticipant } from '../../lib/useLiveKit';
import Avatar from '../../components/ui/Avatar';
import UserProfilePopover from '../../components/ui/UserProfilePopover';
import FriendshipStreak from '../../components/chat/FriendshipStreak';
import { useIsMobile } from '../../hooks/useIsMobile';
import { saveScrollPosition, getScrollPosition } from '../../store/scrollPositionStore';
import { useVoice } from '../../contexts/VoiceContext';
import { leaveVoiceSession } from '../../lib/voiceSession';

type MediaType = 'image' | 'video';

type OutletContextType = {
    bgMedia: { url: string, type: MediaType } | null;
    hasCustomBg: boolean;
    setBgMedia: (media: { url: string, type: MediaType } | null) => void;
    setActiveModal?: (modal: 'settings' | 'userProfile' | 'createGuild' | 'screenShare' | null) => void;
    userProfile?: {
        id?: string;
        avatarHash?: string | null;
        avatarFrame?: 'none' | 'neon' | 'gold' | 'glass';
        nameplateStyle?: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch';
    };
};

type MessageAttachment = {
    id: string;
    filename: string;
    url: string;
    contentType: string;
    size: number;
};

type Message = {
    id: number;
    apiId?: string;
    authorId?: string;
    author: string;
    system: boolean;
    avatar: React.ReactNode | string;
    time: string;
    content: string;
    edited?: boolean;
    reactions?: { emoji: string; count: number; me: boolean }[];
    type?: 'text' | 'media';
    mediaUrl?: string;
    mediaAspectRatio?: number;
    forwarded?: boolean;
    forwardedFrom?: string;
    replyToId?: string;
    replyToAuthor?: string;
    replyToContent?: string;
    attachments?: MessageAttachment[];
    authorAvatarHash?: string | null;
    authorNameplateStyle?: string | null;
    expiresAt?: string | null;
    createdAt?: string | null;
    isEncrypted?: boolean;
    encryptedContent?: string | null;
    threadReplyCount?: number;
    embeds?: any[];
    isPinned?: boolean;
};

function getPrimaryRemoteParticipant(participants: LiveKitParticipant[], expectedParticipantId?: string | null): LiveKitParticipant | null {
    if (participants.length === 0) return null;

    if (expectedParticipantId) {
        const exactMatch = participants.find((participant) => participant.id === expectedParticipantId);
        if (exactMatch) return exactMatch;
    }

    const screenSharer = participants.find((participant) => participant.isScreenSharing);
    if (screenSharer) return screenSharer;

    const cameraParticipant = participants.find((participant) => participant.isCameraOn || participant.videoTrack || participant.screenTrack);
    if (cameraParticipant) return cameraParticipant;

    const speakingParticipant = participants.find((participant) => participant.isSpeaking || participant.audioLevel > 0);
    if (speakingParticipant) return speakingParticipant;

    return participants[0] ?? null;
}

// Video element component for rendering participant video
const ParticipantVideo = ({ track }: { track: any }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
        if (track?.mediaStreamTrack && videoRef.current) {
            const stream = new MediaStream([track.mediaStreamTrack]);
            videoRef.current.srcObject = stream;
        }
        return () => {
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [track]);
    
    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                background: '#000',
                borderRadius: 'var(--radius-lg)',
            }}
        />
    );
};

const ReactionBadge = ({ emoji, count, me, messageApiId, channelId, onReaction }: { emoji: string; count: number; me: boolean; messageApiId?: string; channelId?: string; onReaction?: (apiId: string, emoji: string, me: boolean) => void }) => {
    const [tooltip, setTooltip] = useState<{ users: Array<{ displayName?: string; username: string }>; total: number } | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        if (!messageApiId || !channelId) return;
        timerRef.current = setTimeout(() => {
            fetch(`${API_BASE}/channels/${channelId}/messages/${messageApiId}/reactions/${encodeURIComponent(emoji)}`, {
                headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
            }).then(r => r.ok ? r.json() : []).then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setTooltip({ users: data.slice(0, 5), total: count });
                }
            }).catch(() => {});
        }, 300);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setTooltip(null);
    };

    return (
        <button
            onClick={() => onReaction?.(messageApiId!, emoji, me)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: me ? 'rgba(var(--accent-primary-rgb, 139,92,246), 0.15)' : 'var(--bg-tertiary)', border: `1px solid ${me ? 'var(--accent-primary)' : 'var(--stroke)'}`, cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'all 0.15s', position: 'relative' }}
        >
            <span>{emoji}</span> <span style={{ fontSize: '11px', fontWeight: 600 }}>{count}</span>
            {tooltip && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 50, whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-primary)', pointerEvents: 'none' }}>
                    {tooltip.users.map((u, i) => (
                        <span key={i}>{u.displayName || u.username}{i < tooltip.users.length - 1 ? ', ' : ''}</span>
                    ))}
                    {tooltip.total > 5 && <span style={{ color: 'var(--text-muted)' }}> and {tooltip.total - 5} more</span>}
                </div>
            )}
        </button>
    );
};

const DirectMessage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { bgMedia, hasCustomBg, setBgMedia, setActiveModal, userProfile } = useOutletContext<OutletContextType>();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const [dmAttachedFiles, setDmAttachedFiles] = useState<{file: File, name: string, size: string, previewUrl?: string}[]>([]);
    const [dmUploadProgress, setDmUploadProgress] = useState<Record<string, number>>({});
    const recentDmAttachmentFingerprintsRef = useRef<Map<string, number>>(new Map());
    const [isDragOver, setIsDragOver] = useState(false);
    const [showDmUploadMenu, setShowDmUploadMenu] = useState(false);
    const dmFolderInputRef = useRef<HTMLInputElement>(null);
    const [infoPanelOpen, setInfoPanelOpen] = useState(false);
    const isMobile = useIsMobile();
    const { addToast } = useToast();
    const { openMenu } = useContextMenu();
    const voiceCtx = useVoice();

    // Emoji picker state
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

    // API 429 rate-limit cooldown with countdown
    const [rateLimitRemaining, setRateLimitRemaining] = useState(0);
    const [isSendingMessage, setIsSendingMessage] = useState(false);
    const isSendingMessageRef = useRef(false);
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

    // Call history state
    const [callHistory, setCallHistory] = useState<Array<{ id: string; startedAt: string; endedAt?: string; duration?: number; participants: string[]; missed?: boolean }>>([]);

    // Calling/ringing state
    const [isRinging, setIsRinging] = useState(false);

    // Mention autocomplete state (for group DMs)
    const [mentionSearch, setMentionSearch] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);

    // Group DM state
    const [isGroupDm, setIsGroupDm] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupOwnerId, setGroupOwnerId] = useState<string | null>(null);
    const [groupParticipants, setGroupParticipants] = useState<Array<{ id: string; username: string; displayName: string; avatarHash: string | null; status: string }>>([]);
    const [memberPanelOpen, setMemberPanelOpen] = useState(false);
    const [isEditingGroupName, setIsEditingGroupName] = useState(false);
    const [replyingTo, setReplyingTo] = useState<{ id: number; apiId?: string; author: string; content: string } | null>(null);
    const [editingMessage, setEditingMessage] = useState<{ id: number; apiId: string; content: string } | null>(null);
    const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);
    const [editGroupNameValue, setEditGroupNameValue] = useState('');
    const [addMemberInput, setAddMemberInput] = useState('');
    const [showAddMember, setShowAddMember] = useState(false);

    const normalizeChannelType = useCallback((type: string | null | undefined) => {
        return String(type ?? '').trim().toUpperCase().replace(/-/g, '_');
    }, []);

    const [dmChannelId, setDmChannelId] = useState<string>('');
    const [isResolvingDmChannel, setIsResolvingDmChannel] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [messagesError, setMessagesError] = useState(false);
    const [messagesErrorDetail, setMessagesErrorDetail] = useState<string | null>(null);
    const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
    const [showPinnedPanel, setShowPinnedPanel] = useState(false);

    const resolveDmChannelId = useCallback(async (routeId: string) => {
        let channel: any = null;
        try {
            channel = await api.channels.get(routeId);
        } catch (err) {
            if (err instanceof ApiRequestError && err.status !== 404) {
                throw err;
            }
        }

        if (channel) {
            const channelType = normalizeChannelType(channel.type);
            if (channelType === 'DM' || channelType === 'GROUP_DM') {
                return routeId;
            }
            throw new Error('This route is not a direct message channel.');
        }

        const dm = await api.relationships.openDm(routeId);
        if (!dm?.id) {
            throw new Error('Unable to resolve direct message channel.');
        }
        return dm.id as string;
    }, [normalizeChannelType]);

    const loadPinnedMessages = useCallback(async () => {
        if (!dmChannelId) return;
        try {
            const pinned = await api.messages.getPins(dmChannelId);
            const formatted: Message[] = (pinned ?? []).map((m: any, i: number) => ({
                id: -(i + 1),
                apiId: m.id,
                author: m.author?.displayName ?? m.author?.username ?? 'Unknown',
                authorId: m.authorId,
                authorAvatarHash: m.author?.avatarHash,
                content: m.content ?? '',
                time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                attachments: m.attachments ?? [],
                reactions: m.reactions ?? [],
                system: false,
                avatar: null,
                isPinned: true,
            }));
            setPinnedMessages(formatted);
        } catch {
            addToast({ title: 'Could not load pinned messages', variant: 'error' });
        }
    }, [dmChannelId, addToast]);

    useEffect(() => {
        if (showPinnedPanel) loadPinnedMessages();
    }, [showPinnedPanel, loadPinnedMessages]);

    // Search state — must be declared before the callbacks below that close over them
    const [showSearchBar, setShowSearchBar] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ id: string }>>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const performDmSearch = useCallback((query: string) => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (!query.trim() || !dmChannelId) {
            setSearchResults([]);
            setCurrentSearchIndex(0);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const res = await api.search.messages({ query: query.trim(), channelId: dmChannelId, limit: 50 });
                setSearchResults(res.results || []);
                setCurrentSearchIndex(0);
                if (res.results && res.results.length > 0) {
                    const firstId = res.results[0].id;
                    const el = document.querySelector(`[data-message-id="${firstId}"]`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setHighlightedMsgId(parseInt(firstId, 36) || 0);
                        setTimeout(() => setHighlightedMsgId(null), 2500);
                    }
                }
            } catch {
                addToast({ title: 'Search failed', variant: 'error' });
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    }, [dmChannelId, addToast]);

    const navigateDmSearchResult = useCallback((direction: 'up' | 'down') => {
        if (searchResults.length === 0) return;
        const newIndex = direction === 'down'
            ? (currentSearchIndex + 1) % searchResults.length
            : (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        setCurrentSearchIndex(newIndex);
        const resultId = searchResults[newIndex].id;
        const el = document.querySelector(`[data-message-id="${resultId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMsgId(parseInt(resultId, 36) || 0);
            setTimeout(() => setHighlightedMsgId(null), 2500);
        }
    }, [searchResults, currentSearchIndex]);

    const closeDmSearch = useCallback(() => {
        setShowSearchBar(false);
        setSearchQuery('');
        setSearchResults([]);
        setCurrentSearchIndex(0);
        setIsSearching(false);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    }, []);

    // Ctrl+F opens search bar
    useEffect(() => {
        const handleGlobalKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setShowSearchBar(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
            if (e.key === 'Escape' && showSearchBar) {
                closeDmSearch();
            }
        };
        window.addEventListener('keydown', handleGlobalKey);
        return () => window.removeEventListener('keydown', handleGlobalKey);
    }, [showSearchBar, closeDmSearch]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!id) {
                setDmChannelId('');
                setIsResolvingDmChannel(false);
                setIsLoadingMessages(false);
                return;
            }

            setIsResolvingDmChannel(true);
            setDmChannelId('');
            try {
                const resolvedId = await resolveDmChannelId(id);
                if (cancelled) return;
                setDmChannelId(resolvedId);
                if (resolvedId !== id) {
                    const query = searchParams.toString();
                    navigate(`/dm/${resolvedId}${query ? `?${query}` : ''}`, { replace: true });
                }
            } catch (err) {
                if (cancelled) return;
                const description = err instanceof Error ? err.message : 'Could not resolve this conversation.';
                addToast({ title: 'Conversation unavailable', description, variant: 'error' });
                setDmChannelId('');
                setIsLoadingMessages(false);
            } finally {
                if (!cancelled) setIsResolvingDmChannel(false);
            }
        };

        run();
        return () => { cancelled = true; };
    }, [id, navigate, resolveDmChannelId, searchParams, addToast]);

    // Clear unread state in sidebar when DM channel is opened
    useEffect(() => {
        if (dmChannelId) markReadStore(dmChannelId);
    }, [dmChannelId]);

    // Forward modal state
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

    // Profile popover state
    const [profilePopover, setProfilePopover] = useState<{ user: string; userId: string; x: number; y: number } | null>(null);

    // Reaction state
    const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
    const [highlightedMsgId, setHighlightedMsgId] = useState<number | null>(null);
    const [reactionPickerMessageId, setReactionPickerMessageId] = useState<number | null>(null);
    const reactionPickerRef = useRef<HTMLDivElement>(null);
    const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

    // Volume panel state
    const [showVolumePanel, setShowVolumePanel] = useState(false);
    const [masterVolume, setMasterVolume] = useState(100);
    const [otherUserVolume, setOtherUserVolume] = useState(100);
    const volumePanelRef = useRef<HTMLDivElement>(null);
    const [openDeviceMenu, setOpenDeviceMenu] = useState<'audio' | 'video' | null>(null);
    const deviceMenuRef = useRef<HTMLDivElement>(null);

    // Whether user wants to start with video
    const [_startWithVideo, setStartWithVideo] = useState(false);

    // LiveKit hook for real-time voice/video
    const {
        isConnected,
        isConnecting,
        connectionError,
        connectionState,
        isMuted,
        isDeafened,
        isCameraOn,
        isScreenSharing,
        participants,
        localParticipant,
        connect,
        disconnect,
        toggleMute,
        toggleDeafen,
        toggleCamera,
        startScreenShare,
        stopScreenShare,
        setMasterVolume: setLivekitMasterVolume,
        setParticipantVolume,
        audioInputDevices,
        videoInputDevices,
        selectedAudioInputId,
        selectedVideoInputId,
        refreshDevices,
        selectAudioInput,
        selectVideoInput,
        streamQuality,
        setStreamQuality,
    } = useLiveKit({
        channelId: dmChannelId,
        onParticipantJoined: useCallback((participant: LiveKitParticipant) => {
            addToast({ title: 'User Joined', description: `${participant.name} joined the call.`, variant: 'info' });
        }, [addToast]),
        onParticipantLeft: useCallback((_participantId: string) => {
            addToast({ title: 'User Left', description: 'The other user left the call.', variant: 'info' });
        }, [addToast]),
    });

    const lastCallErrorRef = useRef<string | null>(null);
    const showCallErrorToast = useCallback((error: unknown) => {
        const details = classifyCallErrorToast(error);
        if (lastCallErrorRef.current === details.description) return;
        lastCallErrorRef.current = details.description;
        addToast({ title: details.title, description: details.description, variant: 'error' });
    }, [addToast]);

    const clearCallErrorToastDedup = useCallback(() => {
        lastCallErrorRef.current = null;
    }, []);

    const handleUploadBg = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            addToast({ title: 'File too large', description: 'Background files must be under 5MB.', variant: 'error' });
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const isVideo = file.type.startsWith('video/');
            setBgMedia({ url: dataUrl, type: isVideo ? 'video' : 'image' });
        };
        reader.readAsDataURL(file);
    };

    // Fetch current user info
    const [currentUserName, setCurrentUserName] = useState('');
    const [currentUserId, setCurrentUserId] = useState('');
    useEffect(() => {
        api.users.getMe().then(me => {
            setCurrentUserName(me.profile?.displayName || me.username);
            setCurrentUserId(me.id);
        }).catch(() => { addToast({ title: 'Failed to load user info', variant: 'error' }); });
    }, []);

    // Read receipts state (A1)
    const [partnerLastReadAt, setPartnerLastReadAt] = useState<string | null>(null);
    const [partnerLastReadMessageId, setPartnerLastReadMessageId] = useState<string | null>(null);

    // NEW message divider — current user's last-read message ID (fetched before ack)
    const [myLastReadMessageId, setMyLastReadMessageId] = useState<string | null>(null);

    // Disappearing messages timer state (A2)
    const [disappearTimer, setDisappearTimer] = useState<number | null>(null);

    // E2E encryption state
    const [e2eKey, setE2eKey] = useState<CryptoKey | null>(null);
    const [e2eSupported, setE2eSupported] = useState(false);
    const [e2eError, setE2eError] = useState<string | null>(null);
    const [e2eRecoveryRequired, setE2eRecoveryRequired] = useState(false);
    const [e2eBootstrapNonce, setE2eBootstrapNonce] = useState(0);
    const [partnerKeyChanged, setPartnerKeyChanged] = useState(false);
    // E2E opt-in: synced via server — when one user enables, both get notified.
    const [e2eEnabled, setE2eEnabled] = useState(false);
    const [showE2eGuide, setShowE2eGuide] = useState(() => {
        return !localStorage.getItem('gratonite:e2e-guide-dismissed');
    });
    // Whether all GROUP_DM members have registered public keys (controls lock icon)
    const [groupE2eAllMembersHaveKeys, setGroupE2eAllMembersHaveKeys] = useState(false);
    // Current group key version (for tagging outgoing messages)
    const [groupKeyVersion, setGroupKeyVersion] = useState<number | null>(null);
    // Map of messageId -> decrypted plaintext (populated asynchronously)
    const [decryptedContents, setDecryptedContents] = useState<Map<number, string>>(new Map());
    // Store key pair ref for group key rotation
    const e2eKeyPairRef = useRef<{ publicKey: CryptoKey; privateKey: CryptoKey } | null>(null);
    const partnerPublicKeyRef = useRef<CryptoKey | null>(null);
    /** Previous shared key — kept when USER_KEY_CHANGED fires so in-flight messages can still decrypt. */
    const prevE2eKeyRef = useRef<CryptoKey | null>(null);
    /** My current key version (from the server) — stamped on outgoing messages. */
    const myKeyVersionRef = useRef<number>(1);
    const [showSafetyNumber, setShowSafetyNumber] = useState(false);
    const [safetyNumber, setSafetyNumber] = useState<string | null>(null);

    useEffect(() => {
        setInfoPanelOpen(false);
        setMemberPanelOpen(false);
        setShowSafetyNumber(false);
    }, [id]);
    // Map of attachmentId -> decrypted blob URL + metadata (for E2E-encrypted files)
    const [decryptedFileUrls, setDecryptedFileUrls] = useState<Map<string, { url: string; filename: string; mimeType: string }>>(new Map());
    const decryptInFlightRef = useRef(new Set<string>());
    const blobUrlsRef = useRef<string[]>([]);
    const [showDisappearMenu, setShowDisappearMenu] = useState(false);
    const disappearMenuRef = useRef<HTMLDivElement>(null);

    // Typing indicator state
    const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
    const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const lastTypingSentRef = useRef(0);

    // Mentions display map: maps display token (@username) to wire format (<@userId>)
    const dmMentionsMapRef = useRef<Map<string, string>>(new Map());

    const resolveDmWireContent = useCallback((text: string) => {
        let result = text;
        dmMentionsMapRef.current.forEach((wire, display) => {
            result = result.split(display).join(wire);
        });
        return result;
    }, []);

    const promptKeyRestore = useCallback(() => {
        setE2eRecoveryRequired(true);
        setE2eKey(null);
        setE2eError('restore your encryption key in Privacy settings to read and send encrypted messages on this device');
    }, []);

    const loadOrBootstrapMyKeyPair = useCallback(async () => {
        if (!currentUserId) return null;

        const localResult = await getOrCreateKeyPair(currentUserId, { createIfMissing: false });
        const remoteKeyState = await api.encryption.getPublicKey(currentUserId);

        if (localResult) {
            const localPublicKeyJwk = await exportPublicKey(localResult.keyPair.publicKey);
            if (!remoteKeyState.publicKeyJwk) {
                // No server key yet — upload local key
                const uploadResult = await api.encryption.uploadPublicKey(localPublicKeyJwk);
                if (uploadResult?.keyVersion) myKeyVersionRef.current = uploadResult.keyVersion;
                return localResult;
            }
            if (remoteKeyState.publicKeyJwk === localPublicKeyJwk) {
                // Keys match — all good
                if (remoteKeyState.keyVersion) myKeyVersionRef.current = remoteKeyState.keyVersion;
                return localResult;
            }
            // Local key differs from server — fall through to generate a fresh key pair.
        }

        // No local key (or stale key) — generate fresh key pair and upload.
        // Old encrypted messages will be unreadable but the user can communicate going forward.
        const created = await getOrCreateKeyPair(currentUserId);
        if (!created) return null;
        const publicKeyJwk = await exportPublicKey(created.keyPair.publicKey);
        const uploadResult = await api.encryption.uploadPublicKey(publicKeyJwk);
        if (uploadResult?.keyVersion) myKeyVersionRef.current = uploadResult.keyVersion;
        return created;
    }, [currentUserId]);

    useEffect(() => {
        const handleKeyRestored = () => {
            blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
            blobUrlsRef.current = [];
            decryptInFlightRef.current.clear();
            e2eKeyPairRef.current = null;
            prevE2eKeyRef.current = null;
            setE2eRecoveryRequired(false);
            setPartnerKeyChanged(false);
            setE2eError(null);
            setE2eKey(null);
            setDecryptedContents(new Map());
            setDecryptedFileUrls(new Map());
            setE2eBootstrapNonce((prev) => prev + 1);
        };

        window.addEventListener('gratonite:e2e-key-restored', handleKeyRestored);
        return () => window.removeEventListener('gratonite:e2e-key-restored', handleKeyRestored);
    }, []);

    // Listen for remote typing events
    useEffect(() => {
        if (!dmChannelId) return;
        const unsub = onTypingStart((payload: TypingStartPayload) => {
            if (payload.channelId !== dmChannelId) return;
            if (payload.userId === currentUserId) return;
            setTypingUsers(prev => {
                const next = new Map(prev);
                next.set(payload.userId, payload.username);
                return next;
            });
            const existing = typingTimersRef.current.get(payload.userId);
            if (existing) clearTimeout(existing);
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
    }, [dmChannelId, currentUserId]);

    // Send typing indicator (throttled to once per 5s)
    const sendTypingIndicator = useCallback(() => {
        if (!dmChannelId) return;
        const now = Date.now();
        if (now - lastTypingSentRef.current < 5000) return;
        lastTypingSentRef.current = now;
        api.messages.startTyping(dmChannelId).catch(() => { /* ignore */ });
    }, [dmChannelId]);

    // Reaction handler
    const handleReaction = (messageApiId: string | undefined, emoji: string, alreadyReacted: boolean) => {
        if (!dmChannelId || !messageApiId) return;
        if (alreadyReacted) {
            api.messages.removeReaction(dmChannelId, messageApiId, emoji).catch(() =>
                addToast({ title: 'Failed to remove reaction', variant: 'error' }));
        } else {
            api.messages.addReaction(dmChannelId, messageApiId, emoji).catch(() =>
                addToast({ title: 'Failed to add reaction', variant: 'error' }));
        }
        // Optimistic update
        setMessages(prev => prev.map(m => {
            if (m.apiId !== messageApiId) return m;
            const reactions = [...(m.reactions || [])];
            const idx = reactions.findIndex(r => r.emoji === emoji);
            if (alreadyReacted) {
                if (idx >= 0) {
                    reactions[idx] = { ...reactions[idx], count: reactions[idx].count - 1, me: false };
                    if (reactions[idx].count <= 0) reactions.splice(idx, 1);
                }
            } else {
                if (idx >= 0) {
                    reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, me: true };
                } else {
                    reactions.push({ emoji, count: 1, me: true });
                }
            }
            return { ...m, reactions };
        }));
        setReactionPickerMessageId(null);
    };

    // Close reaction picker on click-outside
    useEffect(() => {
        if (reactionPickerMessageId === null) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
                setReactionPickerMessageId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [reactionPickerMessageId]);

    // Fetch DM channel info and recipient
    const [userName, setUserName] = useState('');
    const [userColor, setUserColor] = useState('linear-gradient(135deg, var(--accent-blue), var(--accent-purple))');
    const [initial, setInitial] = useState('?');
    const [recipientId, setRecipientId] = useState<string>('');
    const [recipientAvatarHash, setRecipientAvatarHash] = useState<string | null>(null);
    const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});
    const userStatus = useMemo(() => {
        if (!recipientId || isGroupDm) return '';
        const raw = presenceMap[recipientId] || 'offline';
        const map: Record<string, string> = { online: 'Online', idle: 'Away', dnd: 'Do Not Disturb', invisible: 'Invisible', offline: 'Offline' };
        return map[raw] ?? 'Offline';
    }, [presenceMap, recipientId, isGroupDm]);
    const [profileData, setProfileData] = useState<{
        displayName: string;
        username: string;
        bannerHash: string | null;
        bio: string | null;
        pronouns: string | null;
        customStatus: string | null;
        statusEmoji: string | null;
        badges: string[];
        createdAt: string;
    } | null>(null);
    const [fameStats, setFameStats] = useState<{ fameReceived: number; fameGiven: number } | null>(null);
    const [mutualData, setMutualData] = useState<{
        mutualServers: Array<{ id: string; name: string; iconHash: string | null }>;
        mutualFriends: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>;
    } | null>(null);

    // Subscribe to presence updates for DM recipients
    useEffect(() => {
        const unsub = onPresenceUpdate((payload: PresenceUpdatePayload) => {
            setPresenceMap(prev => ({ ...prev, [payload.userId]: payload.status }));
        });
        return () => { unsub(); };
    }, []);

    useEffect(() => {
        if (!dmChannelId) return;
        api.channels.get(dmChannelId).then(async (ch: any) => {
            // Sync E2E state from server
            setE2eEnabled(!!ch.isEncrypted);
            // Check if this is a group DM
            if (ch.isGroup || ch.type === 'GROUP_DM') {
                setIsGroupDm(true);
                setGroupName(ch.groupName || 'Group DM');
                setGroupOwnerId(ch.ownerId || null);
                setGroupParticipants(ch.participants || []);
                const label = ch.groupName || 'Group DM';
                setUserName(label);
                setInitial(label.charAt(0).toUpperCase());
                setUserColor(getDeterministicGradient(label));
                return;
            }

            setIsGroupDm(false);
            // Try recipients array first (if backend ever populates it)
            let recipient = ch.recipients?.[0];

            // Fallback: parse UUIDs from channel name "dm-<uuid1>-<uuid2>"
            if (!recipient && ch.name?.startsWith('dm-')) {
                const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
                const uuids = ch.name.match(uuidRegex) || [];
                // Find the UUID that is not the current user
                const me = await api.users.getMe();
                const otherId = uuids.find((u: string) => u !== me.id);
                if (otherId) {
                    const otherUser = await api.users.get(otherId).catch(() => null);
                    if (otherUser) {
                        recipient = otherUser;
                    }
                }
            }

            if (recipient) {
                const name = recipient.displayName || recipient.username || 'Unknown';
                setUserName(name);
                setInitial(name.charAt(0).toUpperCase());
                setUserColor(getDeterministicGradient(name));
                setRecipientId(recipient.id || '');
                setRecipientAvatarHash(recipient.avatarHash || null);
            }
        }).catch(() => { addToast({ title: 'Failed to load conversation', variant: 'error' }); });
    }, [dmChannelId, addToast]);

    // Fetch profile, mutuals, fame for DM recipient
    useEffect(() => {
        if (!recipientId || isGroupDm) return;
        let cancelled = false;

        Promise.all([
            api.users.getProfile(recipientId).catch(() => null),
            api.users.getMutuals(recipientId).catch(() => null),
            api.fame.getStats(recipientId).catch(() => null),
        ]).then(([profile, mutuals, fame]: [any, any, any]) => {
            if (cancelled) return;
            if (profile) setProfileData(profile);
            if (mutuals) setMutualData(mutuals);
            if (fame) setFameStats(fame);
        });

        return () => { cancelled = true; };
    }, [recipientId, isGroupDm]);

    useEffect(() => {
        const handleFameGiven = (event: Event) => {
            const detail = (event as CustomEvent<{ userId?: string }>).detail;
            if (!detail?.userId || detail.userId !== recipientId) return;
            setFameStats(prev => prev ? { ...prev, fameReceived: prev.fameReceived + 1 } : { fameReceived: 1, fameGiven: 0 });
        };

        window.addEventListener('gratonite:fame-given', handleFameGiven);
        return () => window.removeEventListener('gratonite:fame-given', handleFameGiven);
    }, [recipientId]);

    // Fetch messages from API
    const userCacheRef = useRef<Map<string, { username: string; displayName: string }>>(new Map());
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const oldestMessageIdRef = useRef<string | null>(null);
    const messageListRef = useRef<HTMLDivElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [newDmMsgCount, setNewDmMsgCount] = useState(0);
    const [hasDraft, setHasDraft] = useState(false);
    const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const undoBufferRef = useRef<string[]>([]);
    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduledMessages, setScheduledMessages] = useState<Array<{ id: string; content: string; scheduledAt: string }>>([]);

    const convertApiMessage = (m: any): Message => {
        const authorInfo = userCacheRef.current.get(m.authorId);
        const authorName = authorInfo?.displayName || authorInfo?.username || m.authorId.slice(0, 8);
        return {
            id: typeof m.id === 'string' ? parseInt(m.id, 36) || Date.now() : m.id,
            apiId: m.id,
            authorId: m.authorId,
            author: authorName,
            system: false,
            avatar: authorName.charAt(0).toUpperCase(),
            authorAvatarHash: m.author?.avatarHash ?? null,
            authorNameplateStyle: (m.author as any)?.nameplateStyle ?? null,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: m.content || '',
            edited: m.edited ?? false,
            reactions: m.reactions || [],
            expiresAt: m.expiresAt ?? null,
            createdAt: m.createdAt ?? null,
            isEncrypted: m.isEncrypted ?? false,
            encryptedContent: m.encryptedContent ?? null,
            threadReplyCount: m.threadReplyCount ?? 0,
            attachments: m.attachments ?? undefined,
            embeds: Array.isArray(m.embeds) && m.embeds.length > 0 ? m.embeds : undefined,
        };
    };

    const resolveAuthors = async (authorIds: string[]) => {
        const unknownIds = authorIds.filter(aid => !userCacheRef.current.has(aid));
        if (unknownIds.length === 0) return;
        try {
            const summaries = await api.users.getSummaries(unknownIds);
            for (const s of summaries) {
                userCacheRef.current.set(s.id, { username: s.username, displayName: s.displayName });
            }
        } catch { /* ignore */ }
    };

    const fetchDmMessages = useCallback(async () => {
        if (!dmChannelId) return;
        setMessages([]); // Clear previous messages immediately to prevent showing stale content
        setIsLoadingMessages(true);
        setMessagesError(false);
        setMessagesErrorDetail(null);
        setHasMoreMessages(true);
        oldestMessageIdRef.current = null;
        try {
            const apiMessages = await api.messages.list(dmChannelId, { limit: 50 });
            const authorIds = [...new Set(apiMessages.map((m: any) => m.authorId))];
            await resolveAuthors(authorIds);
            // API returns newest-first; reverse so oldest is at index 0 (top of chat)
            const converted = apiMessages.map(convertApiMessage).reverse();
            setMessages(converted);
            setShowScrollButton(false);
            setNewDmMsgCount(0);
            if (apiMessages.length > 0) {
                // Last element in API response (newest-first) is the oldest
                oldestMessageIdRef.current = apiMessages[apiMessages.length - 1].id;
                // Mark as read with latest message ID after loading
                const latestMessageId = apiMessages[0].id;
                api.messages.markRead(dmChannelId, latestMessageId).catch(() => {});
            } else {
                api.messages.markRead(dmChannelId).catch(() => {});
            }
            if (apiMessages.length < 50) {
                setHasMoreMessages(false);
            }
        } catch (err) {
            setMessagesError(true);
            if (err instanceof ApiRequestError) {
                setMessagesErrorDetail(err.message);
            } else if (err instanceof RateLimitError) {
                setMessagesErrorDetail(err.message);
            } else if (err instanceof Error && err.message) {
                setMessagesErrorDetail(err.message);
            } else {
                setMessagesErrorDetail(null);
            }
        } finally {
            setIsLoadingMessages(false);
        }
    }, [dmChannelId]);

    useEffect(() => { fetchDmMessages(); }, [fetchDmMessages]);

    // Load draft when DM channel changes
    useEffect(() => {
        if (!dmChannelId) return;
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
        // Fast-path: load from localStorage immediately
        try {
            const localDraft = localStorage.getItem(`gratonite:draft:${dmChannelId}`);
            if (localDraft) { setInputValue(localDraft); setHasDraft(true); }
            else { setInputValue(''); setHasDraft(false); }
        } catch { setInputValue(''); setHasDraft(false); }
        // Server draft overrides localStorage
        fetch(`${API_BASE}/channels/${dmChannelId}/draft`, {
            headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
        }).then(r => r.ok ? r.json() : null).then(draft => {
            if (draft?.content) { setInputValue(draft.content); setHasDraft(true); }
        }).catch(() => {});
        // Load scheduled messages
        fetch(`${API_BASE}/channels/${dmChannelId}/messages/scheduled`, {
            headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
        }).then(r => r.ok ? r.json() : []).then(data => {
            setScheduledMessages(Array.isArray(data) ? data : []);
        }).catch(() => {});
    }, [dmChannelId]);

    // Handle ?messageId= search param for notification click-through
    useEffect(() => {
        const messageId = searchParams.get('messageId');
        if (messageId && dmChannelId) {
            (async () => {
                try {
                    const result = await api.messages.jumpToMessage(dmChannelId, messageId);
                    const authorIds = [...new Set(result.messages.map((m: any) => m.authorId))];
                    await resolveAuthors(authorIds);
                    const converted = result.messages.map(convertApiMessage);
                    setMessages(converted);
                    if (result.messages.length > 0) {
                        oldestMessageIdRef.current = result.messages[0].id;
                    }
                    // Scroll to the target message after render
                    requestAnimationFrame(() => {
                        const el = document.querySelector(`[data-message-id="${result.targetMessageId}"]`);
                        if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Brief highlight effect
                            el.classList.add('mentioned-message');
                            setTimeout(() => el.classList.remove('mentioned-message'), 3000);
                        }
                    });
                } catch {
                    // Message may be deleted — fall through to normal channel view
                }
            })();
            // Clear the param so refresh doesn't re-jump
            setSearchParams({}, { replace: true });
        }
    }, [dmChannelId, searchParams, setSearchParams]);

    // Load call history for this DM
    useEffect(() => {
        if (!dmChannelId) { setCallHistory([]); return; }
        api.channels.getCallHistory(dmChannelId).then((history: any[]) => {
            if (Array.isArray(history)) {
                setCallHistory(history.map((h: any) => ({
                    id: h.id,
                    startedAt: h.startedAt || h.createdAt,
                    endedAt: h.endedAt,
                    duration: h.duration,
                    participants: h.participants || [],
                    missed: h.missed || false,
                })));
            }
        }).catch(() => {});
    }, [dmChannelId]);

    // Load older messages when scrolling to top
    const loadOlderMessages = useCallback(async () => {
        if (!dmChannelId || !hasMoreMessages || isLoadingOlder || !oldestMessageIdRef.current) return;
        setIsLoadingOlder(true);
        try {
            const olderMessages = await api.messages.list(dmChannelId, { limit: 50, before: oldestMessageIdRef.current });
            if (olderMessages.length === 0) {
                setHasMoreMessages(false);
                return;
            }
            const authorIds = [...new Set(olderMessages.map((m: any) => m.authorId))];
            await resolveAuthors(authorIds);
            // API returns newest-first; reverse so oldest is first, then prepend
            const converted = olderMessages.map(convertApiMessage).reverse();
            // Last element in API response (newest-first) is the oldest
            oldestMessageIdRef.current = olderMessages[olderMessages.length - 1].id;
            setMessages(prev => [...converted, ...prev]);
            if (olderMessages.length < 50) {
                setHasMoreMessages(false);
            }
        } catch {
            addToast({ title: 'Failed to load older messages', variant: 'error' });
        } finally {
            setIsLoadingOlder(false);
        }
    }, [dmChannelId, hasMoreMessages, isLoadingOlder, addToast]);

    // Scroll-based pagination trigger + save scroll position
    const dmScrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        const el = messageListRef.current;
        if (!el) return;
        const handleScroll = () => {
            if (el.scrollTop < 200 && hasMoreMessages && !isLoadingOlder) {
                loadOlderMessages();
            }
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            const nearBottom = distFromBottom < 200;
            setShowScrollButton(!nearBottom);
            if (nearBottom) setNewDmMsgCount(0);
            if (dmChannelId) {
                if (dmScrollSaveTimer.current) clearTimeout(dmScrollSaveTimer.current);
                dmScrollSaveTimer.current = setTimeout(() => saveScrollPosition(dmChannelId, el.scrollTop), 150);
            }
        };
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            el.removeEventListener('scroll', handleScroll);
            if (dmScrollSaveTimer.current) clearTimeout(dmScrollSaveTimer.current);
        };
    }, [hasMoreMessages, isLoadingOlder, loadOlderMessages, dmChannelId]);

    // Join/leave DM channel room for real-time events
    useEffect(() => {
        if (!dmChannelId) return;
        socketJoinChannel(dmChannelId);
        return () => { socketLeaveChannel(dmChannelId); };
    }, [dmChannelId]);

    // Socket listeners for real-time DM messages
    useEffect(() => {
        if (!dmChannelId) return;

        const unsubs: (() => void)[] = [];

        unsubs.push(onMessageCreate((data: MessageCreatePayload) => {
            if (data.channelId !== dmChannelId) return;
            // Keep system messages (e.g. call/fame events) even when authored by us.
            if (data.authorId === currentUserId && !data.isSystem) return;
            const authorName = data.isSystem
                ? 'System'
                : (data.author?.displayName || data.author?.username || data.authorId.slice(0, 8));
            const msgId = typeof data.id === 'string' ? parseInt(data.id, 36) || Date.now() : Number(data.id);
            const isEncryptedMsg = (data as any).isEncrypted ?? false;
            const encryptedContent = (data as any).encryptedContent ?? null;
            setMessages(prev => [...prev, {
                id: msgId,
                apiId: data.id,
                authorId: data.authorId,
                author: authorName,
                system: data.isSystem ?? false,
                avatar: authorName.charAt(0).toUpperCase(),
                authorAvatarHash: (data as any).author?.avatarHash ?? null,
                authorNameplateStyle: (data as any).author?.nameplateStyle ?? null,
                time: new Date(data.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: data.content || '',
                edited: data.edited,
                expiresAt: data.expiresAt ?? null,
                createdAt: data.createdAt ?? null,
                isEncrypted: isEncryptedMsg,
                encryptedContent: encryptedContent,
                attachments: (data as any).attachments ?? undefined,
                embeds: Array.isArray((data as any).embeds) && (data as any).embeds.length > 0 ? (data as any).embeds : undefined,
            }]);
            // Increment new-message counter if user is scrolled up
            const el = messageListRef.current;
            if (el) {
                const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
                if (distFromBottom > 200) setNewDmMsgCount(n => n + 1);
                else el.scrollTop = el.scrollHeight;
            }
            // Auto-mark read when message arrives and window is focused/visible
            if (!document.hidden && document.hasFocus()) {
                api.messages.markRead(dmChannelId, data.id).catch(() => {});
            }
        }));

        unsubs.push(onMessageUpdate((data: MessageUpdatePayload) => {
            if (data.channelId !== dmChannelId) return;
            const isEncryptedUpdate = (data as any).isEncrypted ?? false;
            const encryptedContent = (data as any).encryptedContent ?? null;
            setMessages(prev => {
                let editedMsgNumericId: number | null = null;
                const updated = prev.map(m => {
                    if (m.apiId !== data.id) return m;
                    editedMsgNumericId = m.id;
                    return {
                        ...m,
                        content: isEncryptedUpdate ? '' : (data.content || m.content),
                        edited: true,
                        isEncrypted: isEncryptedUpdate,
                        encryptedContent: isEncryptedUpdate ? encryptedContent : null,
                    };
                });
                // Invalidate decrypted cache so the decrypt effect re-runs for this message
                if (isEncryptedUpdate && editedMsgNumericId !== null) {
                    const numId = editedMsgNumericId;
                    setDecryptedContents(prev => {
                        if (!prev.has(numId)) return prev;
                        const next = new Map(prev);
                        next.delete(numId);
                        return next;
                    });
                }
                return updated;
            });
        }));

        unsubs.push(onMessageDelete((data: MessageDeletePayload) => {
            if (data.channelId !== dmChannelId) return;
            setMessages(prev => prev.filter(m => m.apiId !== data.id));
        }));

        unsubs.push(onReactionAdd((payload: any) => {
            if (payload.channelId !== dmChannelId) return;
            // Skip own reactions — already handled by optimistic update in handleReaction
            if (payload.userId === currentUserId) return;
            setMessages(prev => prev.map(m => {
                if (m.apiId !== payload.messageId) return m;
                const reactions = [...(m.reactions || [])];
                const idx = reactions.findIndex(r => r.emoji === payload.emoji);
                if (idx >= 0) {
                    reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1 };
                } else {
                    reactions.push({ emoji: payload.emoji, count: 1, me: false });
                }
                return { ...m, reactions };
            }));
        }));

        unsubs.push(onReactionRemove((payload: any) => {
            if (payload.channelId !== dmChannelId) return;
            // Skip own reactions — already handled by optimistic update in handleReaction
            if (payload.userId === currentUserId) return;
            setMessages(prev => prev.map(m => {
                if (m.apiId !== payload.messageId) return m;
                const reactions = [...(m.reactions || [])];
                const idx = reactions.findIndex(r => r.emoji === payload.emoji);
                if (idx >= 0) {
                    reactions[idx] = { ...reactions[idx], count: reactions[idx].count - 1 };
                    if (reactions[idx].count <= 0) reactions.splice(idx, 1);
                }
                return { ...m, reactions };
            }));
        }));

        // MESSAGE_READ — update partner's read state for ✓✓ indicator (A1)
        unsubs.push(onMessageRead((payload: MessageReadPayload) => {
            if (payload.channelId !== dmChannelId) return;
            if (payload.userId === currentUserId) return;
            setPartnerLastReadAt(payload.lastReadAt);
            setPartnerLastReadMessageId(payload.lastReadMessageId);
        }));

        // THREAD_CREATE — mark origin message as having a thread
        unsubs.push(onThreadCreate((data: any) => {
            if (data.channelId !== dmChannelId) return;
            setMessages(prev => prev.map(msg => {
                if (msg.apiId !== data.originMessageId) return msg;
                if ((msg.threadReplyCount ?? 0) === 0) {
                    return { ...msg, threadReplyCount: 1 };
                }
                return msg;
            }));
        }));

        // MESSAGE_EMBED_UPDATE — URL unfurling results
        const socket = getSocket();
        if (socket) {
            const embedHandler = ({ messageId, embeds }: { messageId: string; embeds: any[] }) => {
                setMessages(prev => prev.map(m =>
                    m.apiId === messageId ? { ...m, embeds } : m
                ));
            };
            socket.on('MESSAGE_EMBED_UPDATE', embedHandler);
            unsubs.push(() => socket.off('MESSAGE_EMBED_UPDATE', embedHandler));
        }

        return () => { unsubs.forEach(fn => fn()); };
    }, [dmChannelId, currentUserId]);

    // Mark channel as read when focused/opened (A1)
    const markAsRead = useCallback(() => {
        if (!dmChannelId) return;
        api.messages.markRead(dmChannelId).catch(() => { /* non-fatal */ });
    }, [dmChannelId]);

    // Defer initial markAsRead to after messages load (see fetchDmMessages)
    // to avoid clobbering the read state before we can capture the divider position.

    useEffect(() => {
        const handleFocus = () => markAsRead();
        const handleVisibility = () => { if (!document.hidden) markAsRead(); };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [markAsRead]);

    // Fetch initial read state + disappear timer when channel opens (A1, A2)
    useEffect(() => {
        if (!dmChannelId) return;
        // Fetch read state for partner read receipt + current user's NEW divider
        api.messages.getReadState(dmChannelId).then((states: any[]) => {
            const partner = states.find((s: any) => s.userId !== currentUserId);
            if (partner) {
                setPartnerLastReadAt(partner.lastReadAt);
                setPartnerLastReadMessageId(partner.lastReadMessageId);
            }
            const myState = states.find((s: any) => s.userId === currentUserId);
            setMyLastReadMessageId(myState?.lastReadMessageId ?? null);
        }).catch(() => { /* non-fatal */ });
        // Fetch channel to get disappear timer
        api.channels.get(dmChannelId).then((ch: any) => {
            setDisappearTimer(ch.disappearTimer ?? null);
        }).catch(() => { /* non-fatal */ });
    }, [dmChannelId, currentUserId]);

    // Close disappear menu on outside click (A2)
    useEffect(() => {
        if (!showDisappearMenu) return;
        const handleClick = (e: MouseEvent) => {
            if (disappearMenuRef.current && !disappearMenuRef.current.contains(e.target as Node)) {
                setShowDisappearMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showDisappearMenu]);

    // E2E setup — derives shared key when a non-group DM partner is known
    useEffect(() => {
        if (!isE2ESupported() || !currentUserId || !recipientId || isGroupDm) return;
        setE2eSupported(true);
        setE2eError(null);

        let cancelled = false;
        (async () => {
            try {
                const result = await loadOrBootstrapMyKeyPair();
                if (cancelled) return;
                if (!result) { setE2eError('Failed to initialize encryption keys'); return; }
                if ('missingLocalKey' in result) {
                    promptKeyRestore();
                    return;
                }
                const { keyPair: myKeyPair } = result;
                e2eKeyPairRef.current = myKeyPair;
                setE2eRecoveryRequired(false);
                setE2eError(null);

                const data = await api.encryption.getPublicKey(recipientId);
                if (cancelled) return;
                if (!data.publicKeyJwk) { setE2eError('Partner has not set up encryption yet'); return; }
                const theirKey = await importPublicKey(data.publicKeyJwk);
                partnerPublicKeyRef.current = theirKey;
                const sharedKey = await deriveSharedKey(myKeyPair.privateKey, theirKey);
                if (!cancelled) setE2eKey(sharedKey);
            } catch {
                if (!cancelled) setE2eError('Key exchange failed — messages are not encrypted');
            }
        })();

        return () => { cancelled = true; };
    }, [currentUserId, recipientId, isGroupDm, loadOrBootstrapMyKeyPair, promptKeyRestore, e2eBootstrapNonce]);

    // E2E is no longer auto-enabled — users must explicitly enable it via settings.

    // E2E setup — fetches or creates group key for GROUP_DM channels
    useEffect(() => {
        if (!isE2ESupported() || !currentUserId || !dmChannelId || !isGroupDm || groupParticipants.length === 0) return;
        setE2eSupported(true);
        setE2eError(null);

        let cancelled = false;
        (async () => {
            try {
                const result = await loadOrBootstrapMyKeyPair();
                if (cancelled) return;
                if (!result) { setE2eError('Failed to initialize encryption keys'); return; }
                if ('missingLocalKey' in result) {
                    promptKeyRestore();
                    return;
                }
                const { keyPair: myKeyPair } = result;
                e2eKeyPairRef.current = myKeyPair;
                setE2eRecoveryRequired(false);
                setE2eError(null);

                // Attempt to fetch the existing group key for this user.
                const keyData = await api.encryption.getGroupKey(dmChannelId);
                if (cancelled) return;

                if (keyData.version !== null && keyData.encryptedKey) {
                    const groupKey = await decryptGroupKey(keyData.encryptedKey, myKeyPair.privateKey);
                    if (!cancelled && groupKey) {
                        setE2eKey(groupKey);
                        setGroupKeyVersion(keyData.version);
                        const publicKeyChecks = await Promise.all(
                            groupParticipants.map(async (p) => {
                                const d = await api.encryption.getPublicKey(p.id);
                                return d.publicKeyJwk !== null;
                            }),
                        );
                        if (!cancelled) setGroupE2eAllMembersHaveKeys(publicKeyChecks.every(Boolean));
                    }
                    return;
                }

                // No group key yet — only the group owner/first member creates it.
                const isOwner = groupParticipants[0]?.id === currentUserId || groupParticipants.length === 0;
                if (!isOwner || cancelled) return;

                const memberKeys = await Promise.all(
                    groupParticipants.map(async (p) => {
                        const d = await api.encryption.getPublicKey(p.id);
                        if (!d.publicKeyJwk) return { id: p.id, key: null };
                        const key = await importPublicKey(d.publicKeyJwk).catch(() => null);
                        return { id: p.id, key };
                    }),
                );
                if (cancelled) return;

                const allHaveKeys = memberKeys.every((m) => m.key !== null);
                if (!allHaveKeys) {
                    setGroupE2eAllMembersHaveKeys(false);
                    return;
                }

                const groupKey = await generateGroupKey();
                const encryptedKeys: Record<string, string> = {};
                for (const { id, key } of memberKeys) {
                    if (key) {
                        encryptedKeys[id] = await encryptGroupKey(groupKey, key);
                    }
                }
                if (!encryptedKeys[currentUserId]) {
                    encryptedKeys[currentUserId] = await encryptGroupKey(groupKey, myKeyPair.publicKey);
                }

                await api.encryption.postGroupKey(dmChannelId, { version: 1, keyData: encryptedKeys });
                if (cancelled) return;

                setE2eKey(groupKey);
                setGroupKeyVersion(1);
                setGroupE2eAllMembersHaveKeys(true);
            } catch {
                if (!cancelled) setE2eError('Group key exchange failed — messages are not encrypted');
            }
        })();

        return () => { cancelled = true; };
    }, [currentUserId, dmChannelId, isGroupDm, groupParticipants, loadOrBootstrapMyKeyPair, promptKeyRestore, e2eBootstrapNonce]);

    // Decrypt encrypted messages whenever the e2eKey or messages list changes
    useEffect(() => {
        if (!e2eKey) return;
        const controller = new AbortController();
        const encryptedMsgs = messages.filter(
            (m) => m.isEncrypted && m.encryptedContent && !decryptedContents.has(m.id),
        );
        if (encryptedMsgs.length === 0) return;

        // Capture key references at the start of this batch to avoid the race
        // where setE2eKey() fires while Promises are in-flight.
        const currentKey = e2eKey;
        const prevKey = prevE2eKeyRef.current;

        // Lazily fetch the partner's previous public key (only on first decrypt
        // failure in the batch; result is reused for all subsequent failures).
        let prevServerKeyPromise: Promise<CryptoKey | null> | null = null;
        const getPrevServerKey = (): Promise<CryptoKey | null> => {
            if (prevServerKeyPromise) return prevServerKeyPromise;
            if (isGroupDm || !recipientId) {
                prevServerKeyPromise = Promise.resolve(null);
                return prevServerKeyPromise;
            }
            prevServerKeyPromise = (async () => {
                try {
                    const data = await api.encryption.getPublicKey(recipientId, 'prev');
                    if (!data.publicKeyJwk) return null;
                    const theirPrevKey = await importPublicKey(data.publicKeyJwk);
                    const myKeyPair = e2eKeyPairRef.current;
                    if (!myKeyPair) return null;
                    return await deriveSharedKey(myKeyPair.privateKey, theirPrevKey);
                } catch { return null; }
            })();
            return prevServerKeyPromise;
        };

        Promise.all(
            encryptedMsgs.map(async (m) => {
                try {
                    const plain = await decrypt(currentKey, m.encryptedContent!);
                    // Check for structured E2E payload (v2 — includes file metadata)
                    try {
                        const parsed = JSON.parse(plain);
                        if (parsed && parsed._e2e === 2) {
                            // Decrypt file attachments in background
                            if (Array.isArray(parsed.files) && parsed.files.length > 0 && m.attachments) {
                                for (const fileMeta of parsed.files) {
                                    const att = m.attachments.find((a: MessageAttachment) => a.id === fileMeta.id);
                                    if (att && !decryptInFlightRef.current.has(fileMeta.id)) {
                                        decryptInFlightRef.current.add(fileMeta.id);
                                        fetch(att.url, { signal: controller.signal }).then(r => r.blob()).then(async (blob) => {
                                            const decrypted = await decryptFile(currentKey, blob, fileMeta.iv, fileMeta.ef);
                                            const blobUrl = URL.createObjectURL(decrypted);
                                            blobUrlsRef.current.push(blobUrl);
                                            setDecryptedFileUrls(prev => {
                                                const next = new Map(prev);
                                                next.set(fileMeta.id, { url: blobUrl, filename: decrypted.name, mimeType: fileMeta.mt });
                                                return next;
                                            });
                                        }).catch((err: any) => { if (err.name === 'AbortError') return; decryptInFlightRef.current.delete(fileMeta.id); });
                                    }
                                }
                            }
                            return [m.id, parsed.text || ''] as const;
                        }
                    } catch { /* not JSON — plain text, fall through */ }
                    return [m.id, plain] as const;
                } catch {
                    // Primary key failed — try the in-memory previous key first (fastest).
                    if (prevKey) {
                        try {
                            const plain = await decrypt(prevKey, m.encryptedContent!);
                            return [m.id, plain] as const;
                        } catch { /* fall through to server prev key */ }
                    }
                    // Try the partner's previous server-side key (one generation back).
                    const prevServerKey = await getPrevServerKey();
                    if (prevServerKey) {
                        try {
                            const plain = await decrypt(prevServerKey, m.encryptedContent!);
                            return [m.id, plain] as const;
                        } catch { /* fall through — truly unrecoverable */ }
                    }
                    return [m.id, '[Decryption failed]'] as const;
                }
            }),
        ).then((results) => {
            setDecryptedContents((prev) => {
                const next = new Map(prev);
                for (const [id, text] of results) next.set(id, text);
                return next;
            });
        });
        return () => controller.abort();
    }, [e2eKey, messages]);

    // Group key rotation listener — when a member is added/removed, re-generate the group key
    useEffect(() => {
        if (!isGroupDm || !dmChannelId || !currentUserId) return;
        const unsub = onGroupKeyRotationNeeded(async (payload: GroupKeyRotationNeededPayload) => {
            if (payload.channelId !== dmChannelId) return;
            const myKeyPair = e2eKeyPairRef.current;
            if (!myKeyPair) return;

            // Only the group owner generates a new key
            if (groupParticipants[0]?.id !== currentUserId) {
                // Non-owner: wait for the owner to generate & upload the new key, then fetch it
                await new Promise(r => setTimeout(r, 3000));
                try {
                    const keyData = await api.encryption.getGroupKey(dmChannelId);
                    if (keyData.version !== null && keyData.encryptedKey) {
                        const groupKey = await decryptGroupKey(keyData.encryptedKey, myKeyPair.privateKey);
                        if (groupKey) {
                            setE2eKey(groupKey);
                            setGroupKeyVersion(keyData.version);
                        }
                    }
                } catch { /* will retry on next event */ }
                return;
            }

            // Owner: generate new group key and distribute
            try {
                const memberKeys = await Promise.all(
                    groupParticipants.map(async (p) => {
                        const d = await api.encryption.getPublicKey(p.id);
                        if (!d.publicKeyJwk) return { id: p.id, key: null };
                        const key = await importPublicKey(d.publicKeyJwk).catch(() => null);
                        return { id: p.id, key };
                    }),
                );

                const allHaveKeys = memberKeys.every((m) => m.key !== null);
                if (!allHaveKeys) { setGroupE2eAllMembersHaveKeys(false); return; }

                const newGroupKey = await generateGroupKey();
                const encryptedKeys: Record<string, string> = {};
                for (const { id, key } of memberKeys) {
                    if (key) encryptedKeys[id] = await encryptGroupKey(newGroupKey, key);
                }
                if (!encryptedKeys[currentUserId]) {
                    encryptedKeys[currentUserId] = await encryptGroupKey(newGroupKey, myKeyPair.publicKey);
                }

                const newVersion = (groupKeyVersion ?? 0) + 1;
                await api.encryption.postGroupKey(dmChannelId, { version: newVersion, keyData: encryptedKeys });
                setE2eKey(newGroupKey);
                setGroupKeyVersion(newVersion);
                setGroupE2eAllMembersHaveKeys(true);
            } catch {
                setE2eError('Group key rotation failed');
            }
        });
        return unsub;
    }, [isGroupDm, dmChannelId, currentUserId, groupParticipants, groupKeyVersion]);

    // User key change warning — when a DM partner rotates their key
    useEffect(() => {
        if (isGroupDm || !recipientId) return;
        const unsub = onUserKeyChanged((payload: UserKeyChangedPayload) => {
            if (payload.userId === recipientId) {
                setPartnerKeyChanged(true);
                // Re-derive the shared key with the new public key
                (async () => {
                    try {
                        const myKeyPair = e2eKeyPairRef.current;
                        if (!myKeyPair) return;
                        const d = await api.encryption.getPublicKey(recipientId);
                        if (!d.publicKeyJwk) return;
                        const theirKey = await importPublicKey(d.publicKeyJwk);
                        partnerPublicKeyRef.current = theirKey;
                        const sharedKey = await deriveSharedKey(myKeyPair.privateKey, theirKey);
                        // Preserve the old key so messages already in-flight can still decrypt.
                        setE2eKey(prev => {
                            prevE2eKeyRef.current = prev;
                            return sharedKey;
                        });
                    } catch { /* keep showing warning */ }
                })();
            }
        });
        return unsub;
    }, [isGroupDm, recipientId]);

    // Listen for E2E state changes (e.g. when the other person's key becomes available)
    useEffect(() => {
        if (!dmChannelId) return;
        const unsub = onE2EStateChanged((payload: E2EStateChangedPayload) => {
            if (payload.channelId !== dmChannelId) return;
            setE2eEnabled(payload.enabled);
        });
        return unsub;
    }, [dmChannelId]);

    const handleSetDisappearTimer = async (seconds: number | null) => {
        if (!dmChannelId) return;
        try {
            await api.messages.setDisappearTimer(dmChannelId, seconds);
            setDisappearTimer(seconds);
        } catch {
            addToast({ title: 'Failed to set timer', variant: 'error' });
        }
        setShowDisappearMenu(false);
    };

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const dmNeedsInitialScroll = useRef(true);
    useEffect(() => {
        dmNeedsInitialScroll.current = true;
    }, [dmChannelId]);

    useEffect(() => {
        if (messages.length === 0) return;
        if (dmNeedsInitialScroll.current) {
            dmNeedsInitialScroll.current = false;
            const savedPos = dmChannelId ? getScrollPosition(dmChannelId) : null;
            if (savedPos !== null && savedPos > 0 && messageListRef.current) {
                messageListRef.current.scrollTop = savedPos;
                return;
            }
        }
        scrollToBottom();
    }, [messages]);

    // Close volume panel on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (volumePanelRef.current && !volumePanelRef.current.contains(e.target as Node)) {
                setShowVolumePanel(false);
            }
            if (deviceMenuRef.current && !deviceMenuRef.current.contains(e.target as Node)) {
                setOpenDeviceMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        if (!isConnected) {
            setOpenDeviceMenu(null);
            return;
        }
        void refreshDevices();
    }, [isConnected, refreshDevices]);

    // Handle connection errors
    useEffect(() => {
        if (connectionError) {
            showCallErrorToast(connectionError);
        }
    }, [connectionError, showCallErrorToast]);

    useEffect(() => {
        if (!isConnected || !dmChannelId) return;
        voiceCtx.joinCall({
            type: 'dm',
            channelId: dmChannelId,
            channelName: userName || groupName || 'Direct Message Call',
        });
    }, [isConnected, dmChannelId, userName, groupName, voiceCtx]);

    useEffect(() => {
        if (!isConnected && !isConnecting && voiceCtx.activeCallType === 'dm' && voiceCtx.channelId === dmChannelId) {
            voiceCtx.clearCallState();
        }
    }, [isConnected, isConnecting, dmChannelId, voiceCtx]);

    useEffect(() => {
        if (!isConnected) return;
        voiceCtx.setParticipantCount((localParticipant ? 1 : 0) + participants.length);
    }, [isConnected, localParticipant, participants.length, voiceCtx]);

    useEffect(() => {
        voiceCtx.registerMuteHandler(toggleMute);
    }, [toggleMute, voiceCtx]);

    useEffect(() => {
        voiceCtx.registerDeafenHandler(toggleDeafen);
    }, [toggleDeafen, voiceCtx]);

    useEffect(() => {
        voiceCtx.registerDisconnectHandler(disconnect);
    }, [disconnect, voiceCtx]);

    useEffect(() => {
        voiceCtx.registerStartScreenShareHandler(startScreenShare);
    }, [startScreenShare, voiceCtx]);

    useEffect(() => {
        voiceCtx.registerStopScreenShareHandler(stopScreenShare);
    }, [stopScreenShare, voiceCtx]);

    useEffect(() => {
        voiceCtx.syncMuted(isMuted);
    }, [isMuted, voiceCtx]);

    useEffect(() => {
        voiceCtx.syncDeafened(isDeafened);
    }, [isDeafened, voiceCtx]);

    useEffect(() => {
        voiceCtx.syncScreenSharing(isScreenSharing);
    }, [isScreenSharing, voiceCtx]);

    useEffect(() => {
        if (!localParticipant) return;
        const q = localParticipant.connectionQuality;
        const mapped: 'good' | 'fair' | 'poor' =
            (q === 'excellent' || q === 'good') ? 'good' : q === 'poor' ? 'fair' : 'poor';
        voiceCtx.syncConnectionQuality(mapped);
    }, [localParticipant?.connectionQuality, voiceCtx]);

    const handleToggleCamera = useCallback(async () => {
        try {
            await toggleCamera();
            addToast({ title: isCameraOn ? 'Camera Disabled' : 'Camera Enabled', variant: 'info' });
        } catch (err) {
            const description = err instanceof Error ? err.message : 'Could not toggle camera.';
            addToast({ title: 'Camera Error', description, variant: 'error' });
        }
    }, [toggleCamera, isCameraOn, addToast]);

    const handleToggleScreenShare = useCallback(async () => {
        try {
            if (isScreenSharing) {
                await stopScreenShare();
                addToast({ title: 'Screen Share Stopped', variant: 'info' });
                return;
            }

            if (window.gratoniteDesktop?.isDesktop && setActiveModal) {
                setActiveModal('screenShare');
                return;
            }

            await startScreenShare();
            addToast({ title: 'Screen Sharing Started', variant: 'info' });
        } catch (err) {
            const description = err instanceof Error ? err.message : 'Could not toggle screen share.';
            const lowerDescription = description.toLowerCase();
            const wasCancelled =
                lowerDescription.includes('cancel') ||
                lowerDescription.includes('aborted') ||
                lowerDescription.includes('aborterror') ||
                lowerDescription.includes('notallowederror') ||
                lowerDescription.includes('permission denied');

            if (wasCancelled && !isScreenSharing) {
                addToast({ title: 'Screen Share Cancelled', description: 'You did not choose a screen to share.', variant: 'info' });
                return;
            }

            addToast({ title: 'Screen Share Error', description, variant: 'error' });
        }
    }, [isScreenSharing, startScreenShare, stopScreenShare, addToast, setActiveModal]);

    // Start call — send invite, wait for answer
    const handleStartCall = async (withVideo: boolean = false) => {
        if (isResolvingDmChannel || !dmChannelId) {
            addToast({ title: 'Call unavailable', description: 'Still resolving this DM channel. Please retry in a moment.', variant: 'error' });
            return;
        }
        setStartWithVideo(withVideo);
        setIsRinging(true);
        try {
            await api.voice.callInvite(dmChannelId, withVideo);
            addToast({ title: 'Calling...', description: `Ringing ${userName}...`, variant: 'info' });
        } catch (err) {
            setIsRinging(false);
            showCallErrorToast(err);
        }
    };

    // Cancel outgoing call
    const handleCancelCall = async () => {
        if (!dmChannelId) return;
        setIsRinging(false);
        try {
            await api.voice.callCancel(dmChannelId);
        } catch {
            // best-effort
        }
        addToast({ title: 'Call Cancelled', variant: 'info' });
    };

    // Auto-cancel ringing after 60s (matches Redis TTL)
    useEffect(() => {
        if (!isRinging) return;
        const timeout = setTimeout(() => {
            setIsRinging(false);
            addToast({ title: 'No Answer', description: `${userName} didn't pick up.`, variant: 'info' });
        }, 60_000);
        return () => clearTimeout(timeout);
    }, [isRinging, userName, addToast]);

    // Listen for call answer/reject
    useEffect(() => {
        const unsubAnswer = onCallAnswer(async (payload) => {
            if (payload.channelId !== dmChannelId) return;
            setIsRinging(false);
            try {
                await connect();
                clearCallErrorToastDedup();
                addToast({ title: 'Call Connected', description: `${userName} answered the call.`, variant: 'success' });
            } catch (err) {
                showCallErrorToast(err);
            }
        });
        const unsubReject = onCallReject((payload) => {
            if (payload.channelId !== dmChannelId) return;
            setIsRinging(false);
            addToast({ title: 'Call Declined', description: `${userName} declined the call.`, variant: 'info' });
        });
        return () => { unsubAnswer(); unsubReject(); };
    }, [dmChannelId, userName, connect, addToast, clearCallErrorToastDedup, showCallErrorToast]);

    // Auto-start outgoing call when navigated with ?call=voice or ?call=video
    const autoCallHandled = useRef(false);
    useEffect(() => {
        let autoCallTimer: ReturnType<typeof setTimeout> | null = null;
        const callType = searchParams.get('call');
        if (callType && !autoCallHandled.current && !isConnected && !isConnecting && dmChannelId) {
            autoCallHandled.current = true;
            // Clean up the query param so it doesn't re-trigger
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('call');
            setSearchParams(newParams, { replace: true });
            // Start the call after a brief delay to let the component mount fully
            autoCallTimer = setTimeout(() => {
                handleStartCall(callType === 'video');
            }, 300);
        }
        return () => {
            if (autoCallTimer) clearTimeout(autoCallTimer);
        };
    }, [searchParams, isConnected, isConnecting, dmChannelId]);

    // Auto-join accepted incoming call when navigated with ?join=voice or ?join=video
    const autoJoinHandled = useRef(false);
    useEffect(() => {
        let autoJoinTimer: ReturnType<typeof setTimeout> | null = null;
        const joinType = searchParams.get('join');
        if (joinType && !autoJoinHandled.current && !isConnected && !isConnecting && dmChannelId) {
            autoJoinHandled.current = true;
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('join');
            setSearchParams(newParams, { replace: true });

            autoJoinTimer = setTimeout(() => {
                connect()
                    .then(async () => {
                        if (joinType === 'video') {
                            try {
                                await toggleCamera();
                            } catch {
                                // Keep call connected even if camera enabling fails.
                            }
                        }
                    })
                    .catch((err) => {
                        showCallErrorToast(err);
                    });
            }, 150);
        }
        return () => {
            if (autoJoinTimer) clearTimeout(autoJoinTimer);
        };
    }, [searchParams, isConnected, isConnecting, dmChannelId, connect, setSearchParams, toggleCamera, showCallErrorToast]);

    // Reset auto-call flag when channel changes
    useEffect(() => {
        autoCallHandled.current = false;
        autoJoinHandled.current = false;
    }, [dmChannelId]);

    // End call
    const handleEndCall = async () => {
        await leaveVoiceSession({ disconnectLiveKit: disconnect, clearVoiceState: voiceCtx.clearCallState });
        clearCallErrorToastDedup();
        setShowVolumePanel(false);
        addToast({ title: 'Call Ended', description: 'You left the call.', variant: 'info' });
    };

    // Volume handlers
    const handleMasterVolumeChange = (volume: number) => {
        setMasterVolume(volume);
        setLivekitMasterVolume(volume);
    };

    const handleOtherUserVolumeChange = (volume: number) => {
        setOtherUserVolume(volume);
        const primaryParticipant = getPrimaryRemoteParticipant(participants, recipientId);
        if (primaryParticipant) {
            setParticipantVolume(primaryParticipant.id, volume);
        }
    };

    // Mention autocomplete: filter group participants
    const filteredMentionUsers = groupParticipants.filter(u =>
        mentionSearch !== null &&
        (u.username.toLowerCase().includes(mentionSearch.toLowerCase()) || u.displayName.toLowerCase().includes(mentionSearch.toLowerCase()))
    );

    // Build members list for RichTextRenderer mention resolution.
    // For group DMs, use groupParticipants. For 1-on-1 DMs, include both users.
    const dmMembersForMentions = useMemo(() => {
        if (isGroupDm) {
            return groupParticipants.map(p => ({ id: p.id, username: p.username, displayName: p.displayName }));
        }
        const members: Array<{ id: string; username: string; displayName: string }> = [];
        if (currentUserId && currentUserName) {
            members.push({ id: currentUserId, username: currentUserName, displayName: currentUserName });
        }
        if (recipientId && userName) {
            members.push({ id: recipientId, username: userName, displayName: profileData?.displayName || userName });
        }
        return members;
    }, [isGroupDm, groupParticipants, currentUserId, currentUserName, recipientId, userName, profileData?.displayName]);

    const dmCursorPosRef = useRef(0);

    const formatAttachmentSize = useCallback((size: number) => {
        if (size < 1024) return `${size} B`;
        if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / 1048576).toFixed(1)} MB`;
    }, []);

    const fingerprintDmFile = useCallback((file: File) => {
        const normalizedName = (file.name || '').trim().toLowerCase();
        if (normalizedName) {
            return `${normalizedName}:${file.size}:${file.type}:${file.lastModified}`;
        }
        return `${file.size}:${file.type}:${file.lastModified}`;
    }, []);

    const enqueueDmFiles = useCallback((rawFiles: File[]) => {
        if (!rawFiles.length) return;
        const MAX_FILE_SIZE = 25 * 1024 * 1024;
        rawFiles.filter(f => f.size > MAX_FILE_SIZE).forEach(f =>
            addToast({ title: `${f.name} is too large (max 25 MB)`, variant: 'error' })
        );
        const files = rawFiles.filter(f => f.size <= MAX_FILE_SIZE);
        if (!files.length) return;
        const now = Date.now();
        const recent = recentDmAttachmentFingerprintsRef.current;

        for (const [fingerprint, ts] of recent.entries()) {
            if (now - ts > 2000) recent.delete(fingerprint);
        }

        setDmAttachedFiles(prev => {
            const existingFingerprints = new Set(
                prev.map(f => fingerprintDmFile(f.file))
            );
            const next = [...prev];

            for (const file of files) {
                const fingerprint = fingerprintDmFile(file);
                if (recent.has(fingerprint) || existingFingerprints.has(fingerprint)) continue;
                recent.set(fingerprint, now);
                existingFingerprints.add(fingerprint);
                next.push({
                    file,
                    name: file.name || `attachment-${Date.now()}`,
                    size: formatAttachmentSize(file.size),
                    previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
                });
            }
            return next;
        });
    }, [fingerprintDmFile, formatAttachmentSize, addToast]);

    const handleDmInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart ?? val.length;
        dmCursorPosRef.current = cursor;
        undoBufferRef.current = [...undoBufferRef.current.slice(-49), val];
        setInputValue(val);
        if (val.trim().length > 0) sendTypingIndicator();

        // Auto-save draft (debounced 500ms)
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
        if (dmChannelId) {
            const draftKey = `gratonite:draft:${dmChannelId}`;
            if (val.trim().length > 0) {
                setHasDraft(true);
                try { localStorage.setItem(draftKey, val); } catch { /* ignore */ }
                draftSaveTimerRef.current = setTimeout(() => {
                    fetch(`${API_BASE}/channels/${dmChannelId}/draft`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${getAccessToken() ?? ''}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: val }),
                    }).catch(() => {});
                }, 500);
            } else {
                setHasDraft(false);
                try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
                fetch(`${API_BASE}/channels/${dmChannelId}/draft`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
                }).catch(() => {});
            }
        }

        if (isGroupDm) {
            const beforeCursor = val.slice(0, cursor);
            const mentionMatch = beforeCursor.match(/@([a-zA-Z0-9_]*)$/);
            if (mentionMatch) {
                setMentionSearch(mentionMatch[1]);
                setMentionIndex(0);
            } else {
                setMentionSearch(null);
            }
        }
    };

    const insertDmMention = (userId: string) => {
        if (mentionSearch === null) return;
        const member = dmMembersForMentions.find(m => m.id === userId) || filteredMentionUsers.find(u => u.id === userId);
        const username = member?.username || userId;
        let displayToken = `@${username}`;
        if (dmMentionsMapRef.current.has(displayToken) && dmMentionsMapRef.current.get(displayToken) !== `<@${userId}>`) {
            displayToken = `@${username}#${userId.slice(-4)}`;
        }
        dmMentionsMapRef.current.set(displayToken, `<@${userId}>`);
        const cursor = dmCursorPosRef.current;
        const beforeCursor = inputValue.slice(0, cursor);
        const afterCursor = inputValue.slice(cursor);
        const replaced = beforeCursor.replace(/@([a-zA-Z0-9_]*)$/, `${displayToken} `);
        const newVal = replaced + afterCursor;
        setInputValue(newVal);
        const newCursor = replaced.length;
        dmCursorPosRef.current = newCursor;
        setTimeout(() => {
            const ta = document.querySelector('.chat-input') as HTMLTextAreaElement | null;
            if (ta) { ta.selectionStart = ta.selectionEnd = newCursor; }
        }, 0);
        setMentionSearch(null);
    };

    const handleDmKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (mentionSearch !== null && filteredMentionUsers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredMentionUsers.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertDmMention(filteredMentionUsers[mentionIndex].id);
                return;
            } else if (e.key === 'Escape') {
                setMentionSearch(null);
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (editingMessage) { handleEditSubmit(); return; }
            handleSendMessage();
        }
        if (e.key === 'Escape' && editingMessage) { setEditingMessage(null); setInputValue(''); return; }
        if (e.key === 'Escape' && replyingTo) { setReplyingTo(null); return; }
        // Ctrl+Z / Cmd+Z: restore previous input from undo buffer
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && undoBufferRef.current.length > 0) {
            e.preventDefault();
            const prev = undoBufferRef.current[undoBufferRef.current.length - 1];
            undoBufferRef.current = undoBufferRef.current.slice(0, -1);
            setInputValue(prev);
            return;
        }
        // ↑ arrow in empty input: start editing your last sent message
        if (e.key === 'ArrowUp' && !inputValue.trim() && !editingMessage) {
            const lastOwn = [...messages].reverse().find(m => m.authorId === currentUserId && !m.system && m.apiId);
            if (lastOwn) {
                e.preventDefault();
                setEditingMessage({ id: lastOwn.id, apiId: lastOwn.apiId!, content: lastOwn.content });
                setInputValue(lastOwn.content);
                return;
            }
        }
    };

    // Safety number computation
    const handleShowSafetyNumber = useCallback(async () => {
        if (!e2eKeyPairRef.current || !partnerPublicKeyRef.current) return;
        try {
            const number = await computeSafetyNumber(e2eKeyPairRef.current.publicKey, partnerPublicKeyRef.current);
            setSafetyNumber(number);
            setShowSafetyNumber(true);
        } catch { /* non-fatal */ }
    }, []);

    // Cleanup decrypted file blob URLs on unmount
    useEffect(() => {
        return () => {
            blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            blobUrlsRef.current = [];
            decryptInFlightRef.current.clear();
        };
    }, []);

    // Populate input when editing a message
    useEffect(() => {
        if (editingMessage) {
            // If encrypted, use decrypted content if available
            const decrypted = decryptedContents.get(editingMessage.id);
            setInputValue(decrypted || editingMessage.content);
        }
    }, [editingMessage]);

    const handleEditSubmit = async () => {
        if (!editingMessage || !dmChannelId) return;
        const newContent = inputValue.trim();
        if (!newContent) return;
        if (newContent.length > 2000) {
            addToast({ title: `Message too long (${newContent.length}/2000)`, variant: 'error' });
            return;
        }

        try {
            let editPayload: { content?: string; encryptedContent?: string; isEncrypted?: boolean; keyVersion?: number };
            if (e2eKey) {
                const encryptedContent = await encrypt(e2eKey, newContent);
                editPayload = { encryptedContent, isEncrypted: true, ...(groupKeyVersion != null ? { keyVersion: groupKeyVersion } : {}) };
                // Update decrypted cache optimistically
                setDecryptedContents(prev => { const next = new Map(prev); next.set(editingMessage.id, newContent); return next; });
            } else {
                editPayload = { content: newContent };
            }

            await api.messages.edit(dmChannelId, editingMessage.apiId, editPayload);
            setMessages(prev => prev.map(m => m.id === editingMessage.id ? { ...m, content: e2eKey ? '' : newContent, edited: true } : m));
        } catch {
            addToast({ title: 'Failed to edit message', variant: 'error' });
        }
        setEditingMessage(null);
        setInputValue('');
    };

    const dmUploadWithProgress = useCallback(
        (file: File, onProgress: (pct: number) => void) =>
            new Promise<{ id: string; url: string; filename: string; size: number; mimeType: string }>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const fd = new FormData();
                fd.append('file', file);
                fd.append('purpose', 'attachment');
                xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100)); };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
                    else reject(new Error(xhr.statusText || `Upload failed (${xhr.status})`));
                };
                xhr.onerror = () => reject(new Error('Network error during upload'));
                xhr.open('POST', `${API_BASE}/files/upload`);
                const token = getAccessToken();
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                xhr.send(fd);
            }),
        [],
    );

    const handleSendMessage = async () => {
        if (isSendingMessageRef.current || isSendingMessage) return;
        if (inputValue.trim() === '' && dmAttachedFiles.length === 0) return;
        if (!dmChannelId) {
            addToast({ title: 'Message unavailable', description: 'Conversation is not ready yet. Please retry.', variant: 'error' });
            return;
        }
        if (rateLimitRemaining > 0) {
            addToast({ title: `Rate limited. Wait ${rateLimitRemaining}s`, variant: 'error' });
            return;
        }
        const dmWireContent = resolveDmWireContent(inputValue);
        if (dmWireContent.length > 2000) {
            addToast({ title: `Message too long (${dmWireContent.length}/2000)`, variant: 'error' });
            return;
        }
        isSendingMessageRef.current = true;
        setIsSendingMessage(true);
        try {
            // Upload files — encrypt file content if E2E key is available
            const uploadedFiles: { id: string; url: string; filename: string; mimeType: string; size: number }[] = [];
            const encryptedFileMeta: Array<{ id: string; iv: string; ef: string; mt: string }> = [];
            if (dmAttachedFiles.length > 0) {
                setDmUploadProgress(Object.fromEntries(dmAttachedFiles.map(f => [f.name, 0])));
            }
            for (const f of dmAttachedFiles) {
                try {
                    if (e2eEnabled && e2eKey) {
                        // Encrypt file content and filename before upload
                        const { encryptedBlob, encryptedFilename, iv } = await encryptFile(e2eKey, f.file);
                        const encFile = new File([encryptedBlob], 'encrypted.bin', { type: 'application/octet-stream' });
                        const result = await dmUploadWithProgress(encFile, (pct) => setDmUploadProgress(prev => ({ ...prev, [f.name]: pct })));
                        uploadedFiles.push(result);
                        encryptedFileMeta.push({ id: result.id, iv, ef: encryptedFilename, mt: f.file.type || 'application/octet-stream' });
                    } else {
                        const result = await dmUploadWithProgress(f.file, (pct) => setDmUploadProgress(prev => ({ ...prev, [f.name]: pct })));
                        uploadedFiles.push(result);
                    }
                } catch {
                    setDmUploadProgress(prev => ({ ...prev, [f.name]: -1 }));
                    addToast({ title: `Failed to upload ${f.name}`, variant: 'error' });
                }
            }

            const content = resolveDmWireContent(inputValue).trim() || null;
            const attachmentIds = uploadedFiles.map(f => f.id);

            if (content || attachmentIds.length > 0) {
                const optimisticId = Date.now();
                // Build attachment metadata for the optimistic message
                const attachments: MessageAttachment[] = uploadedFiles.map((f, idx) => ({
                    id: f.id,
                    filename: encryptedFileMeta[idx] ? dmAttachedFiles[idx]?.name || f.filename : f.filename,
                    url: f.url,
                    contentType: encryptedFileMeta[idx]?.mt || f.mimeType,
                    size: f.size,
                }));

                // Build the reply reference
                const replyToApiId = replyingTo?.apiId || undefined;
                const replyToAuthor = replyingTo?.author || undefined;
                const replyToContent = replyingTo?.content || undefined;

                // Encrypt only when user has explicitly enabled E2E for this conversation
                let sendPayload: { content?: string | null; encryptedContent?: string; isEncrypted?: boolean; attachmentIds?: string[]; keyVersion?: number; replyToId?: string };
                let optimisticContent = content;
                if (e2eEnabled && e2eKey && (content || encryptedFileMeta.length > 0)) {
                    try {
                        // Build structured payload when files are present, plain text otherwise
                        const plainPayload = encryptedFileMeta.length > 0
                            ? JSON.stringify({ _e2e: 2, text: content, files: encryptedFileMeta })
                            : content;
                        const encryptedContent = await encrypt(e2eKey!, plainPayload ?? '');
                        sendPayload = { content: null, encryptedContent, isEncrypted: true, attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined, ...(groupKeyVersion != null ? { keyVersion: groupKeyVersion } : { keyVersion: myKeyVersionRef.current }), ...(replyToApiId ? { replyToId: replyToApiId } : {}) };
                        // Store decrypted version optimistically so sender sees plaintext immediately
                        setDecryptedContents(prev => { const next = new Map(prev); next.set(optimisticId, content ?? ''); return next; });
                    } catch {
                        addToast({ title: 'Failed to encrypt message on this device', variant: 'error' });
                        return;
                    }
                } else {
                    sendPayload = { content, attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined, ...(replyToApiId ? { replyToId: replyToApiId } : {}) };
                }

                const isOptimisticEncrypted = e2eEnabled && e2eKey != null && content != null && content.length > 0 && 'encryptedContent' in sendPayload;

                setMessages(prev => [...prev, {
                    id: optimisticId,
                    authorId: currentUserId,
                    author: currentUserName || 'You',
                    authorAvatarHash: userProfile?.avatarHash ?? null,
                    system: false,
                    avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    content: isOptimisticEncrypted ? '' : (optimisticContent ?? ''),
                    createdAt: new Date().toISOString(),
                    isEncrypted: isOptimisticEncrypted,
                    encryptedContent: isOptimisticEncrypted ? sendPayload.encryptedContent ?? null : null,
                    attachments,
                    ...(replyToApiId ? { replyToId: replyToApiId, replyToAuthor, replyToContent } : {}),
                }]);

                api.messages.send(dmChannelId, sendPayload).then((res: any) => {
                    if (res?.id) {
                        setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, apiId: res.id, authorId: res.authorId } : m));
                        // Move decrypted content to real message id
                        if (isOptimisticEncrypted) {
                            setDecryptedContents(prev => {
                                const text = prev.get(optimisticId);
                                if (!text) return prev;
                                const next = new Map(prev);
                                next.delete(optimisticId);
                                // We can't use apiId as numeric key; keep optimistic entry for now
                                return next;
                            });
                        }
                    }
                }).catch(() => {
                    setMessages(prev => prev.filter(m => m.id !== optimisticId));
                    addToast({ title: 'Failed to send message', variant: 'error' });
                });
            }

            // Cleanup preview URLs
            dmAttachedFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
            setInputValue('');
            setHasDraft(false);
            if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
            if (dmChannelId) {
                try { localStorage.removeItem(`gratonite:draft:${dmChannelId}`); } catch { /* ignore */ }
                fetch(`${API_BASE}/channels/${dmChannelId}/draft`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
                }).catch(() => {});
            }
            dmMentionsMapRef.current.clear();
            setDmAttachedFiles([]);
            setDmUploadProgress({});
            setReplyingTo(null);
        } finally {
            isSendingMessageRef.current = false;
            setIsSendingMessage(false);
        }
    };

    const handleSendGif = (url: string, _previewUrl: string) => {
        const optimisticId = Date.now();
        setMessages(prev => [...prev, {
            id: optimisticId,
            authorId: currentUserId,
            author: currentUserName || 'You',
            authorAvatarHash: userProfile?.avatarHash ?? null,
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
        if (dmChannelId) {
            api.messages.send(dmChannelId, { content: url }).then((sent: any) => {
                if (sent?.id) {
                    setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, apiId: sent.id } : m));
                }
            }).catch(() => {
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
            });
        }
    };

    // Prefer the intended DM peer, but fall back gracefully if more remotes are present.
    const otherParticipant = getPrimaryRemoteParticipant(participants, recipientId);
    const localDisplayTrack = localParticipant?.screenTrack ?? localParticipant?.videoTrack;
    const remoteDisplayTrack = otherParticipant?.screenTrack ?? otherParticipant?.videoTrack;
    const remoteParticipantCount = participants.length;
    const additionalRemoteParticipants = Math.max(0, remoteParticipantCount - (otherParticipant ? 1 : 0));
    const callErrorHint = connectionError ? getConnectionErrorHint(connectionError) : null;

    return (
        <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
            <BackgroundMedia media={bgMedia} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <header className="top-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isMobile && (
                            <button className="mobile-back-btn" onClick={() => navigate('/friends')}>
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        {isGroupDm ? (
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Users size={18} color="var(--bg-app)" />
                            </div>
                        ) : (
                            <Avatar
                                userId={recipientId || dmChannelId || ''}
                                avatarHash={recipientAvatarHash}
                                displayName={userName || 'Unknown'}
                                size={36}
                                status={(presenceMap[recipientId || ''] || 'offline') as 'online' | 'idle' | 'dnd' | 'invisible' | 'offline'}
                            />
                        )}
                        <div>
                            <h2 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isGroupDm && isEditingGroupName ? (
                                    <input
                                        autoFocus
                                        value={editGroupNameValue}
                                        onChange={(e) => setEditGroupNameValue(e.target.value)}
                                        onBlur={async () => {
                                            setIsEditingGroupName(false);
                                            if (editGroupNameValue.trim() && editGroupNameValue.trim() !== groupName) {
                                                try {
                                                    await api.groupDms.update(dmChannelId, { groupName: editGroupNameValue.trim() });
                                                    setGroupName(editGroupNameValue.trim());
                                                    setUserName(editGroupNameValue.trim());
                                                } catch { addToast({ title: 'Failed to rename group', variant: 'error' }); }
                                            }
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setIsEditingGroupName(false); }}
                                        style={{ fontSize: '1.05rem', fontWeight: 600, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '4px', padding: '2px 8px', color: 'var(--text-primary)', outline: 'none', width: '200px' }}
                                    />
                                ) : (
                                    <>
                                        {userName}
                                        {isGroupDm && groupOwnerId === userProfile?.id && (
                                            <Pencil size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => { setEditGroupNameValue(groupName); setIsEditingGroupName(true); }} />
                                        )}
                                        {e2eSupported && e2eKey && !isGroupDm && (
                                            <span
                                                title="End-to-end encrypted — click to verify safety number"
                                                onClick={handleShowSafetyNumber}
                                                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', marginLeft: '4px' }}
                                            >
                                                <Lock size={14} style={{ color: 'var(--success, #22c55e)' }} aria-label="End-to-end encrypted" />
                                            </span>
                                        )}
                                        {e2eKey && isGroupDm && groupE2eAllMembersHaveKeys && (
                                            <Lock size={14} style={{ color: 'var(--success, #22c55e)' }} aria-label="End-to-end encrypted (group)" />
                                        )}
                                    </>
                                )}
                                {isConnected && (
                                    <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>
                                        In Call
                                    </span>
                                )}
                                {isRinging && (
                                    <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 500, animation: 'pulse 1.5s ease-in-out infinite' }}>
                                        Calling...
                                    </span>
                                )}
                            </h2>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {isGroupDm ? `${groupParticipants.length} members` : userStatus}
                            </div>
                        </div>
                        {!isGroupDm && recipientId && (
                            <FriendshipStreak friendId={recipientId} compact />
                        )}
                    </div>

                    <div style={{ flex: 1 }}></div>

                    <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                        <input type="file" ref={bgInputRef} accept="image/*,video/mp4,video/webm,image/gif" onChange={handleUploadBg} style={{ display: 'none' }} />
                        <ImageIcon size={20} className="hover-text-primary" style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => bgInputRef.current?.click()} />
                        {hasCustomBg && <X size={18} style={{ cursor: 'pointer', color: 'var(--error)', transition: 'opacity 0.2s' }} onClick={() => setBgMedia(null)} />}

                        {!isConnected && !isConnecting && !isRinging && (
                            <>
                                <Phone size={20} className="hover-text-primary" style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => handleStartCall(false)} />
                                <Video size={20} className="hover-text-primary" style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => handleStartCall(true)} />
                            </>
                        )}
                        {isRinging && (
                            <>
                                <span style={{ fontSize: 12, color: 'var(--accent-primary)', animation: 'pulse 1.5s ease-in-out infinite' }}>Ringing...</span>
                                <PhoneOff size={20} style={{ cursor: 'pointer', color: 'var(--error)' }} onClick={handleCancelCall} />
                            </>
                        )}
                        {isConnecting && !isRinging && (
                            <Loader2 size={20} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                        )}

                        {isGroupDm && (
                            <Users size={20} className="hover-text-primary-inactive" data-active={memberPanelOpen ? "true" : undefined} style={{ cursor: 'pointer', transition: 'color 0.2s', color: memberPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }} onClick={() => setMemberPanelOpen(!memberPanelOpen)} />
                        )}

                        <Pin
                            size={20}
                            aria-label="Pinned Messages"
                            className="hover-text-primary-inactive"
                            style={{ cursor: 'pointer', transition: 'color 0.2s', color: showPinnedPanel ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                            onClick={() => setShowPinnedPanel(v => !v)}
                        />

                        {/* Disappear Timer (A2) */}
                        <div style={{ position: 'relative' }} ref={disappearMenuRef}>
                            <Clock
                                size={20}
                                style={{ cursor: 'pointer', transition: 'color 0.2s', color: disappearTimer ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                onClick={() => setShowDisappearMenu(v => !v)}
                                aria-label={disappearTimer ? `Disappearing: ${disappearTimer >= 86400 ? `${disappearTimer / 86400}d` : disappearTimer >= 3600 ? `${disappearTimer / 3600}h` : `${disappearTimer / 60}m`}` : 'Disappearing Messages Off'}
                            />
                            {showDisappearMenu && (
                                <div style={{ position: 'absolute', top: '28px', right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px', zIndex: 50, minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                    {[
                                        { label: 'Off', value: null },
                                        { label: '5 minutes', value: 300 },
                                        { label: '1 hour', value: 3600 },
                                        { label: '24 hours', value: 86400 },
                                        { label: '7 days', value: 604800 },
                                    ].map(opt => (
                                        <button key={String(opt.value)} onClick={() => handleSetDisappearTimer(opt.value)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '4px', border: 'none', background: disappearTimer === opt.value ? 'var(--accent-primary)' : 'transparent', color: disappearTimer === opt.value ? '#fff' : 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* E2E lock toggle is next to username, not here */}
                        <span title="Search messages (Ctrl+F)" style={{ display: 'inline-flex' }}>
                            <Search size={20} className="hover-text-primary-inactive" data-active={showSearchBar ? "true" : undefined} style={{ cursor: 'pointer', transition: 'color 0.2s', color: showSearchBar ? 'var(--accent-primary)' : 'var(--text-secondary)' }} onClick={() => { if (showSearchBar) { closeDmSearch(); } else { setShowSearchBar(true); setTimeout(() => searchInputRef.current?.focus(), 50); } }} />
                        </span>
                        <Info size={20} className="hover-text-primary-inactive" data-active={infoPanelOpen ? "true" : undefined} style={{ cursor: 'pointer', transition: 'color 0.2s', color: infoPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }} onClick={() => { setInfoPanelOpen(!infoPanelOpen); if (isGroupDm) setMemberPanelOpen(false); }} />
                    </div>
                </header>

                {/* E2E encryption warning banners */}
                {e2eSupported && !e2eKey && e2eError && (
                    <div style={{ padding: '8px 16px', background: 'var(--warning-bg, rgba(234,179,8,0.15))', borderBottom: '1px solid var(--warning, #eab308)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--warning, #eab308)' }}>
                        <Lock size={14} />
                        <span>{e2eRecoveryRequired ? 'Encrypted history is unavailable on this device — ' : 'Messages are not encrypted — '}</span>
                        {e2eRecoveryRequired
                            ? <button onClick={() => { if (typeof (window as any).__openSettings === 'function') (window as any).__openSettings('privacy'); }} style={{ color: 'var(--warning, #eab308)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit', textDecoration: 'underline' }}>Restore key in Privacy settings →</button>
                            : <span>{e2eError}</span>
                        }
                    </div>
                )}
                {partnerKeyChanged && (
                    <div style={{ padding: '8px 16px', background: 'var(--warning-bg, rgba(234,179,8,0.15))', borderBottom: '1px solid var(--warning, #eab308)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--warning, #eab308)', cursor: 'pointer' }} onClick={() => setPartnerKeyChanged(false)}>
                        <Lock size={14} />
                        <span>Your partner&apos;s encryption key has changed. Verify their identity to ensure security.</span>
                        <X size={14} style={{ marginLeft: 'auto' }} />
                    </div>
                )}

                {/* E2E encryption guide — shown once */}
                {showE2eGuide && e2eSupported && e2eKey && !isGroupDm && (
                    <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--stroke)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                    <Shield size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>End-to-End Encrypted</strong>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span>This conversation is end-to-end encrypted. Only you and the other person can read it.</span>
                                    <span><Lock size={11} style={{ color: 'var(--success, #22c55e)', verticalAlign: 'middle', marginRight: '4px' }} />
                                        Click the <strong style={{ color: 'var(--text-primary)' }}>green lock</strong> to view your <strong style={{ color: 'var(--text-primary)' }}>safety number</strong> — compare it with the other person to confirm your connection is secure.</span>
                                </div>
                            </div>
                            <button
                                onClick={() => { setShowE2eGuide(false); localStorage.setItem('gratonite:e2e-guide-dismissed', 'true'); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', flexShrink: 0 }}
                                aria-label="Close"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Safety Number Modal */}
                {showSafetyNumber && safetyNumber && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSafetyNumber(false)}>
                        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Shield size={18} style={{ color: 'var(--success, #22c55e)' }} />
                                    Safety Number
                                </h3>
                                <X size={18} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowSafetyNumber(false)} />
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0', lineHeight: 1.5 }}>
                                Compare this number with <strong style={{ color: 'var(--text-primary)' }}>{userName}</strong> to verify that your conversation is securely encrypted. If the numbers match, no one has intercepted your keys.
                            </p>
                            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '18px', letterSpacing: '2px', textAlign: 'center', lineHeight: 2, wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                                {safetyNumber.match(/.{1,5}/g)?.join(' ')}
                            </div>
                            <button onClick={() => { copyToClipboard(safetyNumber); addToast({ title: 'Safety number copied', variant: 'info' }); }} style={{ marginTop: '12px', width: '100%', padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
                                Copy to clipboard
                            </button>
                            <a href="https://gratonite.chat/blog/how-to-use-encrypted-dms" target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: '10px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                                Learn how encryption works
                            </a>
                        </div>
                    </div>
                )}

                {/* Call Area / Chat Area */}
                {isConnected || isConnecting ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                        {connectionState === ConnectionState.Reconnecting && (
                            <div style={{ margin: '16px 24px 0', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'flex-start', gap: '10px', zIndex: 2 }}>
                                <Loader2 size={16} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite', flexShrink: 0, marginTop: '2px' }} />
                                <div>
                                    <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>Reconnecting call...</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5 }}>Trying to restore your DM call without hanging up.</div>
                                </div>
                            </div>
                        )}
                        {isConnecting ? (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                                <Loader2 size={48} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                                <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>Connecting to {userName}...</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flex: 1, padding: '24px', gap: '16px' }}>
                                {/* You */}
                                <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: localParticipant?.isSpeaking ? 'var(--border-focused)' : '1px solid var(--stroke)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border 0.2s' }}>
                                    {localDisplayTrack ? (
                                        <ParticipantVideo track={localDisplayTrack} />
                                    ) : (
                                        <>
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60px', background: 'var(--accent-blue)', opacity: 0.2, filter: 'blur(20px)' }}></div>
                                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 600, color: 'white', zIndex: 2, boxShadow: localParticipant?.isSpeaking ? '0 0 0 4px var(--bg-elevated), 0 0 0 8px var(--accent-primary)' : 'none', transition: 'box-shadow 0.2s' }}>{(currentUserName || 'Y').charAt(0).toUpperCase()}</div>
                                        </>
                                    )}
                                    <div style={{ position: 'absolute', bottom: '16px', left: '16px', fontWeight: 600, zIndex: 2, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>You</div>
                                    <div style={{ position: 'absolute', bottom: '16px', right: '16px', display: 'flex', gap: '6px', zIndex: 2 }}>
                                        {isMuted && <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}><MicOff size={16} /></div>}
                                        {isDeafened && <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}><HeadphoneOff size={16} /></div>}
                                        {localParticipant?.isScreenSharing && <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-primary)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}><MonitorUp size={16} /></div>}
                                    </div>
                                </div>
                                {/* Them */}
                                <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: otherParticipant?.isSpeaking ? 'var(--border-focused)' : '1px solid var(--stroke)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border 0.2s' }}>
                                    {remoteDisplayTrack ? (
                                        <ParticipantVideo track={remoteDisplayTrack} />
                                    ) : (
                                        <>
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60px', background: 'var(--bg-tertiary)', opacity: 0.2, filter: 'blur(20px)' }}></div>
                                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: userColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 600, color: 'white', zIndex: 2, boxShadow: otherParticipant?.isSpeaking ? '0 0 0 4px var(--bg-elevated), 0 0 0 8px var(--accent-primary)' : 'none', transition: 'box-shadow 0.2s' }}>{initial}</div>
                                        </>
                                    )}
                                    <div style={{ position: 'absolute', bottom: '16px', left: '16px', fontWeight: 600, zIndex: 2, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{userName || 'Waiting...'}</div>
                                    {!otherParticipant && (
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', zIndex: 3 }}>
                                            <p>Waiting for {userName} to join...</p>
                                        </div>
                                    )}
                                    {additionalRemoteParticipants > 0 && (
                                        <div style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px 10px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', fontSize: '12px', fontWeight: 600, zIndex: 3 }}>
                                            +{additionalRemoteParticipants} more in call
                                        </div>
                                    )}
                                    {otherParticipant?.isScreenSharing && (
                                        <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-primary)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', zIndex: 3 }}>
                                            <MonitorUp size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Call Volume Settings Panel */}
                        {showVolumePanel && (
                            <div ref={volumePanelRef} style={{
                                position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', zIndex: 20,
                                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)',
                                padding: '20px', minWidth: '280px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Call Volume</h3>
                                    <X size={16} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowVolumePanel(false)} />
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Master Volume</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Volume2 size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                        <input type="range" min={0} max={100} value={masterVolume} onChange={(e) => handleMasterVolumeChange(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '4px', cursor: 'pointer' }} />
                                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, minWidth: '36px', textAlign: 'right' }}>{masterVolume}%</span>
                                    </div>
                                </div>

                                <div style={{ borderTop: '1px solid var(--stroke)', paddingTop: '12px' }}>
                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>{userName} Volume</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Avatar userId={recipientId || dmChannelId || ''} avatarHash={recipientAvatarHash} displayName={userName || 'Unknown'} size={24} />
                                        <input type="range" min={0} max={200} value={otherUserVolume} onChange={(e) => handleOtherUserVolumeChange(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '3px', cursor: 'pointer' }} />
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>{otherUserVolume}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Call Controls */}
                        {isConnected && (
                            <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--bg-elevated)', padding: '12px 24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--stroke)', boxShadow: 'var(--shadow-panel)', zIndex: 10 }}>
                                <button
                                    onClick={toggleMute}
                                    style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: isMuted ? 'var(--error)' : 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)', color: isMuted ? 'white' : 'var(--text-primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                                </button>
                                <div ref={openDeviceMenu === 'audio' ? deviceMenuRef : null} style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setOpenDeviceMenu(openDeviceMenu === 'audio' ? null : 'audio')}
                                        style={{
                                            width: '32px', height: '48px', borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                        }}
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                    {openDeviceMenu === 'audio' && (
                                        <div style={{
                                            position: 'absolute', bottom: '56px', left: '-72px', width: '240px',
                                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)',
                                            boxShadow: '0 10px 30px rgba(0,0,0,0.45)', padding: '8px', zIndex: 30,
                                        }}>
                                            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', padding: '0 4px' }}>Detected Microphones</div>
                                            {audioInputDevices.length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 8px' }}>No microphones detected</div>
                                            ) : (
                                                audioInputDevices.map((device, index) => (
                                                    <button
                                                        key={device.deviceId || `audio-${index}`}
                                                        onClick={() => {
                                                            void selectAudioInput(device.deviceId);
                                                            setOpenDeviceMenu(null);
                                                        }}
                                                        style={{
                                                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            gap: '10px', padding: '7px 8px', borderRadius: 'var(--radius-sm)',
                                                            border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
                                                        }}
                                                    >
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                                                            {device.label || `Microphone ${index + 1}`}
                                                        </span>
                                                        {selectedAudioInputId === device.deviceId && <Check size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={toggleDeafen}
                                    style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: isDeafened ? 'var(--error)' : 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)', color: isDeafened ? 'white' : 'var(--text-primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    {isDeafened ? <HeadphoneOff size={20} /> : <Headphones size={20} />}
                                </button>

                                <button
                                    onClick={() => { void handleToggleCamera(); }}
                                    style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: isCameraOn ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)', color: isCameraOn ? '#000' : 'var(--text-primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                                </button>
                                <div ref={openDeviceMenu === 'video' ? deviceMenuRef : null} style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setOpenDeviceMenu(openDeviceMenu === 'video' ? null : 'video')}
                                        style={{
                                            width: '32px', height: '48px', borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                        }}
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                    {openDeviceMenu === 'video' && (
                                        <div style={{
                                            position: 'absolute', bottom: '56px', left: '-72px', width: '240px',
                                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)',
                                            boxShadow: '0 10px 30px rgba(0,0,0,0.45)', padding: '8px', zIndex: 30,
                                        }}>
                                            <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', padding: '0 4px' }}>Detected Cameras</div>
                                            {videoInputDevices.length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 8px' }}>No cameras detected</div>
                                            ) : (
                                                videoInputDevices.map((device, index) => (
                                                    <button
                                                        key={device.deviceId || `video-${index}`}
                                                        onClick={() => {
                                                            void selectVideoInput(device.deviceId);
                                                            setOpenDeviceMenu(null);
                                                        }}
                                                        style={{
                                                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            gap: '10px', padding: '7px 8px', borderRadius: 'var(--radius-sm)',
                                                            border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
                                                        }}
                                                    >
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '12px' }}>
                                                            {device.label || `Camera ${index + 1}`}
                                                        </span>
                                                        {selectedVideoInputId === device.deviceId && <Check size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => { void handleToggleScreenShare(); }}
                                    style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: isScreenSharing ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)', color: isScreenSharing ? '#000' : 'var(--text-primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    <MonitorUp size={20} />
                                </button>

                                {/* Stream Quality Picker */}
                                <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--stroke)', height: '36px', alignSelf: 'center' }}>
                                    {(['low', 'medium', 'high', 'source'] as const).map((q) => (
                                        <button
                                            key={q}
                                            onClick={() => setStreamQuality(q)}
                                            style={{
                                                padding: '0 10px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                                background: streamQuality === q ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                color: streamQuality === q ? '#000' : 'var(--text-secondary)',
                                            }}
                                        >
                                            {q === 'medium' ? 'Med' : q.charAt(0).toUpperCase() + q.slice(1)}
                                        </button>
                                    ))}
                                </div>

                                <div style={{ width: '1px', height: '32px', background: 'var(--stroke)', margin: '0 8px' }}></div>

                                <button
                                    onClick={() => setShowVolumePanel(!showVolumePanel)}
                                    style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        background: showVolumePanel ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)', color: showVolumePanel ? '#000' : 'var(--text-primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    <Settings size={20} />
                                </button>

                                <button
                                    onClick={handleEndCall}
                                    style={{
                                        width: '64px', height: '48px', borderRadius: 'var(--radius-sm)',
                                        background: 'var(--error)', border: 'none', color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '8px', transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                                    }}
                                >
                                    <PhoneOff size={20} />
                                </button>
                            </div>
                        )}
                    </div>
                ) : connectionError ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', maxWidth: '420px' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--error-alpha)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <PhoneOff size={32} style={{ color: 'var(--error)' }} />
                            </div>
                            <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600, margin: 0 }}>
                                {classifyCallErrorToast(connectionError).title}
                            </p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, margin: 0 }}>{connectionError}</p>
                            {callErrorHint && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--stroke)', textAlign: 'left' }}>
                                    <MessageSquare size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>{callErrorHint}</p>
                                </div>
                            )}
                            <button
                                onClick={() => {
                                    clearCallErrorToastDedup();
                                    void connect().catch((err) => {
                                        showCallErrorToast(err);
                                    });
                                }}
                                style={{
                                    padding: '12px 24px',
                                    background: 'var(--accent-primary)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    color: '#000',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                Retry call
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Search bar */}
                        {showSearchBar && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--stroke)', zIndex: 3, position: 'relative', flexShrink: 0 }}>
                                <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); performDmSearch(e.target.value); }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') { closeDmSearch(); return; }
                                        if (e.key === 'Enter') {
                                            if (e.shiftKey) navigateDmSearchResult('up');
                                            else navigateDmSearchResult('down');
                                            e.preventDefault();
                                        }
                                    }}
                                    placeholder="Search messages..."
                                    style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
                                />
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0, minWidth: '60px', textAlign: 'center' }}>
                                    {isSearching ? 'Searching…' : searchQuery.trim() ? searchResults.length > 0 ? `${currentSearchIndex + 1} / ${searchResults.length}` : 'No results' : ''}
                                </span>
                                <button onClick={() => navigateDmSearchResult('up')} disabled={searchResults.length === 0} style={{ background: 'transparent', border: 'none', cursor: searchResults.length > 0 ? 'pointer' : 'default', color: searchResults.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', opacity: searchResults.length > 0 ? 1 : 0.4 }} title="Previous (Shift+Enter)"><ChevronUp size={16} /></button>
                                <button onClick={() => navigateDmSearchResult('down')} disabled={searchResults.length === 0} style={{ background: 'transparent', border: 'none', cursor: searchResults.length > 0 ? 'pointer' : 'default', color: searchResults.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', opacity: searchResults.length > 0 ? 1 : 0.4 }} title="Next (Enter)"><ChevronDown size={16} /></button>
                                <button onClick={closeDmSearch} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }} title="Close search (Esc)"><X size={16} /></button>
                            </div>
                        )}
                        <div ref={messageListRef} className="message-area" role="log" aria-label={`Direct messages with ${userName}`} aria-live="polite" style={{ overflowY: 'auto', position: 'relative' }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDragOver(false);
                                const files = e.dataTransfer.files;
                                if (!files.length) return;
                                enqueueDmFiles(Array.from(files));
                            }}
                        >
                            {/* Drag & Drop Overlay */}
                            {isDragOver && (
                                <div style={{
                                    position: 'absolute', inset: 0, zIndex: 100,
                                    background: 'rgba(0,0,0,0.6)',
                                    backdropFilter: 'blur(4px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    pointerEvents: 'none',
                                    border: '3px dashed var(--accent-primary)',
                                    borderRadius: '8px',
                                }}>
                                    <div style={{
                                        background: 'var(--bg-elevated)', padding: '32px 48px',
                                        borderRadius: '16px', textAlign: 'center',
                                        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                                        border: '1px solid var(--stroke)',
                                    }}>
                                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Drop files to upload</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Images, videos, audio, documents</div>
                                    </div>
                                </div>
                            )}
                            {isLoadingMessages ? (
                                <SkeletonMessageList count={5} />
                            ) : messagesError ? (
                                <ErrorState
                                    message="Failed to load messages"
                                    description={
                                        messagesErrorDetail
                                            ? `Could not load this conversation's messages. ${messagesErrorDetail}`
                                            : "Could not load this conversation's messages."
                                    }
                                    onRetry={fetchDmMessages}
                                />
                            ) : null}
                            {isLoadingOlder && (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                                    <div style={{ width: '20px', height: '20px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                </div>
                            )}
                            {!hasMoreMessages && messages.length > 0 && (
                                <div style={{ textAlign: 'center', padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    Beginning of conversation
                                </div>
                            )}
                            <div style={{ padding: '40px 16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)' }}>
                                <Avatar
                                    userId={recipientId || dmChannelId || ''}
                                    avatarHash={recipientAvatarHash}
                                    displayName={userName || 'Unknown'}
                                    size={100}
                                    style={{ marginBottom: '16px' }}
                                />
                                <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', marginBottom: '8px', fontSize: '1.8rem' }}>{userName}</h2>
                                <p style={{ fontSize: '1rem', textAlign: 'center', maxWidth: '400px' }}>This is the beginning of your direct message history with <strong>{userName}</strong>.</p>
                            </div>

                            {/* Call History Cards */}
                            {callHistory.length > 0 && (
                                <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {callHistory.map(call => {
                                        const startDate = new Date(call.startedAt);
                                        const durationMin = call.duration ? Math.round(call.duration / 60000) : 0;
                                        return (
                                            <div key={call.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '12px 16px', borderRadius: '8px',
                                                background: call.missed ? 'rgba(237, 66, 69, 0.08)' : 'var(--bg-secondary)',
                                                border: `1px solid ${call.missed ? 'rgba(237, 66, 69, 0.2)' : 'var(--stroke)'}`,
                                            }}>
                                                <div style={{
                                                    width: '36px', height: '36px', borderRadius: '50%',
                                                    background: call.missed ? 'rgba(237, 66, 69, 0.15)' : 'rgba(67, 181, 129, 0.15)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                }}>
                                                    {call.missed ? <PhoneOff size={18} style={{ color: '#ed4245' }} /> : <Phone size={18} style={{ color: '#43b581' }} />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '14px', color: call.missed ? '#ed4245' : 'var(--text-primary)' }}>
                                                        {call.missed ? 'Missed Call' : 'Voice Call'}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        {startDate.toLocaleDateString()} at {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        {!call.missed && durationMin > 0 && ` · ${durationMin}m`}
                                                        {call.participants.length > 0 && ` · ${call.participants.length} participant${call.participants.length !== 1 ? 's' : ''}`}
                                                    </div>
                                                </div>
                                                {call.missed && (
                                                    <button onClick={() => {
                                                        // Initiate a call back
                                                        addToast({ title: 'Calling back...', variant: 'info' });
                                                    }} style={{
                                                        background: 'var(--success)', border: 'none', borderRadius: '6px',
                                                        padding: '6px 12px', color: '#fff', fontWeight: 600, fontSize: '12px',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                                    }}>
                                                        <Phone size={12} /> Call Back
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {messages.length === 0 && (
                                <EmptyState
                                    type="dm"
                                    title="No messages yet"
                                    description="Send a message to start the conversation. Your messages are end-to-end encrypted."
                                    actionLabel="Say hello"
                                    onAction={() => {
                                        document.querySelector<HTMLInputElement>('.chat-input')?.focus();
                                    }}
                                />
                            )}
                            {messages.map((msg, index) => {
                                const isCurrentUserMessage =
                                    (Boolean(msg.authorId) && msg.authorId === currentUserId)
                                    || (!msg.authorId && msg.author === currentUserName);
                                const currentFrame = userProfile?.avatarFrame ?? 'none';
                                const currentNameplate = userProfile?.nameplateStyle ?? 'none';
                                const prevMsg = index > 0 ? messages[index - 1] : null;
                                const isGrouped = !!(prevMsg &&
                                    !msg.system && !prevMsg.system &&
                                    !msg.replyToId &&
                                    (msg.authorId && prevMsg.authorId ? msg.authorId === prevMsg.authorId : prevMsg.author === msg.author) &&
                                    msg.createdAt && prevMsg.createdAt &&
                                    new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000);

                                const isNewMessageDivider = !!(myLastReadMessageId && prevMsg?.apiId === myLastReadMessageId && msg.apiId !== myLastReadMessageId);

                                const isNewDay = msg.createdAt ? (() => {
                                    const msgDate = new Date(msg.createdAt);
                                    if (!prevMsg?.createdAt) return true;
                                    const prevDate = new Date(prevMsg.createdAt);
                                    return msgDate.getFullYear() !== prevDate.getFullYear() ||
                                        msgDate.getMonth() !== prevDate.getMonth() ||
                                        msgDate.getDate() !== prevDate.getDate();
                                })() : false;
                                const dateSeparatorLabel = isNewDay && msg.createdAt ? (() => {
                                    const d = new Date(msg.createdAt);
                                    const now = new Date();
                                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                    const yesterday = new Date(today.getTime() - 86400000);
                                    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                                    if (msgDay.getTime() === today.getTime()) return 'Today';
                                    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
                                    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
                                })() : null;

                                return (
                                <React.Fragment key={msg.id}>
                                {dateSeparatorLabel && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', margin: '20px 16px 4px', gap: '12px',
                                    }}>
                                        <div style={{ flex: 1, height: '1px', background: 'var(--stroke)' }} />
                                        <span style={{
                                            fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                                            letterSpacing: '0.04em', flexShrink: 0, whiteSpace: 'nowrap',
                                            background: 'var(--bg-primary)', padding: '0 4px',
                                        }}>{dateSeparatorLabel}</span>
                                        <div style={{ flex: 1, height: '1px', background: 'var(--stroke)' }} />
                                    </div>
                                )}
                                {isNewMessageDivider && (
                                    <div className="new-messages-divider" style={{
                                        display: 'flex', alignItems: 'center', margin: '17px 0 4px', padding: '0 16px', position: 'relative',
                                    }}>
                                        <div style={{ flex: 1, height: '1px', background: '#ed4245' }}></div>
                                        <span style={{
                                            color: '#ed4245', fontSize: '11px', fontWeight: 700,
                                            textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1,
                                            padding: '0 0 0 4px', flexShrink: 0,
                                        }}>
                                            NEW
                                        </span>
                                    </div>
                                )}
                                <div
                                    data-message-id={msg.apiId}
                                    className={`message${isGrouped ? ' grouped message-grouped' : ' message-standalone'}${highlightedMsgId === msg.id ? ' highlighted-message' : ''}${showSearchBar && searchQuery.trim() && searchResults.some((r) => r.id === msg.apiId) ? ' search-result-message' : ''}`}
                                    style={{ margin: 0, marginTop: isGrouped ? '1px' : '12px', padding: isGrouped ? '1px 16px' : '4px 16px', display: 'flex', gap: '12px', position: 'relative' }}
                                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                                    onMouseLeave={() => { setHoveredMessageId(null); }}
                                    onDoubleClick={() => { if (msg.apiId && dmChannelId && !msg.system) { const alreadyHearted = (msg.reactions || []).some(r => r.emoji === '❤️' && r.me); handleReaction(msg.apiId, '❤️', alreadyHearted); } }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        const isOwnMessage = msg.authorId === userProfile?.id;
                                        openMenu(e, [
                                            { id: 'reply', label: 'Reply', icon: Reply, onClick: () => setReplyingTo({ id: msg.id, apiId: msg.apiId, author: msg.author, content: (msg.content || '').slice(0, 80) }) },
                                            { id: 'thread', label: 'Create Thread', icon: MessageSquare, onClick: () => setActiveThreadMessage(msg) },
                                            ...(isOwnMessage && msg.apiId ? [{ id: 'edit', label: 'Edit Message', icon: Pencil, onClick: () => setEditingMessage({ id: msg.id, apiId: msg.apiId!, content: msg.content || '' }) }] : []),
                                            { id: 'forward', label: 'Forward Message', icon: Share2, onClick: () => setForwardingMessage(msg) },
                                            ...(msg.apiId ? [{
                                                id: 'pin', label: msg.isPinned ? 'Unpin Message' : 'Pin Message', icon: Pin, onClick: () => {
                                                    if (!dmChannelId || !msg.apiId) return;
                                                    const action = msg.isPinned ? api.messages.unpin : api.messages.pin;
                                                    action(dmChannelId, msg.apiId).then(() => {
                                                        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isPinned: !m.isPinned } : m));
                                                        addToast({ title: msg.isPinned ? 'Message unpinned' : 'Message pinned', variant: 'success' });
                                                        if (showPinnedPanel) loadPinnedMessages();
                                                    }).catch(() => addToast({ title: 'Failed to pin message', variant: 'error' }));
                                                }
                                            }] : []),
                                            {
                                                id: 'copy', label: 'Copy Text', icon: Copy, onClick: () => {
                                                    if (msg.content) copyToClipboard(msg.content);
                                                    addToast({ title: 'Copied to clipboard', variant: 'info' });
                                                }
                                            },
                                            ...(msg.apiId ? [{
                                                id: 'copy-link', label: 'Copy Message Link', icon: Link2, onClick: () => {
                                                    const link = `${window.location.origin}/dm/${dmChannelId}?msg=${msg.apiId}`;
                                                    copyToClipboard(link);
                                                    addToast({ title: 'Message link copied', variant: 'info' });
                                                }
                                            }] : []),
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
                                            { divider: true, id: 'div1', label: '', onClick: () => { } },
                                            {
                                                id: 'delete', label: 'Delete Message', icon: Trash2, color: 'var(--error)', onClick: () => {
                                                    if (dmChannelId && msg.apiId) {
                                                        api.messages.delete(dmChannelId, msg.apiId).then(() => {
                                                            setMessages(prev => prev.filter(m => m.id !== msg.id));
                                                            addToast({ title: 'Message Deleted', variant: 'error' });
                                                        }).catch(() => addToast({ title: 'Failed to delete message', variant: 'error' }));
                                                    } else {
                                                        setMessages(prev => prev.filter(m => m.id !== msg.id));
                                                    }
                                                }
                                            }
                                        ]);
                                    }}
                                >
                                    {isGrouped ? (
                                        <div style={{ width: '40px', flexShrink: 0 }} />
                                    ) : (
                                        <Avatar
                                            userId={msg.authorId || String(msg.id)}
                                            displayName={msg.author}
                                            avatarHash={msg.authorAvatarHash}
                                            frame={isCurrentUserMessage ? currentFrame : 'none'}
                                            size={40}
                                            onClick={(e) => { if (!msg.system && msg.authorId) setProfilePopover({ user: msg.author, userId: msg.authorId, x: e.clientX, y: e.clientY }); }}
                                            style={{ cursor: msg.system ? 'default' : 'pointer' }}
                                        />
                                    )}
                                    <div className="msg-content">
                                        {!isGrouped && (
                                        <div className="msg-header">
                                            <span
                                                className={`msg-author ${msg.authorNameplateStyle && msg.authorNameplateStyle !== 'none' ? `nameplate-${msg.authorNameplateStyle}` : (isCurrentUserMessage && currentNameplate !== 'none' ? `nameplate-${currentNameplate}` : '')}`}
                                                onClick={(e) => { if (!msg.system && msg.authorId) setProfilePopover({ user: msg.author, userId: msg.authorId, x: e.clientX, y: e.clientY }); }}
                                                style={{ cursor: msg.system ? 'default' : 'pointer' }}
                                            >{msg.author}</span>
                                            <span className="msg-timestamp">{msg.time}</span>
                                        </div>
                                        )}
                                        {msg.replyToId && msg.replyToAuthor && (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                fontSize: '11px', marginBottom: '4px',
                                                paddingLeft: '8px', paddingRight: '8px',
                                                paddingTop: '3px', paddingBottom: '3px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderLeft: '2px solid var(--accent-primary)',
                                                borderRadius: '0 4px 4px 0',
                                                cursor: 'pointer',
                                                maxWidth: '100%', overflow: 'hidden',
                                            }} onClick={() => {
                                                const el = document.querySelector(`[data-message-id="${msg.replyToId}"]`);
                                                if (el) {
                                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                    const localMsg = messages.find(m => m.apiId === msg.replyToId);
                                                    if (localMsg) {
                                                        setHighlightedMsgId(localMsg.id);
                                                        setTimeout(() => setHighlightedMsgId(null), 2500);
                                                    }
                                                }
                                            }}>
                                                <Reply size={11} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                                <span style={{ fontWeight: 600, color: 'var(--accent-primary)', flexShrink: 0, fontSize: '11px' }}>
                                                    {msg.replyToAuthor}
                                                </span>
                                                <span style={{
                                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap', flex: 1, color: 'var(--text-muted)', fontSize: '11px',
                                                }}>
                                                    {msg.replyToContent || '— click to view'}
                                                </span>
                                            </div>
                                        )}
                                        <div className="msg-body">
                                            {msg.forwarded && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontStyle: 'italic' }}>
                                                    <Share2 size={12} />
                                                    <span>Forwarded{msg.forwardedFrom ? ` from ${msg.forwardedFrom}` : ''}</span>
                                                </div>
                                            )}
                                            {msg.type === 'media' && msg.mediaUrl ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {msg.content && (
                                                        <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                                                            <RichTextRenderer content={msg.content} members={dmMembersForMentions} />
                                                        </div>
                                                    )}
                                                    <div style={{
                                                        maxWidth: '400px',
                                                        aspectRatio: msg.mediaAspectRatio ? `${msg.mediaAspectRatio}` : '16/9',
                                                        borderRadius: '8px',
                                                        overflow: 'hidden',
                                                        border: '1px solid var(--stroke)',
                                                        cursor: 'pointer',
                                                        background: 'var(--bg-tertiary)'
                                                    }}>
                                                        <img src={msg.mediaUrl} alt="Media" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                                                    {msg.isEncrypted ? (
                                                        decryptedContents.has(msg.id) ? (
                                                            decryptedContents.get(msg.id) === '[Decryption failed]' ? (
                                                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Lock size={12} />
                                                                    Encrypted message
                                                                </span>
                                                            ) : (
                                                                <RichTextRenderer content={decryptedContents.get(msg.id)!} members={dmMembersForMentions} />
                                                            )
                                                        ) : (
                                                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                <Lock size={12} />
                                                                {e2eKey ? 'Decrypting...' : 'Encrypted message'}
                                                            </span>
                                                        )
                                                    ) : (
                                                        <RichTextRenderer content={msg.content} members={dmMembersForMentions} />
                                                    )}
                                                    {msg.edited && msg.apiId && dmChannelId && <EditHistoryPopover channelId={dmChannelId} messageApiId={msg.apiId} />}
                                                    {/* Expiry countdown (A2) */}
                                                    {msg.expiresAt && (() => {
                                                        const remaining = new Date(msg.expiresAt).getTime() - Date.now();
                                                        if (remaining <= 0) return null;
                                                        const secs = Math.floor(remaining / 1000);
                                                        const label = secs < 60 ? `${secs}s` : secs < 3600 ? `${Math.floor(secs / 60)}m` : secs < 86400 ? `${Math.floor(secs / 3600)}h` : `${Math.floor(secs / 86400)}d`;
                                                        return <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Clock size={10} />Disappears in {label}</span>;
                                                    })()}
                                                    {/* Read receipt checkmarks (A1) — only on current user's last message */}
                                                    {isCurrentUserMessage && (() => {
                                                        const myMsgs = messages.filter(m => m.authorId === currentUserId);
                                                        if (myMsgs[myMsgs.length - 1]?.id !== msg.id) return null;
                                                        // Only check exact message ID — avoids false positives from lastReadAt timestamp comparison
                                                        const isRead = !!(partnerLastReadMessageId && partnerLastReadMessageId === msg.apiId);
                                                        return isRead
                                                            ? <CheckCheck size={12} style={{ marginLeft: '6px', color: 'var(--accent-primary)', verticalAlign: 'middle' }} aria-label="Read" />
                                                            : <Check size={12} style={{ marginLeft: '6px', color: 'var(--text-muted)', verticalAlign: 'middle' }} aria-label="Sent" />;
                                                    })()}
                                                </div>
                                            )}
                                            {/* Render file attachments */}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                                    {msg.attachments.map((att) => {
                                                        // Use decrypted file URL if available (E2E encrypted file)
                                                        const decFile = decryptedFileUrls.get(att.id);
                                                        const displayUrl = decFile?.url || att.url;
                                                        const displayName = decFile?.filename || att.filename;
                                                        const displayType = decFile?.mimeType || att.contentType || (att as any).mimeType;
                                                        // If encrypted but not yet decrypted, show loading state
                                                        if (msg.isEncrypted && !decFile && att.contentType === 'application/octet-stream') {
                                                            return (
                                                                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', maxWidth: '320px' }}>
                                                                    <Loader2 size={16} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                                                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Decrypting file...</span>
                                                                </div>
                                                            );
                                                        }
                                                        return displayType?.startsWith('image/') ? (
                                                            <div key={att.id} style={{ maxWidth: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)', cursor: 'pointer', background: 'var(--bg-tertiary)' }}>
                                                                <img src={displayUrl} alt={displayName} loading="lazy" decoding="async" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                                                            </div>
                                                        ) : (
                                                            <a key={att.id} href={displayUrl} download={displayName} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', textDecoration: 'none', color: 'var(--text-primary)', maxWidth: '320px' }}>
                                                                <FileIcon size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${(att.size / 1024).toFixed(1)} KB` : `${(att.size / 1048576).toFixed(1)} MB`}</div>
                                                                </div>
                                                                <Download size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {/* URL Embeds (link previews) */}
                                            {msg.embeds && msg.embeds.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                                    {msg.embeds.map((embed: any, i: number) => (
                                                        <LazyEmbed key={i} embed={embed as OgEmbed} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {/* Reaction badges */}
                                        {msg.reactions && msg.reactions.length > 0 && (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                                                {msg.reactions.map((r) => (
                                                    <ReactionBadge
                                                        key={r.emoji}
                                                        emoji={r.emoji}
                                                        count={r.count}
                                                        me={r.me}
                                                        messageApiId={msg.apiId}
                                                        channelId={dmChannelId}
                                                        onReaction={(apiId, emoji, me) => handleReaction(apiId, emoji, me)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        {/* Thread reply count */}
                                        {(msg.threadReplyCount ?? 0) > 0 && (
                                            <div
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px',
                                                    padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                                                    background: (msg.threadReplyCount ?? 0) >= 3 ? 'rgba(var(--accent-primary-rgb, 99,102,241), 0.08)' : 'transparent',
                                                }}
                                                onClick={() => setActiveThreadMessage(msg)}
                                                className="hover-thread-indicator"
                                            >
                                                <MessageSquare size={14} style={{ color: 'var(--accent-primary)' }} />
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                                    {(msg.threadReplyCount ?? 0) >= 3
                                                        ? `View ${msg.threadReplyCount} replies`
                                                        : `${msg.threadReplyCount} ${msg.threadReplyCount === 1 ? 'reply' : 'replies'}`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Quick Reaction Picker */}
                                    {reactionPickerMessageId === msg.id && (
                                        <div ref={reactionPickerRef} style={{ position: 'absolute', top: isGrouped ? '34px' : '38px', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '20px', padding: '4px 8px', display: 'flex', gap: '2px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 30 }}>
                                            {quickReactions.map(emoji => (
                                                <button key={emoji} onClick={() => handleReaction(msg.apiId, emoji, false)} className="hover-bg-tertiary" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px 6px', borderRadius: '8px', transition: 'all 0.15s' }}>
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {/* Hover actions */}
                                    {hoveredMessageId === msg.id && !msg.system && (
                                        <div style={{ position: 'absolute', top: isGrouped ? '2px' : '6px', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', padding: '4px', display: 'flex', gap: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 20 }}>
                                            <button onClick={() => setReactionPickerMessageId(reactionPickerMessageId === msg.id ? null : msg.id)} className="hover-bg-tertiary" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px' }} title="Add Reaction"><Smile size={16} /></button>
                                            <button onClick={() => setActiveThreadMessage(msg)} className="hover-bg-tertiary" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px' }} title="Create Thread"><MessageSquare size={16} /></button>
                                            <button onClick={() => { if (msg.content) copyToClipboard(msg.content); addToast({ title: 'Copied', variant: 'info' }); }} className="hover-bg-tertiary" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px' }} title="Copy Text"><Copy size={16} /></button>
                                        </div>
                                    )}
                                </div>
                                </React.Fragment>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Jump to bottom button */}
                        {showScrollButton && (
                            <button
                                onClick={() => {
                                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    setNewDmMsgCount(0);
                                    setShowScrollButton(false);
                                }}
                                style={{
                                    position: 'absolute',
                                    bottom: '80px',
                                    right: '24px',
                                    zIndex: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: newDmMsgCount > 0 ? '6px 12px 6px 10px' : '8px',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--stroke)',
                                    borderRadius: '20px',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                    transition: 'all 0.15s ease',
                                }}
                                title="Jump to bottom"
                            >
                                {newDmMsgCount > 0 && (
                                    <span style={{
                                        background: 'var(--accent-primary)',
                                        color: '#000',
                                        borderRadius: '10px',
                                        padding: '1px 7px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        lineHeight: '18px',
                                    }}>
                                        {newDmMsgCount > 99 ? '99+' : newDmMsgCount}
                                    </span>
                                )}
                                <ChevronDown size={16} />
                            </button>
                        )}

                        {/* Input Area */}
                        <div className="input-area" style={{ position: 'relative' }}>
                            {/* Scheduled messages list */}
                            {scheduledMessages.length > 0 && (
                                <div style={{ padding: '6px 16px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--stroke)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                        <Clock size={12} /> {scheduledMessages.length} scheduled
                                    </span>
                                    {scheduledMessages.map(sm => (
                                        <div key={sm.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', borderBottom: '1px solid var(--stroke)' }}>
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                &ldquo;{sm.content.slice(0, 60)}&rdquo; — {new Date(sm.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <button onClick={() => {
                                                fetch(`${API_BASE}/channels/${dmChannelId}/messages/scheduled/${sm.id}`, {
                                                    method: 'DELETE',
                                                    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
                                                }).then(() => setScheduledMessages(prev => prev.filter(m => m.id !== sm.id))).catch(() => {});
                                            }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Schedule message popover */}
                            {isScheduleOpen && (
                                <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', padding: '16px', width: '280px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Schedule Message</span>
                                        <button onClick={() => setIsScheduleOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Date</label>
                                            <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', padding: '8px', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Time</label>
                                            <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', padding: '8px', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                                        </div>
                                    </div>
                                    <button className="auth-button" style={{ margin: '12px 0 0', padding: '8px 0', height: 'auto', fontSize: '13px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', width: '100%' }} onClick={() => {
                                        if (!dmChannelId || !scheduleDate || !scheduleTime) { addToast({ title: 'Pick a date and time', variant: 'error' }); return; }
                                        const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
                                        fetch(`${API_BASE}/channels/${dmChannelId}/messages`, {
                                            method: 'POST',
                                            headers: { Authorization: `Bearer ${getAccessToken() ?? ''}`, 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ content: inputValue || ' ', scheduledAt }),
                                        }).then(r => {
                                            if (r.ok) { r.json().then(sm => { setScheduledMessages(prev => [...prev, sm]); addToast({ title: 'Message scheduled', variant: 'success' }); }); }
                                            else { addToast({ title: 'Failed to schedule', variant: 'error' }); }
                                        }).catch(() => addToast({ title: 'Failed to schedule', variant: 'error' }));
                                        setIsScheduleOpen(false);
                                        setInputValue('');
                                        setHasDraft(false);
                                        setScheduleDate('');
                                        setScheduleTime('');
                                    }}>Schedule Send</button>
                                </div>
                            )}
                            {editingMessage && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', fontSize: '12px', color: 'var(--accent-primary)', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--stroke)' }}>
                                    <Pencil size={12} />
                                    <span>Editing message</span>
                                    <button onClick={() => { setEditingMessage(null); setInputValue(''); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>
                                        ESC to cancel
                                    </button>
                                </div>
                            )}
                            {typingUsers.size > 0 && (
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', paddingLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                            <input
                                id="dm-file-upload"
                                type="file"
                                ref={attachmentInputRef}
                                style={{ display: 'none' }}
                                multiple
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files) return;
                                    enqueueDmFiles(Array.from(files));
                                    e.target.value = '';
                                }}
                            />
                            {/* Hidden folder input for zip upload */}
                            <input
                                id="dm-folder-upload"
                                ref={dmFolderInputRef}
                                type="file"
                                // @ts-expect-error webkitdirectory is non-standard but widely supported
                                webkitdirectory=""
                                multiple
                                style={{ display: 'none' }}
                                onChange={async (e) => {
                                    const files = e.target.files;
                                    if (!files || files.length === 0) return;
                                    const MAX_ZIP_SIZE = 25 * 1024 * 1024;
                                    const totalSize = Array.from(files).reduce((acc, f) => acc + f.size, 0);
                                    if (totalSize > MAX_ZIP_SIZE) {
                                        addToast({ title: `Folder is too large (max 25 MB uncompressed)`, variant: 'error' });
                                        e.target.value = '';
                                        return;
                                    }
                                    const firstPath = (files[0] as File & { webkitRelativePath: string }).webkitRelativePath;
                                    const folderName = firstPath.split('/')[0] || 'folder';
                                    setDmAttachedFiles(prev => [...prev, {
                                        name: `${folderName}.zip`,
                                        size: 'Compressing…',
                                        file: null as unknown as File,
                                        previewUrl: undefined,
                                    }]);
                                    try {
                                        const zip = new JSZip();
                                        for (const file of Array.from(files)) {
                                            const relativePath = (file as File & { webkitRelativePath: string }).webkitRelativePath;
                                            zip.file(relativePath, file);
                                        }
                                        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
                                        if (blob.size > MAX_ZIP_SIZE) {
                                            addToast({ title: `Compressed zip is too large (max 25 MB)`, variant: 'error' });
                                            setDmAttachedFiles(prev => prev.filter(f => f.name !== `${folderName}.zip`));
                                            e.target.value = '';
                                            return;
                                        }
                                        const zipFile = new File([blob], `${folderName}.zip`, { type: 'application/zip' });
                                        const sizeStr = zipFile.size < 1048576 ? `${(zipFile.size / 1024).toFixed(1)} KB` : `${(zipFile.size / 1048576).toFixed(1)} MB`;
                                        setDmAttachedFiles(prev => prev.map(f =>
                                            f.name === `${folderName}.zip` && f.size === 'Compressing…'
                                                ? { name: zipFile.name, size: sizeStr, file: zipFile, previewUrl: undefined }
                                                : f
                                        ));
                                    } catch {
                                        addToast({ title: 'Failed to compress folder', variant: 'error' });
                                        setDmAttachedFiles(prev => prev.filter(f => !(f.name === `${folderName}.zip` && f.size === 'Compressing…')));
                                    }
                                    e.target.value = '';
                                }}
                            />
                            {isEmojiPickerOpen && (
                                <EmojiPicker
                                    onSelectEmoji={(emoji: string) => {
                                        setInputValue(prev => prev + emoji);
                                        setIsEmojiPickerOpen(false);
                                    }}
                                    onSendGif={handleSendGif}
                                />
                            )}
                            {/* Reply Preview Bar */}
                            {replyingTo && (
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
                                                        setHighlightedMsgId(localMsg.id);
                                                        setTimeout(() => setHighlightedMsgId(null), 2500);
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
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>Esc to cancel</span>
                                </div>
                            )}
                            {/* Attached file chips */}
                            {dmAttachedFiles.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 16px 8px' }}>
                                    {dmAttachedFiles.map((f, i) => {
                                        const pct = dmUploadProgress[f.name];
                                        const isUploading = pct !== undefined && pct >= 0 && pct < 100;
                                        const isError = pct === -1;
                                        return (
                                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '4px 10px', background: isError ? 'rgba(239,68,68,0.08)' : 'var(--bg-tertiary)', border: `1px solid ${isError ? 'rgba(239,68,68,0.3)' : 'var(--stroke)'}`, borderRadius: '10px', fontSize: '12px', color: 'var(--text-secondary)', minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {f.previewUrl && <img src={f.previewUrl} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} />}
                                                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{isError ? '✗ failed' : isUploading ? `${pct}%` : f.size}</span>
                                                <button onClick={() => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); setDmAttachedFiles(prev => prev.filter((_, idx) => idx !== i)); setDmUploadProgress(prev => { const n = {...prev}; delete n[f.name]; return n; }); }} aria-label={`Remove ${f.name}`} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                                    <X size={12} />
                                                </button>
                                            </div>
                                            {isUploading && (
                                                <div style={{ height: '3px', borderRadius: '2px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: '2px', background: 'var(--accent-primary)', width: `${pct}%`, transition: 'width 0.2s ease' }} />
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="chat-input-wrapper" style={{ position: 'relative' }}>
                                {/* Mention Autocomplete for Group DMs */}
                                {isGroupDm && mentionSearch !== null && filteredMentionUsers.length > 0 && (
                                    <div style={{
                                        position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                        borderRadius: 'var(--radius-md, 8px)', padding: '8px', minWidth: '300px',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '4px'
                                    }}>
                                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '4px 8px', marginBottom: '4px' }}>
                                            Members
                                        </div>
                                        {filteredMentionUsers.slice(0, 8).map((user, idx) => (
                                            <div
                                                key={user.id}
                                                onClick={() => insertDmMention(user.id)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                                                    borderRadius: '6px', cursor: 'pointer',
                                                    background: mentionIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                                    transition: 'background 0.1s'
                                                }}
                                                onMouseEnter={() => setMentionIndex(idx)}
                                            >
                                                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>@</span>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{user.displayName}</span>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{user.username}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                    {showDmUploadMenu && (
                                        <div
                                            style={{
                                                position: 'absolute', bottom: '40px', left: '0',
                                                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                                borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                                                overflow: 'hidden', zIndex: 100, minWidth: '200px',
                                            }}
                                            onMouseLeave={() => setShowDmUploadMenu(false)}
                                        >
                                            <label
                                                htmlFor="dm-file-upload"
                                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '14px', transition: 'background 0.1s' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                                                onClick={() => setShowDmUploadMenu(false)}
                                            >
                                                <Upload size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                                Upload File(s)
                                            </label>
                                            <label
                                                htmlFor="dm-folder-upload"
                                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '14px', transition: 'background 0.1s', borderTop: '1px solid var(--stroke)' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-overlay)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                                                onClick={() => setShowDmUploadMenu(false)}
                                            >
                                                <FolderArchive size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                                Upload Folder as Zip
                                            </label>
                                        </div>
                                    )}
                                    <button
                                        className="input-icon-btn"
                                        title="Upload Attachment"
                                        aria-label="Upload attachment"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setShowDmUploadMenu(v => !v)}
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                                {hasDraft && !editingMessage && (
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 15%, transparent)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Draft</span>
                                )}
                                <textarea
                                    className="chat-input"
                                    rows={1}
                                    placeholder={`Message @${userName}...`}
                                    value={inputValue}
                                    onChange={handleDmInputChange}
                                    onKeyDown={handleDmKeyDown}
                                    onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = '24px'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }}
                                    onPaste={(e) => {
                                        const items = e.clipboardData?.items;
                                        if (!items) return;
                                        for (const item of Array.from(items)) {
                                            if (item.type.startsWith('image/')) {
                                                e.preventDefault();
                                                const file = item.getAsFile();
                                                if (file) {
                                                    enqueueDmFiles([file]);
                                                }
                                                break;
                                            }
                                        }
                                    }}
                                />
                                {(() => { const wireLen = resolveDmWireContent(inputValue).length; return wireLen > 1800 ? (
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: wireLen > 2000 ? 'var(--error)' : 'var(--warning)', flexShrink: 0, padding: '0 4px' }}>
                                        {wireLen}/2000
                                    </span>
                                ) : null; })()}
                                <button className={`input-icon-btn ${isEmojiPickerOpen ? 'primary' : ''}`} title="Select Emoji" onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}>
                                    <Smile size={20} />
                                </button>
                                {!editingMessage && (
                                    <button className={`input-icon-btn ${isScheduleOpen ? 'primary' : ''}`} title="Schedule Message" onClick={() => setIsScheduleOpen(!isScheduleOpen)}>
                                        <Clock size={18} />
                                    </button>
                                )}
                                <button
                                    className={`input-icon-btn ${inputValue.trim().length > 0 ? 'primary' : ''}`}
                                    aria-label={rateLimitRemaining > 0 ? `Rate limited, wait ${rateLimitRemaining}s` : 'Send message'}
                                    onClick={editingMessage ? handleEditSubmit : handleSendMessage}
                                    disabled={isSendingMessage || rateLimitRemaining > 0 || (inputValue.trim().length === 0 && (!dmAttachedFiles || dmAttachedFiles.length === 0))}
                                    style={{ opacity: (isSendingMessage || rateLimitRemaining > 0) ? 0.5 : (inputValue.trim().length > 0 || (dmAttachedFiles && dmAttachedFiles.length > 0)) ? 1 : 0.5, cursor: (isSendingMessage || rateLimitRemaining > 0) ? 'not-allowed' : (inputValue.trim().length > 0 || (dmAttachedFiles && dmAttachedFiles.length > 0)) ? 'pointer' : 'default' }}
                                >
                                    {isSendingMessage ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : rateLimitRemaining > 0 ? <span style={{ fontSize: '12px', fontWeight: 700 }}>{rateLimitRemaining}s</span> : editingMessage ? <Check size={18} /> : <Send size={18} />}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Group DM Member Panel */}
            {isGroupDm && (
                <aside aria-label="Group members" style={{
                    width: memberPanelOpen ? '260px' : '0px',
                    background: 'var(--bg-elevated)',
                    borderLeft: memberPanelOpen ? '1px solid var(--stroke)' : 'none',
                    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 2,
                }}>
                    <div style={{ width: '260px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Members — {groupParticipants.length}</h3>
                            {groupOwnerId === userProfile?.id && (
                                <UserPlus size={18} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} aria-label="Add Member" onClick={() => setShowAddMember(!showAddMember)} />
                            )}
                        </div>

                        {showAddMember && groupOwnerId === userProfile?.id && (
                            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--stroke)' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        placeholder="User ID..."
                                        value={addMemberInput}
                                        onChange={(e) => setAddMemberInput(e.target.value)}
                                        style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                    />
                                    <button
                                        onClick={async () => {
                                            if (!addMemberInput.trim()) return;
                                            try {
                                                const result = await api.groupDms.addMember(dmChannelId, addMemberInput.trim());
                                                setGroupParticipants(result.members);
                                                setAddMemberInput('');
                                                setShowAddMember(false);
                                                addToast({ title: 'Member added', variant: 'success' });
                                            } catch (err: any) {
                                                addToast({ title: 'Failed to add member', description: err?.message, variant: 'error' });
                                            }
                                        }}
                                        style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--accent-primary)', border: 'none', color: 'var(--bg-app)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {groupParticipants.map((p) => (
                                <div key={p.id} className="hover-bg-tertiary" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '8px' }}>
                                    <Avatar userId={p.id} avatarHash={p.avatarHash} displayName={p.displayName || p.username} size={32} />
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {p.displayName || p.username}
                                            {p.id === groupOwnerId && <span style={{ fontSize: '10px', color: 'var(--accent-primary)', fontWeight: 700 }}>OWNER</span>}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.username}</div>
                                    </div>
                                    {groupOwnerId === userProfile?.id && p.id !== userProfile?.id && (
                                        <UserMinus
                                            size={16}
                                            style={{ cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0 }}
                                            aria-label="Remove member"
                                            onClick={async () => {
                                                try {
                                                    await api.groupDms.removeMember(dmChannelId, p.id);
                                                    setGroupParticipants((prev) => prev.filter((m) => m.id !== p.id));
                                                    addToast({ title: 'Member removed', variant: 'success' });
                                                } catch (err: any) {
                                                    addToast({ title: 'Failed to remove member', description: err?.message, variant: 'error' });
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--stroke)' }}>
                            <button
                                onClick={async () => {
                                    if (!userProfile?.id) return;
                                    try {
                                        await api.groupDms.removeMember(dmChannelId, userProfile.id);
                                        addToast({ title: 'Left group DM', variant: 'success' });
                                        navigate('/');
                                    } catch (err: any) {
                                        addToast({ title: 'Failed to leave group', description: err?.message, variant: 'error' });
                                    }
                                }}
                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.1)', color: 'var(--error)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                                <LogOut size={14} /> Leave Group
                            </button>
                        </div>
                    </div>
                </aside>
            )}

            {/* Pinned Messages Panel */}
            <aside aria-label="Pinned messages" style={{
                width: showPinnedPanel ? '300px' : '0px',
                background: 'var(--bg-elevated)',
                borderLeft: showPinnedPanel ? '1px solid var(--stroke)' : 'none',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 2,
            }}>
                <div style={{ width: '300px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Pin size={16} style={{ color: 'var(--accent-primary)' }} />
                            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Pinned Messages</h3>
                        </div>
                        <button onClick={() => setShowPinnedPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }} aria-label="Close pinned panel"><X size={16} /></button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                        {pinnedMessages.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                                <Pin size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
                                <p style={{ fontSize: '13px', margin: 0 }}>No pinned messages yet</p>
                                <p style={{ fontSize: '12px', margin: '4px 0 0', color: 'var(--text-muted)' }}>Right-click a message to pin it</p>
                            </div>
                        ) : pinnedMessages.map(msg => (
                            <div key={msg.apiId ?? msg.id} style={{ padding: '10px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{msg.author}</span>
                                    <button
                                        onClick={() => {
                                            if (!dmChannelId || !msg.apiId) return;
                                            api.messages.unpin(dmChannelId, msg.apiId).then(() => {
                                                setPinnedMessages(prev => prev.filter(m => m.apiId !== msg.apiId));
                                                addToast({ title: 'Message unpinned', variant: 'success' });
                                            }).catch(() => addToast({ title: 'Failed to unpin', variant: 'error' }));
                                        }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                                        aria-label="Unpin message"
                                    ><X size={12} /></button>
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>{msg.time}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            {/* Sliding Info Panel */}
            <aside aria-label="User info" style={{
                ...(isMobile && infoPanelOpen ? {
                    position: 'fixed' as const, top: 0, right: 0, bottom: 0,
                    width: '100%', height: '100%', zIndex: 500,
                    background: 'var(--bg-primary)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column' as const,
                } : {
                    width: infoPanelOpen ? '320px' : '0px',
                    background: 'var(--bg-elevated)',
                    borderLeft: infoPanelOpen ? '1px solid var(--stroke)' : 'none',
                    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap' as const,
                    display: 'flex',
                    flexDirection: 'column' as const,
                    zIndex: 2,
                })
            }}>
                {isMobile && infoPanelOpen && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '12px 16px', borderBottom: '1px solid var(--stroke)', flexShrink: 0 }}>
                        <button onClick={() => setInfoPanelOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}>
                            <X size={24} />
                        </button>
                    </div>
                )}
                <div style={{ width: isMobile ? '100%' : '320px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Banner */}
                    <div style={{
                        height: '120px',
                        background: profileData?.bannerHash
                            ? `url(${API_BASE}/files/${profileData.bannerHash}) center/cover`
                            : 'var(--bg-tertiary)',
                        flexShrink: 0
                    }}></div>
                    <div style={{ padding: '0 16px', marginTop: '-36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                        <Avatar
                            userId={recipientId || dmChannelId || ''}
                            avatarHash={recipientAvatarHash}
                            displayName={userName || 'Unknown'}
                            size={72}
                            style={{ border: '6px solid var(--bg-elevated)' }}
                        />
                    </div>
                    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', whiteSpace: 'normal' }}>
                        {/* Name + Handle */}
                        <div>
                            <h2 style={{ fontSize: '1.2rem', margin: '0 0 2px 0' }}>{profileData?.displayName || userName}</h2>
                            {profileData?.username && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>@{profileData.username}</p>
                            )}
                            {profileData?.pronouns && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{profileData.pronouns}</p>
                            )}
                        </div>

                        {/* Badges */}
                        {profileData?.badges && profileData.badges.length > 0 && (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {profileData.badges.map(badge => {
                                    const meta: Record<string, { label: string; emoji: string; color: string }> = {
                                        admin: { label: 'Admin', emoji: '🛡️', color: '#ed4245' },
                                        early_adopter: { label: 'Early Adopter', emoji: '⭐', color: '#faa61a' },
                                        verified: { label: 'Verified', emoji: '✅', color: '#3ba55c' },
                                        developer: { label: 'Developer', emoji: '🔧', color: '#5865f2' },
                                        moderator: { label: 'Moderator', emoji: '🔨', color: '#eb459e' },
                                        supporter: { label: 'Supporter', emoji: '💎', color: '#5865f2' },
                                    };
                                    const m = meta[badge];
                                    if (!m) return null;
                                    return (
                                        <span key={badge} title={m.label} style={{ fontSize: '14px', cursor: 'default', color: m.color }}>{m.emoji}</span>
                                    );
                                })}
                            </div>
                        )}

                        {/* Custom Status */}
                        {profileData?.customStatus && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                                {profileData.statusEmoji && <span style={{ marginRight: '4px' }}>{profileData.statusEmoji}</span>}
                                {profileData.customStatus}
                            </p>
                        )}

                        {/* Bio */}
                        {profileData?.bio && (
                            <div>
                                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>About Me</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{profileData.bio}</p>
                            </div>
                        )}

                        {/* Fame */}
                        {fameStats && fameStats.fameReceived > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: '6px', width: 'fit-content' }}>
                                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>{fameStats.fameReceived} FAME</span>
                            </div>
                        )}

                        {/* Member Since */}
                        <div>
                            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>Gratonite Member Since</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>
                                {profileData?.createdAt
                                    ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                                    : '—'}
                            </p>
                        </div>

                        {/* Mutual Servers */}
                        {mutualData?.mutualServers && mutualData.mutualServers.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                                    Mutual Servers — {mutualData.mutualServers.length}
                                </h3>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {mutualData.mutualServers.slice(0, 8).map(server => (
                                        <div key={server.id} title={server.name} style={{
                                            width: '32px', height: '32px', borderRadius: '8px',
                                            background: server.iconHash
                                                ? `url(${API_BASE}/files/${server.iconHash}) center/cover`
                                                : 'var(--bg-tertiary)',
                                            border: '1px solid var(--stroke)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)',
                                            overflow: 'hidden'
                                        }}>
                                            {!server.iconHash && server.name.charAt(0).toUpperCase()}
                                        </div>
                                    ))}
                                    {mutualData.mutualServers.length > 8 && (
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                                            +{mutualData.mutualServers.length - 8}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Mutual Friends */}
                        {mutualData?.mutualFriends && mutualData.mutualFriends.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                                    Mutual Friends — {mutualData.mutualFriends.length}
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {mutualData.mutualFriends.slice(0, 8).map(friend => (
                                        <div key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Avatar
                                                userId={friend.id}
                                                avatarHash={friend.avatarHash}
                                                displayName={friend.displayName || friend.username}
                                                size={24}
                                            />
                                            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{friend.displayName || friend.username}</span>
                                        </div>
                                    ))}
                                    {mutualData.mutualFriends.length > 8 && (
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>and {mutualData.mutualFriends.length - 8} more...</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Forward Modal */}
            {forwardingMessage && (
                <ForwardModal
                    message={{ author: forwardingMessage.author, content: forwardingMessage.content, mediaUrl: forwardingMessage.mediaUrl }}
                    onClose={() => setForwardingMessage(null)}
                    onForward={(destinations, _note) => {
                        addToast({ title: 'Message Forwarded', description: `Sent to ${destinations.length} destination${destinations.length > 1 ? 's' : ''}`, variant: 'success' });
                        setForwardingMessage(null);
                    }}
                />
            )}

            {/* User Profile Popover */}
            {profilePopover && (
                <UserProfilePopover
                    user={{
                        id: profilePopover.userId,
                        name: profilePopover.user,
                        handle: profilePopover.user.toLowerCase().replace(/\s+/g, '_'),
                        status: 'online',
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

            {/* Thread Panel */}
            {activeThreadMessage && dmChannelId && (
                <ThreadPanel
                    originalMessage={activeThreadMessage}
                    channelId={dmChannelId}
                    onClose={() => setActiveThreadMessage(null)}
                />
            )}

            {/* Spin animation */}
            <style>
                {`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}
            </style>
        </main>
    );
};

export default DirectMessage;
