/**
 * LiveKit WebRTC Hook for Voice/Video Calls
 * Handles room connection, audio/video tracks, and participant management
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  Participant,
  RemoteParticipant,
  RemoteTrack,
  ConnectionState,
  LoggerNames,
  setLogLevel,
} from 'livekit-client';
import { api } from './api';
import { isNoiseSuppressionSupported, createNoiseSuppressionStream } from './noise-suppression';
import {
  captureElectronScreenTracks,
  isGratoniteDesktopApp,
  pickDefaultElectronScreenSourceId,
} from './electronScreenCapture';

// Suppress expected "abort transport/connection attempt" warnings that occur
// when users intentionally disconnect during in-flight WebRTC setup.
setLogLevel('error', LoggerNames.Engine);
setLogLevel('error', LoggerNames.PCTransport);

export type StreamQuality = 'low' | 'medium' | 'high' | 'source';

const QUALITY_PRESETS: Record<StreamQuality, { maxBitrate: number; maxFramerate: number } | undefined> = {
  low:    { maxBitrate: 500_000,   maxFramerate: 15 },
  medium: { maxBitrate: 1_500_000, maxFramerate: 30 },
  high:   { maxBitrate: 4_000_000, maxFramerate: 60 },
  source: undefined,
};

// Participant info with real-time state
export interface LiveKitParticipant {
  id: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  audioLevel: number;
  connectionQuality: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  videoTrack?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  screenTrack?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  audioTrack?: any;
}

export interface UseLiveKitOptions {
  channelId: string;
  onParticipantJoined?: (participant: LiveKitParticipant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onSpeakingChanged?: (participantId: string, speaking: boolean) => void;
  onAudioTrackSubscribed?: (participantId: string, track: MediaStreamTrack, detach: () => void) => void;
  onAudioTrackUnsubscribed?: (participantId: string) => void;
}

export interface UseLiveKitReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  connectionState: ConnectionState;

  // Local user state
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;

  // Participants
  participants: LiveKitParticipant[];
  localParticipant: LiveKitParticipant | null;

  // Devices
  audioInputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  selectedAudioInputId: string | null;
  selectedVideoInputId: string | null;

  // Stream quality
  streamQuality: StreamQuality;
  setStreamQuality: (quality: StreamQuality) => void;

  // Noise suppression
  noiseSuppressionEnabled: boolean;
  toggleNoiseSuppression: () => Promise<void>;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
  toggleCamera: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  setMasterVolume: (volume: number) => void;
  setParticipantVolume: (participantId: string, volume: number) => void;
  refreshDevices: () => Promise<void>;
  selectAudioInput: (deviceId: string) => Promise<void>;
  selectVideoInput: (deviceId: string) => Promise<void>;

  // Room ref for spatial audio integration
  roomRef: React.RefObject<Room | null>;
}

const PREFERRED_AUDIO_INPUT_KEY = 'voice.preferredAudioInputId';
const PREFERRED_VIDEO_INPUT_KEY = 'voice.preferredVideoInputId';

export function useLiveKit(options: UseLiveKitOptions): UseLiveKitReturn {
  const { channelId, onParticipantJoined, onParticipantLeft, onSpeakingChanged, onAudioTrackSubscribed, onAudioTrackUnsubscribed } = options;

  // Room reference
  const roomRef = useRef<Room | null>(null);
  // Monotonic connect attempt id to ignore stale async callbacks/errors.
  const connectAttemptRef = useRef(0);
  // True when the user explicitly clicked disconnect (vs component unmounting due to navigation)
  const intentionalDisconnectRef = useRef(false);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);

  // Local user state
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Noise suppression
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(
    () => localStorage.getItem('noiseSuppression') === 'true',
  );

  // Stream quality
  const [streamQuality, setStreamQuality] = useState<StreamQuality>('medium');

  // Participants
  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LiveKitParticipant | null>(null);

  // Media devices
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState<string | null>(null);
  const [selectedVideoInputId, setSelectedVideoInputId] = useState<string | null>(null);
  const selectedAudioInputIdRef = useRef<string | null>(null);
  const selectedVideoInputIdRef = useRef<string | null>(null);

  // Volume control
  const volumesRef = useRef<Map<string, number>>(new Map());
  const masterVolumeRef = useRef(100);

  // Store callbacks in refs so they don't destabilize `connect`
  const onParticipantJoinedRef = useRef(onParticipantJoined);
  const onParticipantLeftRef = useRef(onParticipantLeft);
  const onSpeakingChangedRef = useRef(onSpeakingChanged);
  const onAudioTrackSubscribedRef = useRef(onAudioTrackSubscribed);
  const onAudioTrackUnsubscribedRef = useRef(onAudioTrackUnsubscribed);
  useEffect(() => { onParticipantJoinedRef.current = onParticipantJoined; }, [onParticipantJoined]);
  useEffect(() => { onParticipantLeftRef.current = onParticipantLeft; }, [onParticipantLeft]);
  useEffect(() => { onSpeakingChangedRef.current = onSpeakingChanged; }, [onSpeakingChanged]);
  useEffect(() => { onAudioTrackSubscribedRef.current = onAudioTrackSubscribed; }, [onAudioTrackSubscribed]);
  useEffect(() => { onAudioTrackUnsubscribedRef.current = onAudioTrackUnsubscribed; }, [onAudioTrackUnsubscribed]);

  const isDeviceNotFoundError = useCallback((err: unknown): boolean => {
    if (err instanceof DOMException) {
      return err.name === 'NotFoundError' || err.name === 'OverconstrainedError';
    }
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    return message.includes('notfounderror') || message.includes('requested device not found');
  }, []);

  const getFirstMediaDeviceId = useCallback(async (kind: MediaDeviceKind): Promise<string | undefined> => {
    if (!navigator.mediaDevices?.enumerateDevices) return undefined;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.find((device) => device.kind === kind)?.deviceId;
  }, []);

  const persistDeviceId = useCallback((storageKey: string, deviceId: string | null) => {
    if (!deviceId) return;
    try {
      localStorage.setItem(storageKey, deviceId);
    } catch {
      // Ignore storage failures
    }
  }, []);

  const readStoredDeviceId = useCallback((storageKey: string): string | null => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }, []);

  const refreshDevices = useCallback(async (): Promise<void> => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((device) => device.kind === 'audioinput');
    const videoInputs = devices.filter((device) => device.kind === 'videoinput');

    setAudioInputDevices(audioInputs);
    setVideoInputDevices(videoInputs);

    const storedAudioId = readStoredDeviceId(PREFERRED_AUDIO_INPUT_KEY);
    const storedVideoId = readStoredDeviceId(PREFERRED_VIDEO_INPUT_KEY);

    const nextAudioId = audioInputs.some((device) => device.deviceId === storedAudioId)
      ? storedAudioId
      : (audioInputs[0]?.deviceId ?? null);
    const nextVideoId = videoInputs.some((device) => device.deviceId === storedVideoId)
      ? storedVideoId
      : (videoInputs[0]?.deviceId ?? null);

    setSelectedAudioInputId(nextAudioId);
    setSelectedVideoInputId(nextVideoId);
    selectedAudioInputIdRef.current = nextAudioId;
    selectedVideoInputIdRef.current = nextVideoId;

    if (nextAudioId) persistDeviceId(PREFERRED_AUDIO_INPUT_KEY, nextAudioId);
    if (nextVideoId) persistDeviceId(PREFERRED_VIDEO_INPUT_KEY, nextVideoId);
  }, [persistDeviceId, readStoredDeviceId]);

  const selectAudioInput = useCallback(async (deviceId: string): Promise<void> => {
    setSelectedAudioInputId(deviceId);
    selectedAudioInputIdRef.current = deviceId;
    persistDeviceId(PREFERRED_AUDIO_INPUT_KEY, deviceId);

    const room = roomRef.current;
    if (!room) return;
    await room.switchActiveDevice('audioinput', deviceId);
  }, [persistDeviceId]);

  const selectVideoInput = useCallback(async (deviceId: string): Promise<void> => {
    setSelectedVideoInputId(deviceId);
    selectedVideoInputIdRef.current = deviceId;
    persistDeviceId(PREFERRED_VIDEO_INPUT_KEY, deviceId);

    const room = roomRef.current;
    if (!room) return;
    await room.switchActiveDevice('videoinput', deviceId);
  }, [persistDeviceId]);

  // Helper to convert participant to our format
  const participantToInfo = useCallback((
    participant: Participant,
    _isLocal: boolean = false
  ): LiveKitParticipant => {
    const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
    const videoPublication = participant.getTrackPublication(Track.Source.Camera);
    const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare);
    const screenAudioPublication = participant.getTrackPublication(Track.Source.ScreenShareAudio);
    
    return {
      id: participant.identity,
      name: participant.name || participant.identity,
      isSpeaking: participant.isSpeaking,
      isMuted: audioPublication?.isMuted ?? true,
      isDeafened: false, // LiveKit doesn't track deafen state
      isCameraOn: Boolean(videoPublication?.track) && !(videoPublication?.isMuted ?? false),
      isScreenSharing:
        Boolean(screenPublication?.track) ||
        Boolean(screenAudioPublication?.track) ||
        !(screenPublication?.isMuted ?? true),
      audioLevel: participant.audioLevel,
      connectionQuality: participant.connectionQuality,
      videoTrack: videoPublication?.track ?? undefined,
      screenTrack: screenPublication?.track ?? undefined,
      audioTrack: audioPublication?.track ?? undefined,
    };
  }, []);

  // Update all participants
  const updateParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    
    const remoteParticipants: LiveKitParticipant[] = [];
    room.remoteParticipants.forEach((participant) => {
      remoteParticipants.push(participantToInfo(participant, false));
    });
    
    setParticipants(remoteParticipants);
    
    if (room.localParticipant) {
      setLocalParticipant(participantToInfo(room.localParticipant, true));
    }
  }, [participantToInfo]);

  // Connect to LiveKit room
  const connect = useCallback(async () => {
    if (roomRef.current?.state === ConnectionState.Connected ||
        roomRef.current?.state === ConnectionState.Connecting) {
      return;
    }

    // Reset the intentional disconnect flag so navigation-triggered unmounts
    // won't tear down this fresh connection.
    intentionalDisconnectRef.current = false;

    if (!channelId) {
      const unresolvedMessage = 'Call channel unavailable. Re-open the conversation and retry.';
      setConnectionError(unresolvedMessage);
      throw new Error(unresolvedMessage);
    }
    
    setIsConnecting(true);
    setConnectionError(null);
    setConnectionState(ConnectionState.Connecting);
    const attemptId = ++connectAttemptRef.current;
    
    try {
      // Get LiveKit token from API
      const { token, endpoint } = await api.voice.join(channelId, {
        selfMute: isMuted,
        selfDeaf: isDeafened,
      });

      let musicMode = false;
      try {
        musicMode = localStorage.getItem('voiceMusicMode') === 'true';
      } catch {
        musicMode = false;
      }
      
      // Create new room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 30 },
        },
        audioCaptureDefaults: {
          echoCancellation: !musicMode,
          noiseSuppression: !musicMode,
          autoGainControl: !musicMode,
        },
      });
      
      roomRef.current = room;

      // Set up event handlers
      room.on(RoomEvent.Connected, () => {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionState(ConnectionState.Connected);
        updateParticipants();
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionState(ConnectionState.Disconnected);
        setParticipants([]);
        setLocalParticipant(null);
        setIsMuted(true);
        setIsDeafened(false);
        setIsCameraOn(false);
        setIsScreenSharing(false);
      });

      room.on(RoomEvent.Reconnecting, () => {
        setConnectionState(ConnectionState.Reconnecting);
      });

      room.on(RoomEvent.Reconnected, () => {
        setConnectionState(ConnectionState.Connected);
      });
      
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        const info = participantToInfo(participant, false);
        onParticipantJoinedRef.current?.(info);
        updateParticipants();
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        onParticipantLeftRef.current?.(participant.identity);
        updateParticipants();
      });
      
      room.on(RoomEvent.TrackSubscribed, (
        track: RemoteTrack,
        _publication: unknown,
        participant: RemoteParticipant
      ) => {
        if (track.kind === Track.Kind.Audio && track.mediaStreamTrack) {
          onAudioTrackSubscribedRef.current?.(participant.identity, track.mediaStreamTrack, () => track.detach());
        }
        updateParticipants();
      });

      room.on(RoomEvent.TrackUnsubscribed, (
        track: RemoteTrack,
        _publication: unknown,
        participant: RemoteParticipant
      ) => {
        if (track.kind === Track.Kind.Audio) {
          onAudioTrackUnsubscribedRef.current?.(participant.identity);
        }
        updateParticipants();
      });
      
      room.on(RoomEvent.TrackMuted, () => {
        updateParticipants();
      });
      
      room.on(RoomEvent.TrackUnmuted, () => {
        updateParticipants();
      });
      
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const speakerIds = new Set(speakers.map(s => s.identity));
        
        setParticipants(prev => prev.map(p => {
          const wasSpeaking = p.isSpeaking;
          const nowSpeaking = speakerIds.has(p.id);
          
          if (wasSpeaking !== nowSpeaking) {
            onSpeakingChangedRef.current?.(p.id, nowSpeaking);
          }
          
          return { ...p, isSpeaking: nowSpeaking };
        }));
        
        // Update local participant speaking state
        if (room.localParticipant) {
          const localSpeaking = speakerIds.has(room.localParticipant.identity);
          setLocalParticipant(prev => prev ? { ...prev, isSpeaking: localSpeaking } : null);
        }
      });
      
      room.on(RoomEvent.ConnectionQualityChanged, () => {
        updateParticipants();
      });
      
      // Connect to room — give LiveKit SDK time to retry regions (45s)
      const connectTimeout = setTimeout(() => {
        if (attemptId !== connectAttemptRef.current || roomRef.current !== room) return;
        setIsConnecting(false);
        setConnectionError('Voice connection timed out. The voice server may be unavailable.');
        room.disconnect();
        roomRef.current = null;
      }, 45000);

      try {
        await room.connect(endpoint, token);
        clearTimeout(connectTimeout);
        if (attemptId !== connectAttemptRef.current || roomRef.current !== room) {
          return;
        }
      } catch (connectErr) {
        clearTimeout(connectTimeout);
        if (attemptId !== connectAttemptRef.current || roomRef.current !== room) {
          return;
        }
        throw connectErr;
      }
      await refreshDevices();

      const preferredAudioInputId = selectedAudioInputIdRef.current;
      if (preferredAudioInputId) {
        try {
          await room.switchActiveDevice('audioinput', preferredAudioInputId);
        } catch {
          // Ignore; SDK fallback device remains active
        }
      }

      const preferredVideoInputId = selectedVideoInputIdRef.current;
      if (preferredVideoInputId) {
        try {
          await room.switchActiveDevice('videoinput', preferredVideoInputId);
        } catch {
          // Ignore; SDK fallback device remains active
        }
      }
      
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Failed to connect to voice channel';
      if (message.includes('signal connection') || message.includes('WebSocket')) {
        message = 'Could not connect to voice server. Check your connection and try again.';
      }
      setConnectionError(message);
      setIsConnecting(false);
      setConnectionState(ConnectionState.Disconnected);
      throw err;
    }
  }, [channelId, isMuted, isDeafened, participantToInfo, updateParticipants, refreshDevices]);

  // Disconnect from room
  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    // Invalidate any in-flight connect attempt callbacks.
    connectAttemptRef.current += 1;
    const room = roomRef.current;
    if (!room) {
      setIsConnecting(false);
      setIsMuted(true);
      setIsDeafened(false);
      setIsCameraOn(false);
      setIsScreenSharing(false);
      return;
    }
    
    try {
      await api.voice.leave();
    } catch {
      // Ignore API errors during disconnect
    }
    
    room.disconnect();
    roomRef.current = null;

    setIsConnected(false);
    setIsConnecting(false);
    setConnectionError(null);
    setConnectionState(ConnectionState.Disconnected);
    setParticipants([]);
    setLocalParticipant(null);
    setIsMuted(true);
    setIsDeafened(false);
    setIsCameraOn(false);
    setIsScreenSharing(false);
  }, []);

  // Toggle microphone mute
  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const newMuted = !isMuted;
    setIsMuted(newMuted);

    try {
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
    } catch (err) {
      console.warn('[LiveKit] Failed to toggle microphone:', err);
      setIsMuted(!newMuted); // revert on failure
    }

    updateParticipants();
  }, [isMuted, updateParticipants]);

  // Toggle noise suppression
  const toggleNoiseSuppression = useCallback(async () => {
    const next = !noiseSuppressionEnabled;
    setNoiseSuppressionEnabled(next);
    try {
      localStorage.setItem('noiseSuppression', String(next));
    } catch {
      // Ignore storage failures
    }

    // If currently unmuted, re-publish mic with/without noise suppression
    const room = roomRef.current;
    if (!room?.localParticipant) return;
    if (isMuted) return; // mic is off, changes will take effect on next unmute

    try {
      // Disable mic, then re-enable with new processing
      await room.localParticipant.setMicrophoneEnabled(false);

      if (next && isNoiseSuppressionSupported()) {
        // Get raw mic stream and pipe through noise suppression
        const rawStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedAudioInputIdRef.current
            ? { deviceId: { exact: selectedAudioInputIdRef.current } }
            : true,
          video: false,
        });
        const processedStream = await createNoiseSuppressionStream(rawStream);
        const audioTrack = processedStream.getAudioTracks()[0];
        if (audioTrack) {
          const { LocalAudioTrack } = await import('livekit-client');
          const localAudioTrack = new LocalAudioTrack(audioTrack, undefined, false);
          await room.localParticipant.publishTrack(localAudioTrack);
        } else {
          // Fallback to standard enable if no track
          await room.localParticipant.setMicrophoneEnabled(true);
        }
      } else {
        await room.localParticipant.setMicrophoneEnabled(true);
      }
    } catch (err) {
      console.warn('[LiveKit] Failed to re-publish mic with noise suppression:', err);
      // Attempt to restore mic without noise suppression
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch {
        // Ignore
      }
    }
    updateParticipants();
  }, [noiseSuppressionEnabled, isMuted, updateParticipants]);

  // Toggle deafen (client-side only - mutes all incoming audio)
  const toggleDeafen = useCallback(() => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    
    if (newDeafened) {
      setIsMuted(true);
      // Mute local mic when deafening
      const room = roomRef.current;
      if (room?.localParticipant) {
        room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      }
      
      // Mute all remote audio tracks
      room?.remoteParticipants.forEach((participant) => {
        const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
        if (audioPublication?.track?.mediaStreamTrack) {
          audioPublication.track.mediaStreamTrack.enabled = false;
        }
      });
    } else {
      // Restore remote audio
      const room = roomRef.current;
      room?.remoteParticipants.forEach((participant) => {
        const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
        if (audioPublication?.track?.mediaStreamTrack) {
          audioPublication.track.mediaStreamTrack.enabled = true;
        }
      });
    }
  }, [isDeafened]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const newCameraOn = !isCameraOn;
    const preset = QUALITY_PRESETS[streamQuality];
    const opts: Record<string, unknown> = {};
    if (preset) {
      opts.videoEncoding = {
        maxBitrate: preset.maxBitrate,
        maxFramerate: preset.maxFramerate,
      };
    }
    try {
      await room.localParticipant.setCameraEnabled(newCameraOn, newCameraOn ? opts : undefined);
    } catch (err) {
      if (newCameraOn && isDeviceNotFoundError(err)) {
        const fallbackDeviceId = await getFirstMediaDeviceId('videoinput');
        if (!fallbackDeviceId) {
          throw new Error('No camera device found. Connect a camera and retry.');
        }
        await room.localParticipant.setCameraEnabled(true, { deviceId: fallbackDeviceId, ...opts });
      } else {
        throw err;
      }
    }
    setIsCameraOn(newCameraOn);
    updateParticipants();
  }, [isCameraOn, updateParticipants, isDeviceNotFoundError, getFirstMediaDeviceId, streamQuality]);

  // Start screen share
  const startScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const preset = QUALITY_PRESETS[streamQuality];
    const publishOpts: {
      screenShareEncoding?: { maxBitrate: number; maxFramerate: number };
    } = {};
    if (preset) {
      publishOpts.screenShareEncoding = {
        maxBitrate: preset.maxBitrate,
        maxFramerate: preset.maxFramerate,
      };
    }

    // Electron: getDisplayMedia (used by LiveKit by default) is often broken or empty.
    // Use desktopCapturer-backed getUserMedia + publish screen + optional system audio.
    if (isGratoniteDesktopApp() && window.gratoniteDesktop?.getScreenSources) {
      const sourceId = await pickDefaultElectronScreenSourceId();
      if (!sourceId) {
        throw new Error('No screen capture sources available. Restart the app and try again.');
      }
      const hiRes = streamQuality === 'high' || streamQuality === 'source';
      const dims = {
        maxWidth: hiRes ? 1920 : 1280,
        maxHeight: hiRes ? 1080 : 720,
        maxFrameRate: preset?.maxFramerate ?? 30,
      };
      const { video, audio } = await captureElectronScreenTracks(sourceId, dims);
      try {
        await room.localParticipant.publishTrack(video, {
          source: Track.Source.ScreenShare,
          ...publishOpts,
        });
        if (audio) {
          await room.localParticipant.publishTrack(audio, {
            source: Track.Source.ScreenShareAudio,
          });
        }
      } catch (pubErr) {
        try {
          await room.localParticipant.setScreenShareEnabled(false);
        } catch {
          /* best-effort cleanup */
        }
        video.stop();
        audio?.stop();
        throw pubErr;
      }
      setIsScreenSharing(true);
      updateParticipants();
      return;
    }

    await room.localParticipant.setScreenShareEnabled(
      true,
      { audio: true },
      Object.keys(publishOpts).length > 0 ? publishOpts : undefined,
    );
    setIsScreenSharing(true);
    updateParticipants();
  }, [updateParticipants, streamQuality]);

  // Stop screen share
  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    try {
      await room.localParticipant.setScreenShareEnabled(false);
      setIsScreenSharing(false);
      updateParticipants();
    } catch (err) {
      console.warn('Failed to stop screen share:', err);
    }
  }, [updateParticipants]);

  // Re-apply encoding when streamQuality changes while actively publishing
  const prevQualityRef = useRef(streamQuality);
  useEffect(() => {
    if (prevQualityRef.current === streamQuality) return;
    prevQualityRef.current = streamQuality;

    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const preset = QUALITY_PRESETS[streamQuality];

    // Re-publish camera with new encoding
    if (isCameraOn) {
      const opts: Record<string, unknown> = {};
      if (preset) {
        opts.videoEncoding = { maxBitrate: preset.maxBitrate, maxFramerate: preset.maxFramerate };
      }
      room.localParticipant.setCameraEnabled(false).then(() =>
        room.localParticipant.setCameraEnabled(true, opts)
      ).then(() => updateParticipants()).catch(console.warn);
    }

    // Screen share: re-enabling would trigger the browser picker again,
    // so new quality only applies on next screen share start.
  }, [streamQuality, isCameraOn, updateParticipants]);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    masterVolumeRef.current = Math.max(0, Math.min(200, volume));
    
    // Apply to all participants without individual volume set
    const room = roomRef.current;
    room?.remoteParticipants.forEach((participant) => {
      if (!volumesRef.current.has(participant.identity)) {
        const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
        if (audioPublication?.track?.mediaStreamTrack) {
          // Note: Actual volume control requires WebAudio API GainNode
          // This is a simplified version
        }
      }
    });
  }, []);

  // Set individual participant volume
  const setParticipantVolume = useCallback((participantId: string, volume: number) => {
    volumesRef.current.set(participantId, Math.max(0, Math.min(200, volume)));
    
    const room = roomRef.current;
    const participant = room?.remoteParticipants.get(participantId);
    if (participant) {
      const audioPublication = participant.getTrackPublication(Track.Source.Microphone);
      if (audioPublication?.track?.mediaStreamTrack) {
        // Note: Actual volume control requires WebAudio API GainNode
      }
    }
  }, []);

  // Cleanup: disconnect when component unmounts
  useEffect(() => {
    const handleDeviceChange = () => {
      void refreshDevices();
    };

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }
    void refreshDevices();

    return () => {
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  }, [refreshDevices]);

  useEffect(() => {
    return () => {
      // Only tear down the LiveKit room if the user explicitly disconnected
      // (e.g. clicked "Leave Voice"). When the component unmounts because of
      // navigation to a text channel, we keep the room alive so VoiceBar
      // stays connected and re-mounting VoiceChannel can resume seamlessly.
      if (intentionalDisconnectRef.current) {
        connectAttemptRef.current += 1;
        api.voice.leave().catch(() => {});
        const room = roomRef.current;
        if (room) {
          room.disconnect();
          roomRef.current = null;
        }
        intentionalDisconnectRef.current = false;
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    connectionError,
    connectionState,
    isMuted,
    isDeafened,
    isCameraOn,
    isScreenSharing,
    noiseSuppressionEnabled,
    toggleNoiseSuppression,
    streamQuality,
    setStreamQuality,
    participants,
    localParticipant,
    audioInputDevices,
    videoInputDevices,
    selectedAudioInputId,
    selectedVideoInputId,
    connect,
    disconnect,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    setMasterVolume,
    setParticipantVolume,
    refreshDevices,
    selectAudioInput,
    selectVideoInput,
    roomRef,
  };
}
