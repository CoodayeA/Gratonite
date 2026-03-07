import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Settings, Users, Headphones, HeadphoneOff, Volume2, X, Loader2, MessageSquare, Send, Hash, Wifi, ChevronDown, Check, Radio, Hand, Crown, Compass } from 'lucide-react';
import { useOutletContext, useParams } from 'react-router-dom';
import { TopBarActions } from '../../components/ui/TopBarActions';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';
import { useLiveKit, LiveKitParticipant } from '../../lib/useLiveKit';
import { getDeterministicGradient } from '../../utils/colors';
import { getSocket, onStageStart, onStageEnd, onStageSpeakerAdd, onStageSpeakerRemove, onStageHandRaise, StageStartPayload, StageEndPayload, StageSpeakerAddPayload, StageSpeakerRemovePayload, StageHandRaisePayload } from '../../lib/socket';
import { leaveVoiceSession } from '../../lib/voiceSession';
import Avatar from '../../components/ui/Avatar';
import { useVoice } from '../../contexts/VoiceContext';
import { SpatialAudioEngine } from '../../lib/spatialAudio';
import { useSpatialPositions } from '../../hooks/useSpatialPositions';
import SpatialCanvas from '../../components/voice/SpatialCanvas';
import { Track } from 'livekit-client';

type OutletContextType = {
    hasCustomBg: boolean;
    setBgMedia: (media: { url: string, type: 'video' | 'image' } | null) => void;
    setActiveModal: (modal: 'settings' | 'userProfile' | 'createGuild' | 'screenShare' | null) => void;
    userProfile?: {
        id?: string;
        avatarFrame?: 'none' | 'neon' | 'gold' | 'glass';
        nameplateStyle?: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch';
    };
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

const VoiceChannel = () => {
    const { hasCustomBg, userProfile } = useOutletContext<OutletContextType>();
    const { channelId, guildId } = useParams<{ channelId: string; guildId: string }>();
    const { addToast } = useToast();
    const voiceCtx = useVoice();

    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
    const [showVolumePanel, setShowVolumePanel] = useState(false);
    const [openDeviceMenu, setOpenDeviceMenu] = useState<'audio' | 'video' | null>(null);
    const [masterVolume, setMasterVolume] = useState(100);
    const [userVolumes, setUserVolumes] = useState<Record<string, number>>({});
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; participantId: string } | null>(null);
    const volumePanelRef = useRef<HTMLDivElement>(null);
    const deviceMenuRef = useRef<HTMLDivElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [channelName, setChannelName] = useState('Voice');
    const [channelType, setChannelType] = useState<string>('GUILD_VOICE');
    const [linkedTextChannelId, setLinkedTextChannelId] = useState<string | null>(null);
    const [hasAutoConnected, setHasAutoConnected] = useState(false);

    // Stage channel state
    const [stageSession, setStageSession] = useState<{ id: string; hostId: string | null; topic: string | null; channelId: string } | null>(null);
    const [stageSpeakers, setStageSpeakers] = useState<Array<{ id: string; sessionId: string; userId: string; invitedBy: string | null }>>([]);
    const [raisedHands, setRaisedHands] = useState<string[]>([]);

    // Embedded text chat state
    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages, setChatMessages] = useState<Array<{ id: string; author: string; content: string; time: string }>>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatPreviewMessages, setChatPreviewMessages] = useState<Array<{ id: string; author: string; content: string }>>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [manuallyDisconnected, setManuallyDisconnected] = useState(false);

    // Spatial audio state
    const [spatialMode, setSpatialMode] = useState(() => localStorage.getItem('gratonite_spatial_mode') === 'true');
    const spatialEngineRef = useRef<SpatialAudioEngine | null>(null);

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
        roomRef,
    } = useLiveKit({
        channelId: channelId || '',
        onParticipantJoined: useCallback((participant: LiveKitParticipant) => {
            addToast({ title: 'User Joined', description: `${participant.name} joined the voice channel.`, variant: 'info' });
        }, [addToast]),
        onParticipantLeft: useCallback((_participantId: string) => {
            addToast({ title: 'User Left', description: 'A user left the voice channel.', variant: 'info' });
        }, [addToast]),
        onAudioTrackSubscribed: useCallback((participantId: string, track: MediaStreamTrack, detach: () => void) => {
            if (spatialEngineRef.current) {
                detach(); // Prevent LiveKit default <audio> playback — spatial engine handles it
                spatialEngineRef.current.addParticipant(participantId, track);
            }
        }, []),
        onAudioTrackUnsubscribed: useCallback((participantId: string) => {
            spatialEngineRef.current?.removeParticipant(participantId);
        }, []),
    });

    // Spatial position sync
    const { positions: spatialPositions, localPosition: spatialLocalPosition, updateLocalPosition: updateSpatialLocalPosition } = useSpatialPositions(
        channelId,
        localParticipant?.id,
        spatialMode && isConnected,
    );

    // Spatial mode toggle — attach/detach audio from engine
    const handleToggleSpatialMode = useCallback(() => {
        const next = !spatialMode;
        setSpatialMode(next);
        try { localStorage.setItem('gratonite_spatial_mode', String(next)); } catch { /* ignore */ }

        const room = roomRef.current;
        if (!room) return;

        if (next) {
            // Enable spatial: create engine, detach LiveKit default playback, feed tracks to engine
            const engine = new SpatialAudioEngine();
            spatialEngineRef.current = engine;

            room.remoteParticipants.forEach((participant) => {
                const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
                if (audioPublication?.track?.mediaStreamTrack) {
                    audioPublication.track.detach();
                    engine.addParticipant(participant.identity, audioPublication.track.mediaStreamTrack);
                }
            });
        } else {
            // Disable spatial: destroy engine, re-attach LiveKit default playback
            spatialEngineRef.current?.destroy();
            spatialEngineRef.current = null;

            room.remoteParticipants.forEach((participant) => {
                const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
                if (audioPublication?.track) {
                    audioPublication.track.attach();
                }
            });
        }
    }, [spatialMode, roomRef]);

    // Update spatial engine positions when they change
    useEffect(() => {
        const engine = spatialEngineRef.current;
        if (!engine || !spatialMode) return;

        // Update listener (local user) position
        engine.updateListenerPosition(spatialLocalPosition.x, spatialLocalPosition.y);

        // Update remote participant positions
        for (const [userId, pos] of spatialPositions) {
            engine.updatePosition(userId, pos.x, pos.y);
        }
    }, [spatialMode, spatialPositions, spatialLocalPosition]);

    // Cleanup spatial engine on unmount or disconnect
    useEffect(() => {
        if (!isConnected && spatialEngineRef.current) {
            spatialEngineRef.current.destroy();
            spatialEngineRef.current = null;
        }
    }, [isConnected]);

    useEffect(() => {
        return () => {
            spatialEngineRef.current?.destroy();
            spatialEngineRef.current = null;
        };
    }, []);

    // Fetch channel info
    useEffect(() => {
        if (!channelId) return;
        api.channels.get(channelId)
            .then((ch: any) => {
                setChannelName(ch.name || 'Voice');
                setChannelType(ch.type || 'GUILD_VOICE');
                setLinkedTextChannelId(ch.linkedTextChannelId ?? null);
            })
            .catch(() => { addToast({ title: 'Failed to load channel info', variant: 'error' }); });
    }, [channelId]);

    // Fetch active stage session for GUILD_STAGE channels
    useEffect(() => {
        if (!channelId || channelType !== 'GUILD_STAGE') return;
        api.stage.getSession(channelId).then((data) => {
            setStageSession(data.session ?? null);
            setStageSpeakers(data.speakers ?? []);
        }).catch(() => { /* non-fatal */ });
    }, [channelId, channelType]);

    // Load existing messages — use linked text channel if available, otherwise fall back to voice channel
    const chatChannelId = linkedTextChannelId ?? channelId;
    useEffect(() => {
        if (!chatChannelId) return;
        api.messages.list(chatChannelId, { limit: 50 }).then((msgs: any[]) => {
            setChatMessages(msgs.map(m => ({
                id: m.id,
                author: m.author?.displayName || m.author?.username || 'Unknown',
                content: m.content,
                time: new Date(m.createdAt || m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })).reverse());
        }).catch(() => { addToast({ title: 'Failed to load messages', variant: 'error' }); });
    }, [chatChannelId]);

    // Listen for new messages via WebSocket (on the chat channel: linked text or voice channel itself)
    useEffect(() => {
        if (!chatChannelId) return;
        const socket = getSocket();
        if (!socket) return;

        const handleMessage = (data: any) => {
            if (data.channelId !== chatChannelId) return;
            const newMsg = {
                id: data.id || String(Date.now()),
                author: data.author?.displayName || data.author?.username || 'Someone',
                content: data.content,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setChatMessages(prev => [...prev, newMsg]);

            // Show preview bubble if chat is closed
            if (!chatOpen) {
                setChatPreviewMessages(prev => {
                    const updated = [...prev, { id: newMsg.id, author: newMsg.author, content: newMsg.content }].slice(-3);
                    return updated;
                });
                if (chatPreviewTimerRef.current) clearTimeout(chatPreviewTimerRef.current);
                chatPreviewTimerRef.current = setTimeout(() => setChatPreviewMessages([]), 8000);
            }
        };

        socket.on('MESSAGE_CREATE', handleMessage);
        return () => { socket.off('MESSAGE_CREATE', handleMessage); };
    }, [chatChannelId, chatOpen]);

    // Scroll chat to bottom on new messages
    useEffect(() => {
        if (chatOpen && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages, chatOpen]);

    const handleSendChat = useCallback(async () => {
        if (!chatInput.trim() || !chatChannelId) return;
        const content = chatInput.trim();
        setChatInput('');
        try {
            await api.messages.send(chatChannelId, { content });
        } catch {
            addToast({ title: 'Failed to send message', variant: 'error' });
        }
    }, [chatInput, chatChannelId, addToast]);

    // Stage socket event listeners
    useEffect(() => {
        if (!channelId || channelType !== 'GUILD_STAGE') return;

        const offStart = onStageStart((data: StageStartPayload) => {
            if (data.channelId !== channelId) return;
            setStageSession({ id: data.sessionId, hostId: data.hostId, topic: data.topic, channelId: data.channelId });
            setStageSpeakers([]);
            setRaisedHands([]);
        });

        const offEnd = onStageEnd((data: StageEndPayload) => {
            if (data.channelId !== channelId) return;
            setStageSession(null);
            setStageSpeakers([]);
            setRaisedHands([]);
        });

        const offSpeakerAdd = onStageSpeakerAdd((data: StageSpeakerAddPayload) => {
            if (data.channelId !== channelId) return;
            setStageSpeakers(prev => {
                if (prev.some(s => s.userId === data.userId)) return prev;
                return [...prev, { id: data.userId, sessionId: data.sessionId, userId: data.userId, invitedBy: data.invitedBy }];
            });
            // Remove from raised hands if they were invited
            setRaisedHands(prev => prev.filter(uid => uid !== data.userId));
        });

        const offSpeakerRemove = onStageSpeakerRemove((data: StageSpeakerRemovePayload) => {
            if (data.channelId !== channelId) return;
            setStageSpeakers(prev => prev.filter(s => s.userId !== data.userId));
        });

        const offHandRaise = onStageHandRaise((data: StageHandRaisePayload) => {
            if (data.channelId !== channelId) return;
            setRaisedHands(prev => prev.includes(data.userId) ? prev : [...prev, data.userId]);
        });

        return () => {
            offStart();
            offEnd();
            offSpeakerAdd();
            offSpeakerRemove();
            offHandRaise();
        };
    }, [channelId, channelType]);

    // Stage actions
    const handleStartStage = useCallback(async () => {
        if (!channelId) return;
        try {
            const data = await api.stage.startSession(channelId);
            setStageSession(data.session);
            setStageSpeakers([]);
        } catch {
            addToast({ title: 'Failed to start stage', variant: 'error' });
        }
    }, [channelId, addToast]);

    const handleEndStage = useCallback(async () => {
        if (!channelId) return;
        try {
            await api.stage.endSession(channelId);
            setStageSession(null);
            setStageSpeakers([]);
            setRaisedHands([]);
        } catch {
            addToast({ title: 'Failed to end stage', variant: 'error' });
        }
    }, [channelId, addToast]);

    const handleRaiseHand = useCallback(async () => {
        if (!channelId) return;
        try {
            await api.stage.raiseHand(channelId);
        } catch {
            addToast({ title: 'Failed to raise hand', variant: 'error' });
        }
    }, [channelId, addToast]);

    const handleInviteSpeaker = useCallback(async (userId: string) => {
        if (!channelId) return;
        try {
            await api.stage.inviteSpeaker(channelId, userId);
        } catch {
            addToast({ title: 'Failed to invite speaker', variant: 'error' });
        }
    }, [channelId, addToast]);

    const handleRemoveSpeaker = useCallback(async (userId: string) => {
        if (!channelId) return;
        try {
            await api.stage.removeSpeaker(channelId, userId);
        } catch {
            addToast({ title: 'Failed to remove speaker', variant: 'error' });
        }
    }, [channelId, addToast]);

    // Auto-connect when entering voice channel
    useEffect(() => {
        let autoConnectTimer: ReturnType<typeof setTimeout> | null = null;
        if (channelId && !isConnected && !isConnecting && !hasAutoConnected) {
            // Defer one tick so React StrictMode's dev remount cycle can cancel
            // the first pass before any WebRTC offer is attempted.
            autoConnectTimer = setTimeout(() => {
                setHasAutoConnected(true);
                connect().catch((err) => {
                    addToast({
                        title: 'Connection Failed',
                        description: err.message || 'Could not connect to voice channel.',
                        variant: 'error',
                    });
                });
            }, 0);
        }
        return () => {
            if (autoConnectTimer) clearTimeout(autoConnectTimer);
        };
    }, [channelId, isConnected, isConnecting, hasAutoConnected, connect, addToast]);

    // Sync voice state to VoiceContext for VoiceBar and sidebar
    useEffect(() => {
        if (isConnected && channelId && guildId) {
            voiceCtx.joinVoice(channelId, channelName, '', guildId);
        }
    }, [isConnected, channelId, guildId, channelName]);

    // Sync participant count to VoiceContext
    useEffect(() => {
        if (isConnected) {
            // allParticipants includes local + remote
            const count = (localParticipant ? 1 : 0) + participants.length;
            voiceCtx.setParticipantCount(count);
        }
    }, [isConnected, participants.length, localParticipant]);

    // Register the real LiveKit toggleMute with VoiceContext so VoiceBar delegates to it
    useEffect(() => {
        voiceCtx.registerMuteHandler(toggleMute);
        return () => voiceCtx.registerMuteHandler(null);
    }, [toggleMute]);

    // Sync LiveKit isMuted to VoiceContext so VoiceBar icon stays accurate
    useEffect(() => {
        voiceCtx.syncMuted(isMuted);
    }, [isMuted]);

    // Handle connection errors
    useEffect(() => {
        if (connectionError) {
            addToast({
                title: 'Voice Error',
                description: connectionError,
                variant: 'error',
            });
        }
    }, [connectionError, addToast]);

    useEffect(() => {
        if (isConnected) setManuallyDisconnected(false);
    }, [isConnected]);

    useEffect(() => {
        if (!isConnected) {
            setOpenDeviceMenu(null);
            return;
        }
        void refreshDevices();
    }, [isConnected, refreshDevices]);

    // Close panels on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (volumePanelRef.current && !volumePanelRef.current.contains(e.target as Node)) {
                setShowVolumePanel(false);
            }
            if (deviceMenuRef.current && !deviceMenuRef.current.contains(e.target as Node)) {
                setOpenDeviceMenu(null);
            }
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleToggleMute = useCallback(async () => {
        if (isDeafened) {
            toggleDeafen();
            addToast({ title: 'Undeafened & Unmuted', variant: 'info' });
        } else {
            await toggleMute();
            addToast({ title: isMuted ? 'Microphone Unmuted' : 'Microphone Muted', variant: 'info' });
        }
    }, [isDeafened, isMuted, toggleMute, toggleDeafen, addToast]);

    const handleToggleDeafen = useCallback(() => {
        toggleDeafen();
        if (!isDeafened) {
            addToast({ title: 'Deafened', description: 'You can no longer hear others.', variant: 'info' });
        } else {
            addToast({ title: 'Undeafened', description: 'Audio restored.', variant: 'info' });
        }
    }, [isDeafened, toggleDeafen, addToast]);

    const handleToggleCamera = useCallback(async () => {
        try {
            await toggleCamera();
            addToast({ title: isCameraOn ? 'Camera Disabled' : 'Camera Enabled', variant: 'info' });
        } catch (err) {
            const description = err instanceof Error ? err.message : 'Could not toggle camera.';
            addToast({ title: 'Camera Error', description, variant: 'error' });
        }
    }, [isCameraOn, toggleCamera, addToast]);

    const handleToggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            await stopScreenShare();
            addToast({ title: 'Screen Share Stopped', variant: 'info' });
        } else {
            await startScreenShare();
            addToast({ title: 'Screen Sharing Started', variant: 'info' });
        }
    }, [isScreenSharing, startScreenShare, stopScreenShare, addToast]);

    const handleDisconnect = useCallback(async () => {
        await leaveVoiceSession({ disconnectLiveKit: disconnect, clearVoiceState: voiceCtx.leaveVoice });
        setManuallyDisconnected(true);
        addToast({ title: 'Disconnected', description: 'Left the voice channel.', variant: 'info' });
    }, [disconnect, addToast, voiceCtx]);

    const handleMasterVolumeChange = useCallback((volume: number) => {
        setMasterVolume(volume);
        setLivekitMasterVolume(volume);
        spatialEngineRef.current?.setMasterVolume(volume);
    }, [setLivekitMasterVolume]);

    const handleUserVolumeChange = useCallback((participantId: string, volume: number) => {
        setUserVolumes(prev => ({ ...prev, [participantId]: volume }));
        setParticipantVolume(participantId, volume);
        spatialEngineRef.current?.setParticipantVolume(participantId, volume);
    }, [setParticipantVolume]);

    const getUserVolume = (id: string) => userVolumes[id] ?? 100;

    const handleParticipantContext = (e: React.MouseEvent, participantId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, participantId });
    };

    // Combine local and remote participants for display
    const allParticipants: (LiveKitParticipant & { bgColor: string; avatar: string })[] = [
        // Local participant first
        ...(localParticipant ? [{
            ...localParticipant,
            bgColor: getDeterministicGradient(localParticipant.name),
            avatar: localParticipant.name.charAt(0).toUpperCase(),
        }] : []),
        // Remote participants
        ...participants.map(p => ({
            ...p,
            bgColor: getDeterministicGradient(p.name),
            avatar: p.name.charAt(0).toUpperCase(),
        })),
    ];
    const ownAvatarFrame = (userProfile?.avatarFrame ?? 'none') as 'none' | 'neon' | 'gold' | 'glass';
    const ownNameplateStyle = userProfile?.nameplateStyle ?? 'none';

    // Connection quality color helper
    const getQualityColor = (quality: string): string => {
        switch (quality) {
            case 'excellent': return '#43b581';
            case 'good': return '#43b581';
            case 'poor': return '#faa61a';
            case 'lost': return '#ed4245';
            default: return '#43b581';
        }
    };

    const getQualityLabel = (quality: string): string => {
        switch (quality) {
            case 'excellent': return 'Excellent';
            case 'good': return 'Good';
            case 'poor': return 'Poor';
            case 'lost': return 'Lost';
            default: return 'Unknown';
        }
    };

    // Find the screen sharer (if any) for 70/30 layout
    const screenSharer = allParticipants.find(p => p.isScreenSharing || Boolean(p.screenTrack));
    const nonSharers = screenSharer ? allParticipants.filter(p => p.id !== screenSharer.id) : [];

    // Calculate grid columns based on participant count
    const getGridTemplate = (count: number) => {
        if (count === 0) return '1fr';
        if (count === 1) return '1fr';
        if (count === 2) return '1fr 1fr';
        if (count <= 4) return 'repeat(2, 1fr)';
        if (count <= 6) return 'repeat(3, 1fr)';
        if (count <= 9) return 'repeat(3, 1fr)';
        return 'repeat(4, 1fr)';
    };

    return (
        <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ background: hasCustomBg ? 'transparent' : 'radial-gradient(circle at center, var(--bg-tertiary) 0%, var(--bg-app) 100%)' }}>
            <header className="top-bar">
                {channelType === 'GUILD_STAGE' ? <Radio size={24} style={{ color: 'var(--accent-primary)' }} /> : <Mic size={24} style={{ color: 'var(--text-muted)' }} />}
                <h2>{channelName}</h2>
                {isConnecting && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                        Connecting...
                    </span>
                )}
                {isConnected && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '13px', fontWeight: 500 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
                        Connected
                    </span>
                )}
                <div style={{ flex: 1 }}></div>
                <div className="unified-top-actions" style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <MessageSquare size={20} className="hover-lift" style={{ cursor: 'pointer', transition: 'color 0.2s', color: chatOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                            onClick={() => { setChatOpen(!chatOpen); setChatPreviewMessages([]); }}
                            onMouseOver={e => e.currentTarget.style.color = 'var(--accent-primary)'}
                            onMouseOut={e => { if (!chatOpen) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        />
                        {chatPreviewMessages.length > 0 && !chatOpen && (
                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--error)', border: '2px solid var(--bg-app)' }} />
                        )}
                    </div>
                    <Users size={20} className="hover-lift" style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'} />
                    <TopBarActions />
                </div>
            </header>

            {/* Stage channel topic bar */}
            {channelType === 'GUILD_STAGE' && (
                <div style={{
                    padding: '8px 16px', background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--stroke)',
                    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                }}>
                    <Radio size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    {stageSession ? (
                        <>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px' }}>
                                {stageSession.topic || 'Stage in progress'}
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                {stageSpeakers.length} speaker{stageSpeakers.length !== 1 ? 's' : ''}
                            </span>
                            {/* Host controls */}
                            {stageSession.hostId === userProfile?.id && (
                                <>
                                    <button onClick={handleEndStage} style={{
                                        marginLeft: 'auto', padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                                        background: 'var(--error)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                                    }}>End Stage</button>
                                    {raisedHands.length > 0 && (
                                        <span style={{ color: 'var(--warning)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Hand size={14} />
                                            {raisedHands.length} raised hand{raisedHands.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </>
                            )}
                            {/* Audience raise hand */}
                            {stageSession.hostId !== userProfile?.id && !stageSpeakers.some(s => s.userId === userProfile?.id) && (
                                <button onClick={handleRaiseHand} style={{
                                    marginLeft: 'auto', padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--stroke)',
                                    cursor: 'pointer', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px',
                                }}>
                                    <Hand size={13} /> Raise Hand
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No active stage</span>
                            <button onClick={handleStartStage} style={{
                                marginLeft: 'auto', padding: '4px 12px', borderRadius: 'var(--radius-sm)',
                                background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                            }}>Start Stage</button>
                        </>
                    )}
                </div>
            )}

            {/* Stage speakers panel (when session is active, shown below topic bar) */}
            {channelType === 'GUILD_STAGE' && stageSession && stageSpeakers.length > 0 && (
                <div style={{
                    padding: '8px 16px', background: 'var(--bg-tertiary)',
                    borderBottom: '1px solid var(--stroke)',
                    display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Speakers</span>
                    {stageSpeakers.map(sp => (
                        <div key={sp.userId} style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '2px 8px',
                            fontSize: '12px', color: 'var(--text-primary)',
                        }}>
                            {sp.userId === stageSession.hostId && <Crown size={11} style={{ color: 'var(--warning)' }} />}
                            <span>{sp.userId}</span>
                            {stageSession.hostId === userProfile?.id && sp.userId !== userProfile?.id && (
                                <X size={12} style={{ cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '4px' }}
                                   onClick={() => handleRemoveSpeaker(sp.userId)} />
                            )}
                        </div>
                    ))}
                    {/* Host can invite raised-hand users */}
                    {stageSession.hostId === userProfile?.id && raisedHands.map(uid => (
                        <div key={uid} style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: 'var(--warning-alpha, rgba(250,166,26,0.15))', borderRadius: 'var(--radius-sm)', padding: '2px 8px',
                            fontSize: '12px', color: 'var(--warning)',
                        }}>
                            <Hand size={11} />
                            <span>{uid}</span>
                            <button onClick={() => handleInviteSpeaker(uid)} style={{
                                marginLeft: '4px', padding: '0 4px', borderRadius: '2px',
                                background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '10px',
                            }}>Invite</button>
                        </div>
                    ))}
                </div>
            )}

            <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
                {/* Connection status messages */}
                {isConnecting && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <Loader2 size={48} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>Connecting to voice channel...</p>
                    </div>
                )}

                {!isConnecting && !isConnected && connectionError && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--error-alpha)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PhoneOff size={32} style={{ color: 'var(--error)' }} />
                        </div>
                        <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>Connection Failed</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px' }}>{connectionError}</p>
                        <button
                            onClick={() => connect()}
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
                            Retry Connection
                        </button>
                    </div>
                )}

                {!isConnecting && !isConnected && !connectionError && manuallyDisconnected && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <PhoneOff size={32} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>You left this voice channel</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px' }}>
                            Stay on this page and rejoin whenever you are ready.
                        </p>
                        <button
                            onClick={() => connect()}
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
                            Rejoin Voice
                        </button>
                    </div>
                )}

                {isConnected && allParticipants.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={40} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600 }}>You're the only one here</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Invite others to join the voice channel!</p>
                    </div>
                )}

                {/* Spatial Canvas Mode */}
                {isConnected && allParticipants.length > 0 && !screenSharer && spatialMode && (
                    <SpatialCanvas
                        participants={allParticipants}
                        localParticipantId={localParticipant?.id}
                        positions={spatialPositions}
                        localPosition={spatialLocalPosition}
                        onLocalPositionChange={updateSpatialLocalPosition}
                        ownAvatarFrame={ownAvatarFrame}
                    />
                )}

                {/* Grid Mode (default) */}
                {isConnected && allParticipants.length > 0 && !screenSharer && !spatialMode && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: getGridTemplate(allParticipants.length),
                        gap: '16px',
                        width: '100%',
                        maxWidth: '1200px',
                        height: allParticipants.length <= 2 ? '50vh' : 'auto',
                        minHeight: '400px',
                        transition: 'all 0.3s ease-in-out'
                    }}>
                        {allParticipants.map(p => (
                            <div key={p.id} className="voice-participant-card hover-lift" onContextMenu={(e) => handleParticipantContext(e, p.id)} style={{
                                background: 'var(--bg-elevated)',
                                borderRadius: 'var(--radius-lg)',
                                border: p.isSpeaking ? '2px solid #43b581' : 'var(--border-structural)',
                                boxShadow: p.isSpeaking ? '0 0 24px rgba(67, 181, 129, 0.3), var(--shadow-hover)' : 'var(--shadow-panel)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                position: 'relative', overflow: 'hidden', transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                minHeight: allParticipants.length <= 2 ? '100%' : '240px',
                                transform: p.isSpeaking ? 'scale(1.02)' : 'scale(1)'
                            }}>
                                {/* Video or Avatar */}
                                {p.videoTrack ? (
                                    <div style={{ position: 'absolute', inset: 0 }}>
                                        <ParticipantVideo track={p.videoTrack} />
                                    </div>
                                ) : (
                                    <>
                                        {/* Default Fallback Background Graphic */}
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60px', background: p.bgColor, opacity: 0.5, filter: 'blur(20px)' }}></div>

                                        {/* Avatar with speaking indicator */}
                                        <div style={{ position: 'relative', zIndex: 2 }}>
                                            {p.isSpeaking && (
                                                <div className="speaking-ring" style={{
                                                    position: 'absolute',
                                                    inset: '-6px',
                                                    borderRadius: '50%',
                                                    border: '3px solid #43b581',
                                                    animation: 'speakingPulse 1.2s ease-in-out infinite',
                                                    zIndex: 1,
                                                }} />
                                            )}
                                            <Avatar
                                                userId={p.id}
                                                displayName={p.name}
                                                frame={p.id === localParticipant?.id ? ownAvatarFrame : 'none'}
                                                size={100}
                                                style={{
                                                    boxShadow: p.isSpeaking ? '0 0 0 3px #43b581' : '0 4px 12px rgba(0,0,0,0.5)',
                                                    transition: 'box-shadow 0.2s ease-in-out',
                                                }}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Name */}
                                <div style={{
                                    marginTop: p.videoTrack ? 'auto' : '24px',
                                    padding: p.videoTrack ? '12px' : '0',
                                    background: p.videoTrack ? 'linear-gradient(transparent, rgba(0,0,0,0.8))' : 'transparent',
                                    width: p.videoTrack ? '100%' : 'auto',
                                    position: p.videoTrack ? 'absolute' : 'relative',
                                    bottom: p.videoTrack ? 0 : 'auto',
                                    fontSize: '16px',
                                    fontWeight: 600,
                                    zIndex: 2,
                                    fontFamily: 'var(--font-display)',
                                    color: p.isSpeaking ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    textAlign: p.videoTrack ? 'left' : 'center',
                                }}>
                                    <span className={p.id === localParticipant?.id && ownNameplateStyle !== 'none' ? `nameplate-${ownNameplateStyle}` : undefined}>
                                        {p.name}
                                    </span>
                                    {p.id === localParticipant?.id && <span style={{ opacity: 0.6, marginLeft: '8px' }}>(You)</span>}
                                </div>

                                {/* Speaking Glow Underlay */}
                                {p.isSpeaking && !p.videoTrack && (
                                    <div className="speaker-spotlight" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '140px', height: '140px', borderRadius: '50%', background: '#43b581', filter: 'blur(40px)', opacity: 0.15, zIndex: 1, animation: 'spotlightPulse 1.5s infinite alternate' }}></div>
                                )}

                                {/* Status Indicators */}
                                <div style={{ position: 'absolute', bottom: '16px', right: '16px', display: 'flex', gap: '8px', zIndex: 2 }}>
                                    {p.isMuted && <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)', border: 'var(--border-structural)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}><MicOff size={16} /></div>}
                                    {p.isDeafened && <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-app)', border: 'var(--border-structural)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}><HeadphoneOff size={16} /></div>}
                                    {p.isScreenSharing && <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-primary)', border: 'var(--border-structural)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}><MonitorUp size={16} /></div>}
                                </div>

                                {/* Connection Quality Indicator */}
                                <div title={`Connection: ${getQualityLabel(p.connectionQuality)}`} style={{
                                    position: 'absolute', top: '12px', right: '12px', zIndex: 3,
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                                }}>
                                    <Wifi size={12} style={{ color: getQualityColor(p.connectionQuality) }} />
                                    <div style={{
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: getQualityColor(p.connectionQuality),
                                        boxShadow: `0 0 6px ${getQualityColor(p.connectionQuality)}`,
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Screen Share Layout: 70/30 split */}
                {isConnected && screenSharer && (
                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        width: '100%',
                        maxWidth: '1400px',
                        height: '70vh',
                        minHeight: '400px',
                    }}>
                        {/* Main screen share view (70%) */}
                        <div style={{
                            flex: 7,
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-lg)',
                            border: '2px solid #43b581',
                            overflow: 'hidden',
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            {screenSharer.screenTrack ? (
                                <ParticipantVideo track={screenSharer.screenTrack} />
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                                    <MonitorUp size={48} />
                                    <span style={{ fontSize: '16px', fontWeight: 600 }}>{screenSharer.name} is sharing their screen</span>
                                </div>
                            )}
                            {/* Sharer name overlay */}
                            <div style={{
                                position: 'absolute', bottom: '12px', left: '12px', zIndex: 2,
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                                background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                            }}>
                                <MonitorUp size={14} style={{ color: '#43b581' }} />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {screenSharer.name}{screenSharer.id === localParticipant?.id ? ' (You)' : ''}
                                </span>
                            </div>
                        </div>

                        {/* Participant sidebar (30%) */}
                        <div style={{
                            flex: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            overflowY: 'auto',
                        }}>
                            {allParticipants.map(p => (
                                <div key={p.id} className="voice-participant-card hover-lift" onContextMenu={(e) => handleParticipantContext(e, p.id)} style={{
                                    background: 'var(--bg-elevated)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: p.isSpeaking ? '2px solid #43b581' : 'var(--border-structural)',
                                    boxShadow: p.isSpeaking ? '0 0 16px rgba(67, 181, 129, 0.3)' : 'var(--shadow-panel)',
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    position: 'relative', overflow: 'hidden',
                                    padding: '12px 16px',
                                    transition: 'all 0.2s ease',
                                }}>
                                    {/* Avatar with speaking indicator */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        {p.isSpeaking && (
                                            <div className="speaking-ring" style={{
                                                position: 'absolute',
                                                inset: '-4px',
                                                borderRadius: '50%',
                                                border: '2px solid #43b581',
                                                animation: 'speakingPulse 1.2s ease-in-out infinite',
                                            }} />
                                        )}
                                        <Avatar userId={p.id} displayName={p.name} frame={p.id === localParticipant?.id ? ownAvatarFrame : 'none'} size={40} style={{
                                            boxShadow: p.isSpeaking ? '0 0 0 2px #43b581' : 'none',
                                            transition: 'box-shadow 0.2s',
                                        }} />
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '14px', fontWeight: 600,
                                            color: p.isSpeaking ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            <span className={p.id === localParticipant?.id && ownNameplateStyle !== 'none' ? `nameplate-${ownNameplateStyle}` : undefined}>
                                                {p.name}
                                            </span>
                                            {p.id === localParticipant?.id && <span style={{ opacity: 0.6, marginLeft: '4px', fontSize: '12px' }}>(You)</span>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                            {p.isMuted && <MicOff size={12} style={{ color: 'var(--error)' }} />}
                                            {p.isScreenSharing && <MonitorUp size={12} style={{ color: '#43b581' }} />}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <div style={{
                                                    width: '6px', height: '6px', borderRadius: '50%',
                                                    background: getQualityColor(p.connectionQuality),
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right-click context menu for per-user volume */}
            {contextMenu && (() => {
                const p = allParticipants.find(pp => pp.id === contextMenu.participantId);
                if (!p || p.id === localParticipant?.id) return null;
                return (
                    <div ref={contextMenuRef} style={{
                        position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000,
                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)',
                        padding: '12px', minWidth: '220px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--stroke)' }}>
                            <Avatar userId={p.id} displayName={p.name} frame={p.id === localParticipant?.id ? ownAvatarFrame : 'none'} size={28} />
                            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{p.name}</span>
                        </div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>User Volume</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Volume2 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <input
                                type="range" min={0} max={200} value={getUserVolume(p.id)}
                                onChange={(e) => handleUserVolumeChange(p.id, Number(e.target.value))}
                                style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '4px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '36px', textAlign: 'right' }}>{getUserVolume(p.id)}%</span>
                        </div>
                        <button
                            onClick={() => { handleUserVolumeChange(p.id, 100); setContextMenu(null); }}
                            style={{ marginTop: '8px', width: '100%', padding: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
                        >Reset to 100%</button>
                    </div>
                );
            })()}

            {/* Call Volume Settings Panel */}
            {showVolumePanel && (
                <div ref={volumePanelRef} style={{
                    position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', zIndex: 20,
                    background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)',
                    padding: '20px', minWidth: '300px', maxWidth: '360px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Call Volume Settings</h3>
                        <X size={16} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setShowVolumePanel(false)} />
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Master Volume</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Volume2 size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                            <input
                                type="range" min={0} max={100} value={masterVolume}
                                onChange={(e) => handleMasterVolumeChange(Number(e.target.value))}
                                style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '4px', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, minWidth: '36px', textAlign: 'right' }}>{masterVolume}%</span>
                        </div>
                    </div>

                    {participants.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--stroke)', paddingTop: '12px' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px' }}>Per-User Volume</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                                {participants.map(p => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Avatar userId={p.id} displayName={p.name} frame={p.id === localParticipant?.id ? ownAvatarFrame : 'none'} size={24} />
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', width: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{p.name}</span>
                                        <input
                                            type="range" min={0} max={200} value={getUserVolume(p.id)}
                                            onChange={(e) => handleUserVolumeChange(p.id, Number(e.target.value))}
                                            style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '3px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>{getUserVolume(p.id)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Voice Controls with Tooltips */}
            {(isConnected || isConnecting) && (
                <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--bg-elevated)', padding: '12px 24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--stroke)', boxShadow: 'var(--shadow-panel)', zIndex: 10 }}>
                    <div className="tooltip-container">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                                onMouseEnter={() => setHoveredBtn('mic')}
                                onMouseLeave={() => setHoveredBtn(null)}
                                onClick={handleToggleMute}
                                disabled={isConnecting}
                                style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: isMuted ? 'var(--error)' : 'var(--bg-tertiary)',
                                    border: '1px solid var(--stroke)', color: isMuted ? 'white' : 'var(--text-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isConnecting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                    transform: hoveredBtn === 'mic' ? 'translateY(-2px)' : 'none',
                                    boxShadow: hoveredBtn === 'mic' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                                    opacity: isConnecting ? 0.5 : 1,
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
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
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
                        </div>
                        <div className="tooltip">{isMuted ? 'Unmute' : 'Mute'}</div>
                    </div>

                    <div className="tooltip-container">
                        <button
                            onMouseEnter={() => setHoveredBtn('deafen')}
                            onMouseLeave={() => setHoveredBtn(null)}
                            onClick={handleToggleDeafen}
                            disabled={isConnecting}
                            style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: isDeafened ? 'var(--error)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)', color: isDeafened ? 'white' : 'var(--text-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isConnecting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                transform: hoveredBtn === 'deafen' ? 'translateY(-2px)' : 'none',
                                boxShadow: hoveredBtn === 'deafen' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                                opacity: isConnecting ? 0.5 : 1,
                            }}
                        >
                            {isDeafened ? <HeadphoneOff size={20} /> : <Headphones size={20} />}
                        </button>
                        <div className="tooltip">{isDeafened ? 'Undeafen' : 'Deafen'}</div>
                    </div>

                    <div className="tooltip-container">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                                onMouseEnter={() => setHoveredBtn('video')}
                                onMouseLeave={() => setHoveredBtn(null)}
                                onClick={handleToggleCamera}
                                disabled={isConnecting}
                                style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: isCameraOn ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    border: '1px solid var(--stroke)', color: isCameraOn ? '#000' : 'var(--text-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isConnecting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                    transform: hoveredBtn === 'video' ? 'translateY(-2px)' : 'none',
                                    boxShadow: hoveredBtn === 'video' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                                    opacity: isConnecting ? 0.5 : 1,
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
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
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
                        </div>
                        <div className="tooltip">{isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}</div>
                    </div>

                    <div className="tooltip-container">
                        <button
                            onMouseEnter={() => setHoveredBtn('screen')}
                            onMouseLeave={() => setHoveredBtn(null)}
                            onClick={handleToggleScreenShare}
                            disabled={isConnecting}
                            style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: isScreenSharing ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)', color: isScreenSharing ? '#000' : 'var(--text-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isConnecting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                transform: hoveredBtn === 'screen' ? 'translateY(-2px)' : 'none',
                                boxShadow: hoveredBtn === 'screen' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                                opacity: isConnecting ? 0.5 : 1,
                            }}
                        >
                            <MonitorUp size={20} />
                        </button>
                        <div className="tooltip">{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</div>
                    </div>

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

                    <div className="tooltip-container">
                        <button
                            onMouseEnter={() => setHoveredBtn('spatial')}
                            onMouseLeave={() => setHoveredBtn(null)}
                            onClick={handleToggleSpatialMode}
                            disabled={isConnecting}
                            style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: spatialMode ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)', color: spatialMode ? '#000' : 'var(--text-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isConnecting ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                transform: hoveredBtn === 'spatial' ? 'translateY(-2px)' : 'none',
                                boxShadow: hoveredBtn === 'spatial' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                                opacity: isConnecting ? 0.5 : 1,
                            }}
                        >
                            <Compass size={20} />
                        </button>
                        <div className="tooltip">{spatialMode ? 'Disable Spatial Audio' : 'Enable Spatial Audio'}</div>
                    </div>

                    <div style={{ width: '1px', height: '32px', background: 'var(--stroke)', margin: '0 8px' }}></div>

                    <div className="tooltip-container">
                        <button
                            onMouseEnter={() => setHoveredBtn('settings')}
                            onMouseLeave={() => setHoveredBtn(null)}
                            onClick={() => setShowVolumePanel(!showVolumePanel)}
                            style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: showVolumePanel ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)', color: showVolumePanel ? '#000' : 'var(--text-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                transform: hoveredBtn === 'settings' ? 'translateY(-2px)' : 'none',
                                boxShadow: hoveredBtn === 'settings' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                            }}
                        >
                            <Settings size={20} />
                        </button>
                        <div className="tooltip">Call Volume</div>
                    </div>

                    <div className="tooltip-container">
                        <button
                            onMouseEnter={() => setHoveredBtn('disconnect')}
                            onMouseLeave={() => setHoveredBtn(null)}
                            onClick={handleDisconnect}
                            style={{
                                width: '64px', height: '48px', borderRadius: 'var(--radius-sm)',
                                background: 'var(--error)', border: 'none', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '8px', transition: 'all 0.2s',
                                transform: hoveredBtn === 'disconnect' ? 'translateY(-2px)' : 'none',
                                boxShadow: hoveredBtn === 'disconnect' ? '0 8px 16px rgba(239, 68, 68, 0.4)' : '0 4px 12px rgba(239, 68, 68, 0.4)'
                            }}
                        >
                            <PhoneOff size={20} />
                        </button>
                        <div className="tooltip danger">Disconnect</div>
                    </div>
                </div>
            )}

            {/* Global animations for voice UI */}
            <style>
                {`
                    @keyframes spotlightPulse {
                        0% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.1; }
                        50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.3; }
                        100% { transform: translate(-50%, -50%) scale(0.95); opacity: 0.1; }
                    }

                    @keyframes speakingPulse {
                        0% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.5; transform: scale(1.08); }
                        100% { opacity: 1; transform: scale(1); }
                    }

                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }

                    @keyframes slideInRight {
                        from { opacity: 0; transform: translateX(20px); }
                        to { opacity: 1; transform: translateX(0); }
                    }

                    .tooltip-container {
                        position: relative;
                        display: inline-flex;
                    }
                    
                    .tooltip-container .tooltip {
                        position: absolute;
                        bottom: 120%;
                        left: 50%;
                        transform: translateX(-50%) translateY(10px);
                        background: var(--text-primary);
                        color: var(--bg-primary);
                        padding: 6px 10px;
                        border-radius: var(--radius-sm);
                        font-size: 12px;
                        font-weight: 600;
                        opacity: 0;
                        visibility: hidden;
                        transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        white-space: nowrap;
                        pointer-events: none;
                        z-index: 100;
                    }

                    .tooltip-container .tooltip.danger {
                        background: var(--error);
                        color: white;
                    }
                    
                    .tooltip-container .tooltip::after {
                        content: '';
                        position: absolute;
                        top: 100%;
                        left: 50%;
                        transform: translateX(-50%);
                        border-width: 4px;
                        border-style: solid;
                        border-color: var(--text-primary) transparent transparent transparent;
                    }

                    .tooltip-container .tooltip.danger::after {
                        border-color: var(--error) transparent transparent transparent;
                    }
                    
                    .tooltip-container:hover .tooltip {
                        opacity: 1;
                        visibility: visible;
                        transform: translateX(-50%) translateY(0);
                    }
                `}
            </style>

            {/* Message Preview Bubbles (when chat is closed) */}
            {!chatOpen && chatPreviewMessages.length > 0 && (
                <div style={{
                    position: 'absolute', top: '64px', right: '16px', zIndex: 20,
                    display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '340px',
                }}>
                    {chatPreviewMessages.map(pm => (
                        <div key={pm.id} onClick={() => { setChatOpen(true); setChatPreviewMessages([]); }} style={{
                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)',
                            padding: '8px 12px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            animation: 'slideInRight 0.2s ease-out',
                        }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{pm.author}: </span>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {pm.content.length > 80 ? pm.content.slice(0, 80) + '...' : pm.content}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Embedded Text Chat Panel */}
            {chatOpen && (
                <div style={{
                    position: 'absolute', top: '56px', right: 0, bottom: 0, width: '360px',
                    background: 'var(--bg-primary)', borderLeft: '1px solid var(--stroke)',
                    display: 'flex', flexDirection: 'column', zIndex: 15,
                }}>
                    {/* Chat Header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderBottom: '1px solid var(--stroke)',
                        background: 'var(--bg-elevated)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Hash size={16} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{channelName}</span>
                        </div>
                        <X size={18} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setChatOpen(false)} />
                    </div>

                    {/* Messages Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {chatMessages.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '32px' }}>
                                <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                                <p>No messages yet.</p>
                                <p style={{ fontSize: '12px' }}>Send a message to start the conversation!</p>
                            </div>
                        )}
                        {chatMessages.map(msg => (
                            <div key={msg.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <Avatar userId={msg.id} displayName={msg.author} size={28} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{msg.author}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{msg.time}</span>
                                    </div>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, wordBreak: 'break-word', lineHeight: 1.4 }}>{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div style={{
                        padding: '12px 16px', borderTop: '1px solid var(--stroke)', background: 'var(--bg-elevated)',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'var(--bg-app)', border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-md)', padding: '8px 12px',
                        }}>
                            <input
                                type="text"
                                placeholder={`Message #${channelName}`}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                                style={{
                                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                    color: 'var(--text-primary)', fontSize: '13px',
                                }}
                            />
                            <Send size={16}
                                style={{ cursor: chatInput.trim() ? 'pointer' : 'default', color: chatInput.trim() ? 'var(--accent-primary)' : 'var(--text-muted)', transition: 'color 0.15s' }}
                                onClick={handleSendChat}
                            />
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default VoiceChannel;
