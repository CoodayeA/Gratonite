import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Smile, Send, Phone, Video, Info, Image as ImageIcon, X, PhoneOff, MicOff, Mic, VideoOff, Settings, MonitorUp, Headphones, HeadphoneOff, Volume2, Loader2, Share2, Reply, Copy, Trash2, Download, FileIcon, ChevronDown, Check, CheckCheck, Users, UserPlus, UserMinus, Pencil, LogOut, Clock } from 'lucide-react';

import { BackgroundMedia } from '../../components/ui/BackgroundMedia';
import { useToast } from '../../components/ui/ToastManager';
import { useContextMenu } from '../../components/ui/ContextMenu';
import EmojiPicker from '../../components/chat/EmojiPicker';
import ForwardModal from '../../components/modals/ForwardModal';
import { RichTextRenderer } from '../../components/chat/RichTextRenderer';
import { SkeletonMessageList } from '../../components/ui/SkeletonLoader';
import { ErrorState } from '../../components/ui/ErrorState';
import { api, ApiRequestError } from '../../lib/api';
import { getSocket, joinChannel as socketJoinChannel, leaveChannel as socketLeaveChannel } from '../../lib/socket';
import { onTypingStart, onMessageCreate, onMessageUpdate, onMessageDelete, onReactionAdd, onReactionRemove, onMessageRead, type TypingStartPayload, type MessageCreatePayload, type MessageUpdatePayload, type MessageDeletePayload, type ReactionPayload, type MessageReadPayload } from '../../lib/socket';
import { getDeterministicGradient } from '../../utils/colors';
import { useLiveKit, type LiveKitParticipant } from '../../lib/useLiveKit';
import Avatar from '../../components/ui/Avatar';

type MediaType = 'image' | 'video';

type OutletContextType = {
    bgMedia: { url: string, type: MediaType } | null;
    hasCustomBg: boolean;
    setBgMedia: (media: { url: string, type: MediaType } | null) => void;
    setActiveModal?: (modal: 'settings' | 'userProfile' | 'createGuild' | 'screenShare' | null) => void;
    userProfile?: {
        id?: string;
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
    attachments?: MessageAttachment[];
    authorAvatarHash?: string | null;
    authorNameplateStyle?: string | null;
    expiresAt?: string | null;
    createdAt?: string | null;
};

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

const DirectMessage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { bgMedia, hasCustomBg, setBgMedia, userProfile } = useOutletContext<OutletContextType>();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const bgInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const [dmAttachedFiles, setDmAttachedFiles] = useState<{file: File, name: string, size: string, previewUrl?: string}[]>([]);
    const [infoPanelOpen, setInfoPanelOpen] = useState(false);
    const { addToast } = useToast();
    const { openMenu } = useContextMenu();

    // Emoji picker state
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

    // Group DM state
    const [isGroupDm, setIsGroupDm] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [groupOwnerId, setGroupOwnerId] = useState<string | null>(null);
    const [groupParticipants, setGroupParticipants] = useState<Array<{ id: string; username: string; displayName: string; avatarHash: string | null; status: string }>>([]);
    const [memberPanelOpen, setMemberPanelOpen] = useState(false);
    const [isEditingGroupName, setIsEditingGroupName] = useState(false);
    const [editGroupNameValue, setEditGroupNameValue] = useState('');
    const [addMemberInput, setAddMemberInput] = useState('');
    const [showAddMember, setShowAddMember] = useState(false);

    const normalizeChannelType = useCallback((type: string | null | undefined) => {
        return String(type ?? '').trim().toUpperCase().replace(/-/g, '_');
    }, []);

    const [dmChannelId, setDmChannelId] = useState<string>('');
    const [isResolvingDmChannel, setIsResolvingDmChannel] = useState(false);

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

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!id) {
                setDmChannelId('');
                setIsResolvingDmChannel(false);
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
            } finally {
                if (!cancelled) setIsResolvingDmChannel(false);
            }
        };

        run();
        return () => { cancelled = true; };
    }, [id, navigate, resolveDmChannelId, searchParams, addToast]);

    // Forward modal state
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

    // Reaction state
    const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
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

    const classifyCallError = useCallback((error: unknown) => {
        if (error instanceof ApiRequestError) {
            if (error.status === 403) {
                return {
                    title: 'Call permission denied',
                    description: 'You cannot join this call from your current account. Check channel permissions and try again.',
                };
            }
            if (error.status === 404) {
                return {
                    title: 'Call target unavailable',
                    description: 'The call channel could not be found. Re-open the DM and retry.',
                };
            }
            if (error.status === 400) {
                return {
                    title: 'Invalid call target',
                    description: 'This target is not a voice-capable channel. Re-open the DM and try again.',
                };
            }
            if (error.status === 503) {
                return {
                    title: 'Voice service unavailable',
                    description: 'The voice service is currently unavailable. Retry in a few moments.',
                };
            }
        }

        const raw = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
        if (raw.includes('timed out') || raw.includes('timeout')) {
            return {
                title: 'Call timed out',
                description: 'Could not connect before timeout. Check network connectivity and retry.',
            };
        }
        if (raw.includes('permission') || raw.includes('forbidden')) {
            return {
                title: 'Call permission denied',
                description: 'You do not have permission for this call. Verify access and retry.',
            };
        }
        if (raw.includes('not found')) {
            return {
                title: 'Call target unavailable',
                description: 'This call target was not found. Re-open the DM and retry.',
            };
        }
        if (raw.includes('unavailable') || raw.includes('not configured')) {
            return {
                title: 'Voice service unavailable',
                description: 'Voice service is unavailable right now. Retry in a few moments.',
            };
        }

        return {
            title: 'Call failed',
            description: 'Could not connect to the call. Please retry.',
        };
    }, []);

    const lastCallErrorRef = useRef<string | null>(null);
    const showCallErrorToast = useCallback((error: unknown) => {
        const details = classifyCallError(error);
        if (lastCallErrorRef.current === details.description) return;
        lastCallErrorRef.current = details.description;
        addToast({ title: details.title, description: details.description, variant: 'error' });
    }, [classifyCallError, addToast]);

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

    // Disappearing messages timer state (A2)
    const [disappearTimer, setDisappearTimer] = useState<number | null>(null);
    const [showDisappearMenu, setShowDisappearMenu] = useState(false);
    const disappearMenuRef = useRef<HTMLDivElement>(null);

    // Typing indicator state
    const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
    const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const lastTypingSentRef = useRef(0);

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
    const [userStatus] = useState('');
    const userGame: string | null = null;
    const [userColor, setUserColor] = useState('linear-gradient(135deg, var(--accent-blue), var(--accent-purple))');
    const bannerColor = 'var(--bg-tertiary)';
    const [initial, setInitial] = useState('?');
    const [recipientId, setRecipientId] = useState<string>('');
    const [recipientAvatarHash, setRecipientAvatarHash] = useState<string | null>(null);

    useEffect(() => {
        if (!dmChannelId) return;
        api.channels.get(dmChannelId).then(async (ch: any) => {
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

    // Fetch messages from API
    const userCacheRef = useRef<Map<string, { username: string; displayName: string }>>(new Map());
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [messagesError, setMessagesError] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const oldestMessageIdRef = useRef<string | null>(null);
    const messageListRef = useRef<HTMLDivElement>(null);

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
        setIsLoadingMessages(true);
        setMessagesError(false);
        setHasMoreMessages(true);
        oldestMessageIdRef.current = null;
        try {
            const apiMessages = await api.messages.list(dmChannelId, { limit: 50 });
            const authorIds = [...new Set(apiMessages.map((m: any) => m.authorId))];
            await resolveAuthors(authorIds);
            // API returns newest-first; reverse so oldest is at index 0 (top of chat)
            const converted = apiMessages.map(convertApiMessage).reverse();
            setMessages(converted);
            if (apiMessages.length > 0) {
                // Last element in API response (newest-first) is the oldest
                oldestMessageIdRef.current = apiMessages[apiMessages.length - 1].id;
            }
            if (apiMessages.length < 50) {
                setHasMoreMessages(false);
            }
        } catch {
            setMessagesError(true);
        } finally {
            setIsLoadingMessages(false);
        }
    }, [dmChannelId]);

    useEffect(() => { fetchDmMessages(); }, [fetchDmMessages]);

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

    // Scroll-based pagination trigger
    useEffect(() => {
        const el = messageListRef.current;
        if (!el) return;
        const handleScroll = () => {
            if (el.scrollTop < 200 && hasMoreMessages && !isLoadingOlder) {
                loadOlderMessages();
            }
        };
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [hasMoreMessages, isLoadingOlder, loadOlderMessages]);

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
            if (data.authorId === currentUserId) return;
            const authorName = data.author?.displayName || data.author?.username || data.authorId.slice(0, 8);
            setMessages(prev => [...prev, {
                id: typeof data.id === 'string' ? parseInt(data.id, 36) || Date.now() : Number(data.id),
                apiId: data.id,
                authorId: data.authorId,
                author: authorName,
                system: false,
                avatar: authorName.charAt(0).toUpperCase(),
                authorAvatarHash: (data as any).author?.avatarHash ?? null,
                authorNameplateStyle: (data as any).author?.nameplateStyle ?? null,
                time: new Date(data.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: data.content || '',
                edited: data.edited,
                expiresAt: (data as any).expiresAt ?? null,
                createdAt: data.createdAt ?? null,
            }]);
            // Auto-mark read when message arrives and window is focused/visible
            if (!document.hidden && document.hasFocus()) {
                api.messages.markRead(dmChannelId, data.id).catch(() => {});
            }
        }));

        unsubs.push(onMessageUpdate((data: MessageUpdatePayload) => {
            if (data.channelId !== dmChannelId) return;
            setMessages(prev => prev.map(m =>
                m.apiId === data.id ? { ...m, content: data.content || m.content, edited: true } : m
            ));
        }));

        unsubs.push(onMessageDelete((data: MessageDeletePayload) => {
            if (data.channelId !== dmChannelId) return;
            setMessages(prev => prev.filter(m => m.apiId !== data.id));
        }));

        unsubs.push(onReactionAdd((payload: any) => {
            if (payload.channelId !== dmChannelId) return;
            setMessages(prev => prev.map(m => {
                if (m.apiId !== payload.messageId) return m;
                const reactions = [...(m.reactions || [])];
                const idx = reactions.findIndex(r => r.emoji === payload.emoji);
                if (idx >= 0) {
                    reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, me: payload.userId === currentUserId ? true : reactions[idx].me };
                } else {
                    reactions.push({ emoji: payload.emoji, count: 1, me: payload.userId === currentUserId });
                }
                return { ...m, reactions };
            }));
        }));

        unsubs.push(onReactionRemove((payload: any) => {
            if (payload.channelId !== dmChannelId) return;
            setMessages(prev => prev.map(m => {
                if (m.apiId !== payload.messageId) return m;
                const reactions = [...(m.reactions || [])];
                const idx = reactions.findIndex(r => r.emoji === payload.emoji);
                if (idx >= 0) {
                    reactions[idx] = { ...reactions[idx], count: reactions[idx].count - 1, me: payload.userId === currentUserId ? false : reactions[idx].me };
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

        return () => { unsubs.forEach(fn => fn()); };
    }, [dmChannelId, currentUserId]);

    // Mark channel as read when focused/opened (A1)
    const markAsRead = useCallback(() => {
        if (!dmChannelId) return;
        api.messages.markRead(dmChannelId).catch(() => { /* non-fatal */ });
    }, [dmChannelId]);

    useEffect(() => {
        markAsRead();
    }, [markAsRead]);

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
        // Fetch read state for partner read receipt
        api.messages.getReadState(dmChannelId).then((states: any[]) => {
            const partner = states.find((s: any) => s.userId !== currentUserId);
            if (partner) {
                setPartnerLastReadAt(partner.lastReadAt);
                setPartnerLastReadMessageId(partner.lastReadMessageId);
            }
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

    useEffect(() => {
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

    const handleToggleCamera = useCallback(async () => {
        try {
            await toggleCamera();
            addToast({ title: isCameraOn ? 'Camera Disabled' : 'Camera Enabled', variant: 'info' });
        } catch (err) {
            const description = err instanceof Error ? err.message : 'Could not toggle camera.';
            addToast({ title: 'Camera Error', description, variant: 'error' });
        }
    }, [toggleCamera, isCameraOn, addToast]);

    // Start call
    const handleStartCall = async (withVideo: boolean = false) => {
        if (isResolvingDmChannel || !dmChannelId) {
            addToast({ title: 'Call unavailable', description: 'Still resolving this DM channel. Please retry in a moment.', variant: 'error' });
            return;
        }
        setStartWithVideo(withVideo);
        try {
            await connect();
            lastCallErrorRef.current = null;
            addToast({ title: 'Call Started', description: `Starting ${withVideo ? 'video' : 'voice'} call with ${userName}...`, variant: 'info' });
        } catch (err) {
            showCallErrorToast(err);
        }
    };

    // Auto-start call when navigated with ?call=voice or ?call=video
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

    // Reset auto-call flag when channel changes
    useEffect(() => {
        autoCallHandled.current = false;
    }, [dmChannelId]);

    // End call
    const handleEndCall = async () => {
        await disconnect();
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
        if (participants.length > 0) {
            setParticipantVolume(participants[0].id, volume);
        }
    };

    // Paste image support
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        setDmAttachedFiles(prev => [...prev, {
                            file,
                            name: `pasted-image-${Date.now()}.png`,
                            size: file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`,
                            previewUrl: URL.createObjectURL(file)
                        }]);
                    }
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, []);

    const handleSendMessage = async () => {
        if (inputValue.trim() === '' && dmAttachedFiles.length === 0) return;
        if (!dmChannelId) {
            addToast({ title: 'Message unavailable', description: 'Conversation is not ready yet. Please retry.', variant: 'error' });
            return;
        }

        // Upload files first
        const uploadedFiles: { id: string; url: string; filename: string; mimeType: string; size: number }[] = [];
        for (const f of dmAttachedFiles) {
            try {
                const result = await api.files.upload(f.file);
                uploadedFiles.push(result);
            } catch {
                addToast({ title: `Failed to upload ${f.name}`, variant: 'error' });
            }
        }

        const content = inputValue.trim();
        const attachmentIds = uploadedFiles.map(f => f.id);

        if (content || attachmentIds.length > 0) {
            const optimisticId = Date.now();
            // Build attachment metadata for the optimistic message
            const attachments: MessageAttachment[] = uploadedFiles.map(f => ({
                id: f.id, filename: f.filename, url: f.url, contentType: f.mimeType, size: f.size
            }));

            // If there are image attachments, show the first as inline media
            const firstImage = uploadedFiles.find(f => f.mimeType?.startsWith('image/'));

            setMessages(prev => [...prev, {
                id: optimisticId,
                author: currentUserName || 'You',
                system: false,
                avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content,
                attachments,
                ...(firstImage ? {
                    type: 'media' as const,
                    mediaUrl: firstImage.url,
                    mediaAspectRatio: 16 / 9
                } : {})
            }]);

            api.messages.send(dmChannelId, {
                content,
                attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined
            }).then((res: any) => {
                if (res?.id) {
                    setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, apiId: res.id, authorId: res.authorId } : m));
                }
            }).catch(() => {
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
                addToast({ title: 'Failed to send message', variant: 'error' });
            });
        }

        // Cleanup preview URLs
        dmAttachedFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
        setInputValue('');
        setDmAttachedFiles([]);
    };

    const handleSendGif = (url: string, _previewUrl: string) => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            author: currentUserName || 'You',
            system: false,
            avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: '',
            type: 'media' as const,
            mediaUrl: url,
            mediaAspectRatio: 16 / 9
        }]);
        setIsEmojiPickerOpen(false);
    };

    // Get the other participant for display
    const otherParticipant = participants[0];
    const localDisplayTrack = localParticipant?.screenTrack ?? localParticipant?.videoTrack;
    const remoteDisplayTrack = otherParticipant?.screenTrack ?? otherParticipant?.videoTrack;

    return (
        <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
            <BackgroundMedia media={bgMedia} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 1 }}>
                {/* Header */}
                <header className="top-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                                status="online"
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
                                    </>
                                )}
                                {isConnected && (
                                    <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 500 }}>
                                        In Call
                                    </span>
                                )}
                            </h2>
                            <div style={{ fontSize: '0.75rem', color: userGame ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                                {isGroupDm ? `${groupParticipants.length} members` : (userGame ? <span style={{ fontWeight: 600 }}>{userGame}</span> : userStatus)}
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1 }}></div>

                    <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                        <input type="file" ref={bgInputRef} accept="image/*,video/mp4,video/webm,image/gif" onChange={handleUploadBg} style={{ display: 'none' }} />
                        <ImageIcon size={20} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => bgInputRef.current?.click()} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'} />
                        {hasCustomBg && <X size={18} style={{ cursor: 'pointer', color: 'var(--error)', transition: 'opacity 0.2s' }} onClick={() => setBgMedia(null)} />}

                        {!isConnected && !isConnecting && (
                            <>
                                <Phone size={20} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => handleStartCall(false)} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'} />
                                <Video size={20} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => handleStartCall(true)} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'} />
                            </>
                        )}
                        {isConnecting && (
                            <Loader2 size={20} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                        )}

                        {isGroupDm && (
                            <Users size={20} style={{ cursor: 'pointer', transition: 'color 0.2s', color: memberPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }} onClick={() => setMemberPanelOpen(!memberPanelOpen)} onMouseOver={e => e.currentTarget.style.color = memberPanelOpen ? 'var(--accent-primary)' : 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = memberPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                        )}

                        {/* Disappear Timer (A2) */}
                        <div style={{ position: 'relative' }} ref={disappearMenuRef}>
                            <Clock
                                size={20}
                                style={{ cursor: 'pointer', transition: 'color 0.2s', color: disappearTimer ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                onClick={() => setShowDisappearMenu(v => !v)}
                                title={disappearTimer ? `Disappearing: ${disappearTimer >= 86400 ? `${disappearTimer / 86400}d` : disappearTimer >= 3600 ? `${disappearTimer / 3600}h` : `${disappearTimer / 60}m`}` : 'Disappearing Messages Off'}
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
                        <Info size={20} style={{ cursor: 'pointer', transition: 'color 0.2s', color: infoPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }} onClick={() => { setInfoPanelOpen(!infoPanelOpen); if (isGroupDm) setMemberPanelOpen(false); }} onMouseOver={e => e.currentTarget.style.color = infoPanelOpen ? 'var(--accent-primary)' : 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = infoPanelOpen ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                    </div>
                </header>

                {/* Call Area / Chat Area */}
                {isConnected || isConnecting ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
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
                                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60px', background: bannerColor, opacity: 0.2, filter: 'blur(20px)' }}></div>
                                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: userColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 600, color: 'white', zIndex: 2, boxShadow: otherParticipant?.isSpeaking ? '0 0 0 4px var(--bg-elevated), 0 0 0 8px var(--accent-primary)' : 'none', transition: 'box-shadow 0.2s' }}>{initial}</div>
                                        </>
                                    )}
                                    <div style={{ position: 'absolute', bottom: '16px', left: '16px', fontWeight: 600, zIndex: 2, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{userName || 'Waiting...'}</div>
                                    {!otherParticipant && (
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', zIndex: 3 }}>
                                            <p>Waiting for {userName} to join...</p>
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
                                    onClick={isScreenSharing ? stopScreenShare : startScreenShare}
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
                ) : (
                    <>
                        <div ref={messageListRef} className="message-area" style={{ overflowY: 'auto' }}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                const files = e.dataTransfer.files;
                                if (!files.length) return;
                                const newFiles = Array.from(files).map(f => ({
                                    file: f,
                                    name: f.name,
                                    size: f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`,
                                    previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
                                }));
                                setDmAttachedFiles(prev => [...prev, ...newFiles]);
                            }}
                        >
                            {isLoadingMessages ? (
                                <SkeletonMessageList count={5} />
                            ) : messagesError ? (
                                <ErrorState
                                    message="Failed to load messages"
                                    description="Could not load this conversation's messages."
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

                            {messages.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                    <p style={{ fontSize: '16px', fontWeight: 600 }}>No messages yet</p>
                                    <p style={{ fontSize: '13px' }}>Send a message to start the conversation</p>
                                </div>
                            )}
                            {messages.map((msg) => {
                                const isCurrentUserMessage =
                                    (Boolean(msg.authorId) && msg.authorId === currentUserId)
                                    || (!msg.authorId && msg.author === currentUserName);
                                const currentFrame = userProfile?.avatarFrame ?? 'none';
                                const currentNameplate = userProfile?.nameplateStyle ?? 'none';

                                return (
                                <div
                                    key={msg.id}
                                    className="message"
                                    style={{ margin: 0, padding: '4px 16px', display: 'flex', gap: '16px', position: 'relative' }}
                                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                                    onMouseLeave={() => { setHoveredMessageId(null); }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        openMenu(e, [
                                            { id: 'forward', label: 'Forward Message', icon: Share2, onClick: () => setForwardingMessage(msg) },
                                            {
                                                id: 'copy', label: 'Copy Text', icon: Copy, onClick: () => {
                                                    if (msg.content) navigator.clipboard.writeText(msg.content);
                                                    addToast({ title: 'Copied to clipboard', variant: 'info' });
                                                }
                                            },
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
                                    <Avatar
                                        userId={msg.authorId || String(msg.id)}
                                        displayName={msg.author}
                                        avatarHash={msg.authorAvatarHash}
                                        frame={isCurrentUserMessage ? currentFrame : 'none'}
                                        size={40}
                                    />
                                    <div className="msg-content">
                                        <div className="msg-header">
                                            <span className={`msg-author ${msg.authorNameplateStyle && msg.authorNameplateStyle !== 'none' ? `nameplate-${msg.authorNameplateStyle}` : (isCurrentUserMessage && currentNameplate !== 'none' ? `nameplate-${currentNameplate}` : '')}`}>{msg.author}</span>
                                            <span className="msg-timestamp">{msg.time}</span>
                                        </div>
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
                                                            <RichTextRenderer content={msg.content} />
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
                                                        <img src={msg.mediaUrl} alt="Media" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover' }} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                                                    <RichTextRenderer content={msg.content} />
                                                    {msg.edited && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>(edited)</span>}
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
                                                            ? <CheckCheck size={12} style={{ marginLeft: '6px', color: 'var(--accent-primary)', verticalAlign: 'middle' }} title="Read" />
                                                            : <Check size={12} style={{ marginLeft: '6px', color: 'var(--text-muted)', verticalAlign: 'middle' }} title="Sent" />;
                                                    })()}
                                                </div>
                                            )}
                                            {/* Render file attachments */}
                                            {msg.attachments && msg.attachments.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                                    {msg.attachments.map((att) => (
                                                        att.contentType?.startsWith('image/') ? (
                                                            <div key={att.id} style={{ maxWidth: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)', cursor: 'pointer', background: 'var(--bg-tertiary)' }}>
                                                                <img src={att.url} alt={att.filename} style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                                                            </div>
                                                        ) : (
                                                            <a key={att.id} href={att.url} download={att.filename} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', textDecoration: 'none', color: 'var(--text-primary)', maxWidth: '320px' }}>
                                                                <FileIcon size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${(att.size / 1024).toFixed(1)} KB` : `${(att.size / 1048576).toFixed(1)} MB`}</div>
                                                                </div>
                                                                <Download size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                            </a>
                                                        )
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {/* Reaction badges */}
                                        {msg.reactions && msg.reactions.length > 0 && (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                                                {msg.reactions.map((r) => (
                                                    <button key={r.emoji} onClick={() => handleReaction(msg.apiId, r.emoji, r.me)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: r.me ? 'rgba(var(--accent-primary-rgb, 139,92,246), 0.15)' : 'var(--bg-tertiary)', border: `1px solid ${r.me ? 'var(--accent-primary)' : 'var(--stroke)'}`, cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'all 0.15s' }}>
                                                        <span>{r.emoji}</span> <span style={{ fontSize: '11px', fontWeight: 600 }}>{r.count}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* Quick Reaction Picker */}
                                    {reactionPickerMessageId === msg.id && (
                                        <div ref={reactionPickerRef} style={{ position: 'absolute', top: '-44px', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '20px', padding: '4px 8px', display: 'flex', gap: '2px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 30 }}>
                                            {quickReactions.map(emoji => (
                                                <button key={emoji} onClick={() => handleReaction(msg.apiId, emoji, false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px 6px', borderRadius: '8px', transition: 'all 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {/* Hover actions */}
                                    {hoveredMessageId === msg.id && !msg.system && (
                                        <div style={{ position: 'absolute', top: '-12px', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', padding: '4px', display: 'flex', gap: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 10 }}>
                                            <button onClick={() => setReactionPickerMessageId(reactionPickerMessageId === msg.id ? null : msg.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><Smile size={16} /></button>
                                            <button onClick={() => { if (msg.content) navigator.clipboard.writeText(msg.content); addToast({ title: 'Copied', variant: 'info' }); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', borderRadius: '4px' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}><Copy size={16} /></button>
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="input-area" style={{ position: 'relative' }}>
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
                                        if (names.length <= 4) return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing...`;
                                        return `Multiple people are typing...`;
                                    })()}
                                </div>
                            )}
                            <input
                                type="file"
                                ref={attachmentInputRef}
                                style={{ display: 'none' }}
                                multiple
                                onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files) return;
                                    const newFiles = Array.from(files).map(f => ({
                                        file: f,
                                        name: f.name,
                                        size: f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`,
                                        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
                                    }));
                                    setDmAttachedFiles(prev => [...prev, ...newFiles]);
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
                            {/* Attached file chips */}
                            {dmAttachedFiles.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 16px 8px' }}>
                                    {dmAttachedFiles.map((f, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {f.previewUrl && <img src={f.previewUrl} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} />}
                                            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{f.size}</span>
                                            <button onClick={() => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); setDmAttachedFiles(prev => prev.filter((_, idx) => idx !== i)); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="chat-input-wrapper">
                                <button className="input-icon-btn" title="Upload Attachment" onClick={() => attachmentInputRef.current?.click()}>
                                    <Plus size={20} />
                                </button>
                                <input
                                    type="text"
                                    className="chat-input"
                                    placeholder={`Message @${userName}...`}
                                    value={inputValue}
                                    onChange={(e) => { setInputValue(e.target.value); if (e.target.value.trim().length > 0) sendTypingIndicator(); }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                />
                                <button className={`input-icon-btn ${isEmojiPickerOpen ? 'primary' : ''}`} title="Select Emoji" onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}>
                                    <Smile size={20} />
                                </button>
                                <button
                                    className={`input-icon-btn ${inputValue.trim().length > 0 ? 'primary' : ''}`}
                                    onClick={handleSendMessage}
                                    disabled={inputValue.trim().length === 0 && (!dmAttachedFiles || dmAttachedFiles.length === 0)}
                                    style={{ opacity: (inputValue.trim().length > 0 || (dmAttachedFiles && dmAttachedFiles.length > 0)) ? 1 : 0.5, cursor: (inputValue.trim().length > 0 || (dmAttachedFiles && dmAttachedFiles.length > 0)) ? 'pointer' : 'default' }}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Group DM Member Panel */}
            {isGroupDm && (
                <aside style={{
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
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '8px' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
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

            {/* Sliding Info Panel */}
            <aside style={{
                width: infoPanelOpen ? '320px' : '0px',
                background: 'var(--bg-elevated)',
                borderLeft: infoPanelOpen ? '1px solid var(--stroke)' : 'none',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 2
            }}>
                <div style={{ width: '320px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '120px', background: bannerColor, flexShrink: 0 }}></div>
                    <div style={{ padding: '0 16px', marginTop: '-36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                        <Avatar
                            userId={recipientId || dmChannelId || ''}
                            avatarHash={recipientAvatarHash}
                            displayName={userName || 'Unknown'}
                            size={72}
                            style={{ border: '6px solid var(--bg-elevated)' }}
                        />
                    </div>
                    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', margin: '0 0 4px 0' }}>{userName}</h2>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{recipientId === 'kael' ? 'backend engineer & cyberpunk enthusiast.' : 'ux designer learning to code.'}</p>
                        </div>

                        {userGame && (
                            <div>
                                <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Playing a game</h3>
                                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ width: '48px', height: '48px', background: 'var(--accent-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎮</div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Cyberpunk 2077</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Night City</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>02:15:30 elapsed</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div>
                            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Gratonite Member Since</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>Sep 15, 2024</p>
                        </div>

                        <div>
                            <h3 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Mutual Servers</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(0,0,0,0.5))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A</div>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>D</div>
                            </div>
                        </div>
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
