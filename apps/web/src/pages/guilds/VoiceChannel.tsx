import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Settings, Users, Headphones, HeadphoneOff, Volume2, X, Loader2, MessageSquare, Send, Hash, Wifi, ChevronDown, Check, Radio, Hand, Crown, Compass, Pin, PictureInPicture2, MoreHorizontal, Edit3, Music } from 'lucide-react';
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
import { useIsMobile } from '../../hooks/useIsMobile';
import SpatialCanvas from '../../components/voice/SpatialCanvas';
import GuildSoundboardPanel from '../../components/voice/GuildSoundboardPanel';
import { Track, ConnectionState as LiveKitConnectionState } from 'livekit-client';
import { getConnectionErrorHint } from '../../lib/callErrors';

type OutletContextType = {
    hasCustomBg: boolean;
    setBgMedia: (media: { url: string, type: 'video' | 'image' } | null) => void;
    setActiveModal: (modal: 'settings' | 'userProfile' | 'createGuild' | 'screenShare' | null) => void;
    userProfile?: {
        id?: string;
        avatarFrame?: 'none' | 'neon' | 'gold' | 'glass';
        nameplateStyle?: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch';
        avatarHash?: string | null;
    };
};

// Video element component for rendering participant video
const ParticipantVideo = ({ track, showPiP }: { track: any; showPiP?: boolean }) => {
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

    const handlePiP = async () => {
        try {
            if (!videoRef.current) return;
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                await videoRef.current.requestPictureInPicture();
            }
        } catch { /* PiP not supported */ }
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
            {showPiP && (
                <button
                    onClick={handlePiP}
                    title="Picture-in-Picture"
                    style={{
                        position: 'absolute', top: 8, left: 8, zIndex: 5,
                        width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                        background: 'rgba(0,0,0,0.6)', border: 'none',
                        color: '#fff', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <PictureInPicture2 size={14} />
                </button>
            )}
        </div>
    );
};

const VoiceChannel = () => {
    const { hasCustomBg, userProfile } = useOutletContext<OutletContextType>();
    const { setActiveModal } = useOutletContext<OutletContextType>();
    const { channelId, guildId } = useParams<{ channelId: string; guildId: string }>();
    const { addToast } = useToast();
    const voiceCtx = useVoice();
    const isMobile = useIsMobile();

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
    const [channelTopic, setChannelTopic] = useState<string | null>(null);
    const [editingTopic, setEditingTopic] = useState(false);
    const [topicDraft, setTopicDraft] = useState('');
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

    // More controls popover state (I1)
    const [showMoreControls, setShowMoreControls] = useState(false);
    const moreControlsRef = useRef<HTMLDivElement>(null);

    // Connection panel state
    const [showConnectionPanel, setShowConnectionPanel] = useState(false);
    const [callRtt, setCallRtt] = useState<number | null>(null);
    const [callPacketLoss, setCallPacketLoss] = useState<number | null>(null);

    // Soundboard panel state
    const [showSoundboard, setShowSoundboard] = useState(false);

    // Resizable chat sidebar state (I4)
    const [chatWidth, setChatWidth] = useState(420);
    const chatDraggingRef = useRef(false);

    // Noise suppression state (Item 18)
    const [noiseSuppression, setNoiseSuppression] = useState(() => localStorage.getItem('gratonite_noise_suppression') === 'true');
    const noiseFilterRef = useRef<BiquadFilterNode | null>(null);

    // Audio ducking state (Item 22)
    const [audioDucking, setAudioDucking] = useState(() => localStorage.getItem('gratonite_audio_ducking') !== 'false');
    const duckingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Voice recording state (Item 24)
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordingChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Listen Along state (Item 20)
    const [listeningAlong, setListeningAlong] = useState<{ userId: string; username: string } | null>(null);

    // Pinned participant for focus view
    const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);

    // Avatar hash cache for participants
    const [avatarHashes, setAvatarHashes] = useState<Record<string, string | null>>({});

    // Spatial audio state
    const [spatialMode, setSpatialMode] = useState(() => localStorage.getItem('gratonite_spatial_mode') === 'true');
    const spatialEngineRef = useRef<SpatialAudioEngine | null>(null);

    // Throttling refs for participant join/leave toasts (prevent spam during rapid reconnects)
    const lastJoinToastRef = useRef<number>(0);
    const lastLeftToastRef = useRef<number>(0);

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
        roomRef,
    } = useLiveKit({
        channelId: channelId || '',
        onParticipantJoined: useCallback((participant: LiveKitParticipant) => {
            // Throttle "User Joined" toasts: max 1 per 8 seconds to prevent spam during rapid reconnects
            const now = Date.now();
            if (now - lastJoinToastRef.current >= 8000) {
                lastJoinToastRef.current = now;
                addToast({ title: 'User Joined', description: `${participant.name} joined the voice channel.`, variant: 'info' });
            }
        }, [addToast]),
        onParticipantLeft: useCallback((_participantId: string) => {
            // Throttle "User Left" toasts: max 1 per 8 seconds
            const now = Date.now();
            if (now - lastLeftToastRef.current >= 8000) {
                lastLeftToastRef.current = now;
                addToast({ title: 'User Left', description: 'A user left the voice channel.', variant: 'info' });
            }
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

    // Noise suppression toggle (Item 18)
    const handleToggleNoiseSuppression = useCallback(() => {
        const next = !noiseSuppression;
        setNoiseSuppression(next);
        localStorage.setItem('gratonite_noise_suppression', String(next));
        addToast({ title: next ? 'Noise Suppression Enabled' : 'Noise Suppression Disabled', variant: 'info' });
    }, [noiseSuppression, addToast]);

    // Audio ducking: lower ambient volume when someone speaks (Item 22)
    useEffect(() => {
        if (!audioDucking || !isConnected) return;
        const anyoneSpeaking = participants.some(p => p.isSpeaking);
        if (anyoneSpeaking) {
            if (duckingTimeoutRef.current) { clearTimeout(duckingTimeoutRef.current); duckingTimeoutRef.current = null; }
            window.dispatchEvent(new CustomEvent('voice-ducking', { detail: { duck: true } }));
        } else {
            if (!duckingTimeoutRef.current) {
                duckingTimeoutRef.current = setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('voice-ducking', { detail: { duck: false } }));
                    duckingTimeoutRef.current = null;
                }, 300);
            }
        }
    }, [audioDucking, isConnected, participants]);

    // Voice recording controls (Item 24)
    const handleStartRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            recordingChunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `voice-recording-${new Date().toISOString().slice(0, 19)}.webm`;
                a.click();
                URL.revokeObjectURL(url);
                stream.getTracks().forEach(t => t.stop());
            };
            recorder.start(1000);
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
            addToast({ title: 'Recording Started', description: 'Voice channel is being recorded.', variant: 'info' });
        } catch {
            addToast({ title: 'Recording Failed', description: 'Could not access audio.', variant: 'error' });
        }
    }, [addToast]);

    const handleStopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        mediaRecorderRef.current = null;
        setIsRecording(false);
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        setRecordingDuration(0);
        addToast({ title: 'Recording Saved', description: 'Download will start shortly.', variant: 'info' });
    }, [addToast]);

    // Listen Along dismiss (Item 20)
    const handleStopListenAlong = useCallback(() => {
        setListeningAlong(null);
        const socket = getSocket();
        if (socket) socket.emit('listen_along_stop', {});
    }, []);

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
                setChannelTopic(ch.topic ?? null);
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
        } else if (!isConnected && !isConnecting && voiceCtx.activeCallType === 'guild' && voiceCtx.channelId === channelId) {
            voiceCtx.clearCallState();
        }
    }, [isConnected, isConnecting, channelId, guildId, channelName, voiceCtx]);

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
    }, [toggleMute]);

    useEffect(() => {
        voiceCtx.registerDeafenHandler(toggleDeafen);
    }, [toggleDeafen]);

    // Register the real LiveKit disconnect with VoiceContext so VoiceBar can tear
    // down the room even when VoiceChannel is not mounted (user navigated away).
    // We intentionally do NOT clear the handler on unmount — it must survive
    // navigation so VoiceBar's disconnect button works while on a text channel.
    useEffect(() => {
        voiceCtx.registerDisconnectHandler(disconnect);
    }, [disconnect]);

    useEffect(() => {
        voiceCtx.registerStartScreenShareHandler(startScreenShare);
    }, [startScreenShare]);

    useEffect(() => {
        voiceCtx.registerStopScreenShareHandler(stopScreenShare);
    }, [stopScreenShare]);

    // Sync LiveKit isMuted to VoiceContext so VoiceBar icon stays accurate
    useEffect(() => {
        voiceCtx.syncMuted(isMuted);
    }, [isMuted]);

    useEffect(() => {
        voiceCtx.syncDeafened(isDeafened);
    }, [isDeafened]);

    useEffect(() => {
        voiceCtx.syncScreenSharing(isScreenSharing);
    }, [isScreenSharing]);

    useEffect(() => {
        const mst = (localParticipant?.screenTrack as { mediaStreamTrack?: MediaStreamTrack } | undefined)?.mediaStreamTrack ?? null;
        voiceCtx.syncLocalScreenTrack(mst);
        return () => voiceCtx.syncLocalScreenTrack(null);
    }, [localParticipant?.screenTrack]);

    // Sync local participant connection quality to VoiceContext
    useEffect(() => {
        if (!localParticipant) return;
        const q = localParticipant.connectionQuality;
        const mapped: 'good' | 'fair' | 'poor' =
            (q === 'excellent' || q === 'good') ? 'good' : q === 'poor' ? 'fair' : 'poor';
        voiceCtx.syncConnectionQuality(mapped);
    }, [localParticipant?.connectionQuality]);

    // Poll RTT and packet loss every 3 seconds when connected
    useEffect(() => {
        if (!isConnected) { setCallRtt(null); setCallPacketLoss(null); return; }
        const poll = async () => {
            const room = roomRef.current;
            if (!room) return;
            try {
                const pc: RTCPeerConnection | undefined = (room as any).engine?.pcManager?.publisher?.pc;
                if (!pc) return;
                const stats = await pc.getStats();
                let rtt: number | null = null;
                let lost = 0, sent = 0;
                stats.forEach((report) => {
                    if (report.type === 'remote-inbound-rtp' && typeof report.roundTripTime === 'number') {
                        rtt = Math.round(report.roundTripTime * 1000);
                    }
                    if (report.type === 'outbound-rtp') {
                        lost += (report as any).retransmittedPacketsSent ?? 0;
                        sent += (report as any).packetsSent ?? 0;
                    }
                });
                setCallRtt(rtt);
                setCallPacketLoss(sent > 0 ? Math.round((lost / sent) * 100) : null);
            } catch { /* ignore */ }
        };
        const id = setInterval(poll, 3000);
        void poll();
        return () => clearInterval(id);
    }, [isConnected]);

    // Track reconnect → connected transition to show toast
    const prevConnectionStateRef = useRef<LiveKitConnectionState>(LiveKitConnectionState.Disconnected);
    useEffect(() => {
        const prev = prevConnectionStateRef.current;
        prevConnectionStateRef.current = connectionState;
        if (prev === LiveKitConnectionState.Reconnecting && connectionState === LiveKitConnectionState.Connected) {
            addToast({ title: 'Reconnected ✓', description: 'Voice connection restored.', variant: 'success' });
        }
    }, [connectionState]);

    // Handle connection errors (dedupe identical strings to avoid reconnect toast spam)
    const lastVoiceConnectionErrRef = useRef<string | null>(null);
    useEffect(() => {
        if (!connectionError) {
            lastVoiceConnectionErrRef.current = null;
            return;
        }
        if (lastVoiceConnectionErrRef.current === connectionError) return;
        lastVoiceConnectionErrRef.current = connectionError;
        addToast({
            title: 'Voice Error',
            description: connectionError,
            variant: 'error',
        });
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

    // Chat sidebar drag-to-resize (I4)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!chatDraggingRef.current) return;
            const newWidth = window.innerWidth - e.clientX;
            setChatWidth(Math.max(320, Math.min(600, newWidth)));
        };
        const handleMouseUp = () => { chatDraggingRef.current = false; };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, []);

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
            if (moreControlsRef.current && !moreControlsRef.current.contains(e.target as Node)) {
                setShowMoreControls(false);
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
        try {
            if (isScreenSharing) {
                await stopScreenShare();
                addToast({ title: 'Screen Share Stopped', variant: 'info' });
            } else {
                if (window.gratoniteDesktop?.isDesktop) {
                    setActiveModal('screenShare');
                    return;
                }
                await startScreenShare();
                addToast({ title: 'Screen Sharing Started', variant: 'info' });
            }
        } catch (err) {
            const description = err instanceof Error ? err.message : 'Could not toggle screen share.';
            addToast({ title: 'Screen Share Error', description, variant: 'error' });
        }
    }, [isScreenSharing, startScreenShare, stopScreenShare, addToast, setActiveModal]);

    const handleDisconnect = useCallback(async () => {
        await leaveVoiceSession({ disconnectLiveKit: disconnect, clearVoiceState: voiceCtx.clearCallState });
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

    // Fetch avatar hashes for participants we haven't cached yet
    useEffect(() => {
        const allIds = [
            ...(localParticipant ? [localParticipant.id] : []),
            ...participants.map(p => p.id),
        ];
        const uncached = allIds.filter(id => !(id in avatarHashes));
        if (uncached.length === 0) return;

        // Set null initially to avoid re-fetching
        setAvatarHashes(prev => {
            const next = { ...prev };
            for (const id of uncached) next[id] = null;
            return next;
        });

        for (const id of uncached) {
            api.users.getProfile(id).then((profile) => {
                setAvatarHashes(prev => ({ ...prev, [id]: profile.avatarHash ?? null }));
            }).catch(() => { /* non-fatal */ });
        }
    }, [localParticipant?.id, participants]);

    const getAvatarHash = (participantId: string): string | null => {
        // For local user, prefer the outlet context value (always fresh)
        if (participantId === userProfile?.id) return userProfile?.avatarHash ?? null;
        return avatarHashes[participantId] ?? null;
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

    // Connection state formatter
    const getConnectionStateLabel = (state: LiveKitConnectionState): string => {
        switch (state) {
            case LiveKitConnectionState.Connected: return 'Connected';
            case LiveKitConnectionState.Connecting: return 'Connecting…';
            case LiveKitConnectionState.Reconnecting: return 'Reconnecting…';
            case LiveKitConnectionState.Disconnected: return 'Disconnected';
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
                {channelTopic && !editingTopic && (
                    <>
                        <span style={{ width: '1px', height: '20px', background: 'var(--stroke)', margin: '0 8px', flexShrink: 0 }} />
                        <span
                            title="Click to edit topic"
                            onClick={() => { setEditingTopic(true); setTopicDraft(channelTopic); }}
                            style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}
                        >
                            {channelTopic}
                        </span>
                    </>
                )}
                {!channelTopic && !editingTopic && (
                    <button
                        onClick={() => { setEditingTopic(true); setTopicDraft(''); }}
                        title="Set a topic"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center', marginLeft: '4px' }}
                    >
                        <Edit3 size={14} />
                    </button>
                )}
                {editingTopic && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                        <input
                            autoFocus
                            value={topicDraft}
                            onChange={e => setTopicDraft(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    const newTopic = topicDraft.trim();
                                    if (channelId) {
                                        api.channels.update(channelId, { topic: newTopic || undefined }).then(() => {
                                            setChannelTopic(newTopic || null);
                                            addToast({ title: newTopic ? 'Topic updated' : 'Topic removed', variant: 'success' });
                                        }).catch(() => addToast({ title: 'Failed to update topic', variant: 'error' }));
                                    }
                                    setEditingTopic(false);
                                } else if (e.key === 'Escape') {
                                    setEditingTopic(false);
                                }
                            }}
                            placeholder="Set a channel topic..."
                            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-primary)', fontSize: '13px', width: '250px', outline: 'none' }}
                        />
                        <button
                            onClick={() => {
                                const newTopic = topicDraft.trim();
                                if (channelId) {
                                    api.channels.update(channelId, { topic: newTopic || undefined }).then(() => {
                                        setChannelTopic(newTopic || null);
                                        addToast({ title: newTopic ? 'Topic updated' : 'Topic removed', variant: 'success' });
                                    }).catch(() => addToast({ title: 'Failed to update topic', variant: 'error' }));
                                }
                                setEditingTopic(false);
                            }}
                            style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: '4px', padding: '4px 8px', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        >
                            Save
                        </button>
                        <button
                            onClick={() => setEditingTopic(false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
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
                        <MessageSquare size={20} className="hover-lift hover-text-primary-inactive" data-active={chatOpen ? "true" : undefined} style={{ cursor: 'pointer', transition: 'color 0.2s', color: chatOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                            onClick={() => { setChatOpen(!chatOpen); setChatPreviewMessages([]); }}
                        />
                        {chatPreviewMessages.length > 0 && !chatOpen && (
                            <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--error)', border: '2px solid var(--bg-app)' }} />
                        )}
                    </div>
                    <Users size={20} className="hover-lift hover-text-primary" style={{ cursor: 'pointer', transition: 'color 0.2s' }} />
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
                                        marginLeft: 'auto', padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                                        background: 'var(--error)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                                        transition: 'background 0.15s, opacity 0.15s',
                                    }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                                    >End Stage</button>
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
                                marginLeft: 'auto', padding: '8px 16px', borderRadius: 'var(--radius-sm)',
                                background: 'var(--accent-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                                transition: 'background 0.15s, opacity 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                            >Start Stage</button>
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

            {/* Recording banner (Item 24 — I3 enhanced) */}
            {isRecording && (
                <div style={{
                    padding: '8px 16px', background: 'rgba(239, 68, 68, 0.25)',
                    borderBottom: '1px solid rgba(239, 68, 68, 0.4)',
                    display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 700, color: 'var(--error)',
                }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--error)', animation: 'speakingPulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
                    <span>Recording in progress</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                    <span style={{ flex: 1 }} />
                    <button onClick={handleStopRecording} style={{
                        padding: '4px 14px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--error)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                    }}>Stop</button>
                </div>
            )}

            {/* Listen Along banner (Item 20) */}
            {listeningAlong && (
                <div style={{
                    padding: '6px 16px', background: 'rgba(82, 109, 245, 0.12)',
                    borderBottom: '1px solid rgba(82, 109, 245, 0.3)',
                    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                }}>
                    <span style={{ fontSize: '14px' }}>&#127925;</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Listening along with <strong>{listeningAlong.username}</strong></span>
                    <span style={{ flex: 1 }} />
                    <button onClick={handleStopListenAlong} style={{
                        padding: '2px 10px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--stroke)', cursor: 'pointer', fontSize: '11px',
                    }}>Stop</button>
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
                        {getConnectionErrorHint(connectionError) && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '400px', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--stroke)', textAlign: 'left' }}>
                                <Wifi size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
                                    {getConnectionErrorHint(connectionError)}
                                </p>
                            </div>
                        )}
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
                        getAvatarHash={getAvatarHash}
                    />
                )}

                {/* Grid Mode (default) */}
                {isConnected && allParticipants.length > 0 && !screenSharer && !spatialMode && (() => {
                    const pinned = pinnedParticipant ? allParticipants.find(p => p.id === pinnedParticipant) : null;
                    const unpinned = pinned ? allParticipants.filter(p => p.id !== pinnedParticipant) : allParticipants;

                    const renderTile = (p: typeof allParticipants[0], isPinnedTile: boolean) => (
                        <div key={p.id} className={`voice-participant-card hover-lift${p.isSpeaking ? ' speaking-card' : ''}`} onContextMenu={(e) => handleParticipantContext(e, p.id)} title={`${p.name}${p.isSpeaking ? ' — Speaking' : ''}${p.isMuted ? ' — Muted' : ''}${p.isDeafened ? ' — Deafened' : ''}`} style={{
                            background: 'var(--bg-elevated)',
                            borderRadius: 'var(--radius-lg)',
                            border: p.isSpeaking ? '2px solid #43b581' : '2px solid transparent',
                            boxShadow: p.isSpeaking ? '0 0 0 3px #43b581, 0 0 20px rgba(67, 181, 129, 0.4), var(--shadow-hover)' : 'var(--shadow-panel)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            position: 'relative', overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s',
                            minHeight: isPinnedTile ? '400px' : (allParticipants.length <= 2 ? '100%' : '160px'),
                            transform: p.isSpeaking ? 'scale(1.02)' : 'scale(1)',
                        }}>
                            {/* Pin button */}
                            <button
                                onClick={() => setPinnedParticipant(prev => prev === p.id ? null : p.id)}
                                title={pinnedParticipant === p.id ? 'Unpin' : 'Pin'}
                                style={{
                                    position: 'absolute', top: 8, left: 8, zIndex: 5,
                                    width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                                    background: pinnedParticipant === p.id ? 'var(--accent-primary)' : 'rgba(0,0,0,0.5)',
                                    border: 'none', color: pinnedParticipant === p.id ? '#000' : '#fff',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backdropFilter: 'blur(4px)', opacity: 0.8, transition: 'opacity 0.15s',
                                }}
                                className="hover-opacity-08-to-1"
                            >
                                <Pin size={14} />
                            </button>

                            {/* Video or Avatar */}
                            {p.videoTrack ? (
                                <div style={{ position: 'absolute', inset: 0 }}>
                                    <ParticipantVideo track={p.videoTrack} showPiP />
                                </div>
                            ) : (
                                <>
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60px', background: p.bgColor, opacity: 0.5, filter: 'blur(20px)' }}></div>
                                    <div style={{ position: 'relative', zIndex: 2 }}>
                                        {p.isSpeaking && (
                                            <div className="speaking-ring" style={{
                                                position: 'absolute', inset: '-6px', borderRadius: '50%',
                                                border: '3px solid #43b581', animation: 'speakingPulse 1.2s ease-in-out infinite', zIndex: 1,
                                            }} />
                                        )}
                                        <Avatar
                                            userId={p.id} displayName={p.name} avatarHash={getAvatarHash(p.id)}
                                            frame={p.id === localParticipant?.id ? ownAvatarFrame : 'none'}
                                            size={isPinnedTile ? 140 : 120}
                                            style={{
                                                boxShadow: p.isSpeaking ? '0 0 0 3px #43b581, 0 0 20px rgba(67, 181, 129, 0.4)' : '0 4px 12px rgba(0,0,0,0.5)',
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
                                fontSize: '16px', fontWeight: 600, zIndex: 2, fontFamily: 'var(--font-display)',
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

                            {/* Status Indicators (P6: top-right corner) */}
                            <div style={{ position: 'absolute', top: '12px', right: '48px', display: 'flex', gap: '6px', zIndex: 4 }}>
                                {p.isMuted && <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}><MicOff size={14} /></div>}
                                {p.isDeafened && <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}><HeadphoneOff size={14} /></div>}
                                {p.isScreenSharing && <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}><MonitorUp size={14} /></div>}
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
                    );

                    return pinned ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '1200px' }}>
                            {renderTile(pinned, true)}
                            {unpinned.length > 0 && (
                                <div className="voice-participant-grid" style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${Math.min(unpinned.length, 4)}, 1fr)`,
                                    gap: '12px',
                                }}>
                                    {unpinned.map(p => renderTile(p, false))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="voice-participant-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: getGridTemplate(allParticipants.length),
                            gap: '16px',
                            width: '100%',
                            maxWidth: '1200px',
                            height: allParticipants.length <= 2 ? '50vh' : 'auto',
                            minHeight: '400px',
                            transition: 'all 0.3s ease-in-out',
                        }}>
                            {allParticipants.map(p => renderTile(p, false))}
                        </div>
                    );
                })()}

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
                                <ParticipantVideo track={screenSharer.screenTrack} showPiP />
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
                                        <Avatar userId={p.id} displayName={p.name} avatarHash={getAvatarHash(p.id)} frame={p.id === localParticipant?.id ? ownAvatarFrame : 'none'} size={40} style={{
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
                            <Avatar userId={p.id} displayName={p.name} avatarHash={getAvatarHash(p.id)} frame={p.id === localParticipant?.id ? ownAvatarFrame : 'none'} size={28} />
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
                                        <Avatar userId={p.id} displayName={p.name} avatarHash={getAvatarHash(p.id)} frame={p.id === localParticipant?.id ? ownAvatarFrame : 'none'} size={24} />
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

            {/* Soundboard Panel */}
            {showSoundboard && guildId && (
                <div style={{ position: 'absolute', bottom: '110px', right: '24px', zIndex: 15 }}>
                    <GuildSoundboardPanel
                        guildId={guildId}
                        currentUserId={userProfile?.id}
                        isAdmin={false}
                        onClose={() => setShowSoundboard(false)}
                    />
                </div>
            )}

            {/* Voice Controls with Tooltips */}
            {(isConnected || isConnecting) && (
                <div className="voice-controls" style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '16px', alignItems: 'center', background: 'var(--bg-elevated)', padding: '12px 24px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--stroke)', boxShadow: 'var(--shadow-panel)', zIndex: 10 }}>
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
                                        position: 'absolute', bottom: '56px', left: '50%', transform: 'translateX(-50%)', width: '240px',
                                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.45)', padding: '8px', zIndex: 30,
                                    }}>
                                        {/* Arrow pointing down */}
                                        <div style={{
                                            position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                                            width: '10px', height: '10px', background: 'var(--bg-elevated)', borderRight: '1px solid var(--stroke)', borderBottom: '1px solid var(--stroke)',
                                        }} />
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
                                        position: 'absolute', bottom: '56px', left: '50%', transform: 'translateX(-50%)', width: '240px',
                                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.45)', padding: '8px', zIndex: 30,
                                    }}>
                                        {/* Arrow pointing down */}
                                        <div style={{
                                            position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                                            width: '10px', height: '10px', background: 'var(--bg-elevated)', borderRight: '1px solid var(--stroke)', borderBottom: '1px solid var(--stroke)',
                                        }} />
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

                    {/* More Controls Popover (I1) */}
                    <div className="tooltip-container" ref={moreControlsRef} style={{ position: 'relative' }}>
                        <button
                            onMouseEnter={() => setHoveredBtn('more')}
                            onMouseLeave={() => setHoveredBtn(null)}
                            onClick={() => setShowMoreControls(!showMoreControls)}
                            style={{
                                width: '48px', height: '48px', borderRadius: '50%',
                                background: showMoreControls ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)', color: showMoreControls ? '#000' : 'var(--text-primary)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                transform: hoveredBtn === 'more' ? 'translateY(-2px)' : 'none',
                                boxShadow: hoveredBtn === 'more' ? '0 4px 12px rgba(0,0,0,0.2)' : 'none',
                            }}
                        >
                            <MoreHorizontal size={20} />
                        </button>
                        {!showMoreControls && <div className="tooltip">More Controls</div>}

                        {showMoreControls && (
                            <div style={{
                                position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)',
                                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)',
                                boxShadow: '0 12px 40px rgba(0,0,0,0.5)', padding: '16px', zIndex: 30,
                                minWidth: '280px',
                            }}>
                                {/* Arrow pointing down */}
                                <div style={{
                                    position: 'absolute', bottom: '-6px', left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                                    width: '10px', height: '10px', background: 'var(--bg-elevated)', borderRight: '1px solid var(--stroke)', borderBottom: '1px solid var(--stroke)',
                                }} />
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '0.05em' }}>More Controls</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {/* Quality Picker */}
                                    <div style={{ gridColumn: '1 / -1', marginBottom: '4px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600 }}>Stream Quality</div>
                                        <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--stroke)', height: '32px' }}>
                                            {(['low', 'medium', 'high', 'source'] as const).map((q) => (
                                                <button
                                                    key={q}
                                                    onClick={() => setStreamQuality(q)}
                                                    style={{
                                                        flex: 1, padding: '0 8px', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                                        background: streamQuality === q ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                        color: streamQuality === q ? '#000' : 'var(--text-secondary)',
                                                    }}
                                                >
                                                    {q === 'medium' ? 'Med' : q.charAt(0).toUpperCase() + q.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Spatial Audio */}
                                    <button
                                        onClick={handleToggleSpatialMode}
                                        disabled={isConnecting}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                                            background: spatialMode ? 'rgba(var(--accent-primary-rgb, 88, 101, 242), 0.15)' : 'var(--bg-tertiary)',
                                            border: spatialMode ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: spatialMode ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                                        }}
                                    >
                                        <Compass size={16} /> Spatial
                                    </button>

                                    {/* Noise Suppression */}
                                    <button
                                        onClick={handleToggleNoiseSuppression}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                                            background: noiseSuppression ? 'rgba(var(--accent-primary-rgb, 88, 101, 242), 0.15)' : 'var(--bg-tertiary)',
                                            border: noiseSuppression ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: noiseSuppression ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                        Noise
                                    </button>

                                    {/* Recording */}
                                    <button
                                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                                            background: isRecording ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-tertiary)',
                                            border: isRecording ? '1px solid var(--error)' : '1px solid var(--stroke)',
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: isRecording ? 'var(--error)' : 'var(--text-secondary)',
                                            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                                        }}
                                    >
                                        <div style={{
                                            width: isRecording ? '8px' : '10px', height: isRecording ? '8px' : '10px',
                                            borderRadius: isRecording ? '2px' : '50%', background: isRecording ? 'var(--error)' : 'var(--error)', flexShrink: 0,
                                            animation: isRecording ? 'speakingPulse 1.2s ease-in-out infinite' : 'none',
                                        }} />
                                        {isRecording ? `Stop (${Math.floor(recordingDuration / 60)}:${(recordingDuration % 60).toString().padStart(2, '0')})` : 'Record'}
                                    </button>

                                    {/* Volume Settings */}
                                    <button
                                        onClick={() => { setShowVolumePanel(!showVolumePanel); setShowMoreControls(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                                            background: showVolumePanel ? 'rgba(var(--accent-primary-rgb, 88, 101, 242), 0.15)' : 'var(--bg-tertiary)',
                                            border: showVolumePanel ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: showVolumePanel ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                                        }}
                                    >
                                        <Settings size={16} /> Volume
                                    </button>

                                    {/* Connection Panel Toggle */}
                                    <button
                                        onClick={() => setShowConnectionPanel(!showConnectionPanel)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                                            background: showConnectionPanel ? 'rgba(var(--accent-primary-rgb, 88, 101, 242), 0.15)' : 'var(--bg-tertiary)',
                                            border: showConnectionPanel ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: showConnectionPanel ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                                        }}
                                    >
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: localParticipant ? getQualityColor(localParticipant.connectionQuality) : '#43b581' }} />
                                        <Wifi size={16} /> Connection
                                    </button>

                                    {/* Soundboard */}
                                    <button
                                        onClick={() => { setShowSoundboard(!showSoundboard); setShowMoreControls(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                                            background: showSoundboard ? 'rgba(var(--accent-primary-rgb, 88, 101, 242), 0.15)' : 'var(--bg-tertiary)',
                                            border: showSoundboard ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                            color: showSoundboard ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                                        }}
                                    >
                                        <Music size={16} /> Soundboard
                                    </button>
                                </div>

                                {/* Collapsible Connection Panel */}
                                {showConnectionPanel && (
                                    <div style={{
                                        marginTop: '12px',
                                        padding: '12px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--stroke)',
                                    }}>
                                        <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.05em' }}>Connection Status</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {/* Connection State */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>State</span>
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: connectionState === LiveKitConnectionState.Connected ? '#43b581' : connectionState === LiveKitConnectionState.Connecting || connectionState === LiveKitConnectionState.Reconnecting ? '#faa61a' : 'var(--error)' }}>
                                                    {getConnectionStateLabel(connectionState)}
                                                </span>
                                            </div>
                                            {/* Local Connection Quality */}
                                            {localParticipant && (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Quality</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Wifi size={12} style={{ color: getQualityColor(localParticipant.connectionQuality) }} />
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: getQualityColor(localParticipant.connectionQuality) }}>
                                                            {getQualityLabel(localParticipant.connectionQuality)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {/* RTT */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>RTT</span>
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: callRtt !== null && callRtt > 200 ? '#faa61a' : 'var(--text-primary)' }}>
                                                    {callRtt !== null ? `${callRtt}ms` : '—'}
                                                </span>
                                            </div>
                                            {/* Packet Loss */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Packet Loss</span>
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: (callPacketLoss ?? 0) > 5 ? '#faa61a' : 'var(--text-primary)' }}>
                                                    {callPacketLoss !== null ? `${callPacketLoss}%` : '—'}
                                                </span>
                                            </div>
                                            {/* Network Hint */}
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4', paddingTop: '6px', borderTop: '1px solid var(--stroke)' }}>
                                                Experiencing issues? Check your network connection or try switching networks.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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

                    @keyframes speakingGlow {
                        0% { box-shadow: 0 0 0 3px #43b581, 0 0 20px rgba(67, 181, 129, 0.4); }
                        50% { box-shadow: 0 0 0 4px #43b581, 0 0 30px rgba(67, 181, 129, 0.6); }
                        100% { box-shadow: 0 0 0 3px #43b581, 0 0 20px rgba(67, 181, 129, 0.4); }
                    }

                    .speaking-card {
                        animation: speakingGlow 1.5s ease-in-out infinite;
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
                    ...(isMobile ? {
                        position: 'fixed', top: 0, right: 0, bottom: 0, left: 0,
                        width: '100%', zIndex: 500,
                        background: 'var(--bg-primary)',
                    } : {
                        position: 'absolute', top: '56px', right: 0, bottom: 0, width: `${chatWidth}px`,
                        background: 'var(--bg-primary)', borderLeft: '1px solid var(--stroke)',
                    }),
                    display: 'flex', flexDirection: 'column', zIndex: isMobile ? 500 : 15,
                }}>
                    {/* Drag handle for resizing (I4) */}
                    {!isMobile && (
                        <div
                            onMouseDown={() => { chatDraggingRef.current = true; }}
                            style={{
                                position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px',
                                cursor: 'col-resize', zIndex: 20,
                                background: 'transparent', transition: 'background 0.15s',
                            }}
                            className="hover-bg-accent"
                        />
                    )}
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
            {/* Reconnect overlay */}
            {connectionState === LiveKitConnectionState.Reconnecting && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 50,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '16px',
                }}>
                    <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: '#faa61a' }} />
                    <p style={{ color: '#faa61a', fontSize: '18px', fontWeight: 600 }}>Reconnecting...</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Hold tight, restoring your connection</p>
                </div>
            )}
        </main>
    );
};

export default VoiceChannel;
