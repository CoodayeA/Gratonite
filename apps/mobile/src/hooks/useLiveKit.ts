/**
 * LiveKit React Native hook for voice channels.
 * Adapted from the web useLiveKit — stripped of browser-only APIs
 * (device enumeration, screen share, noise suppression, spatial audio).
 *
 * livekit-client is lazy-loaded to avoid crashing in Expo Go / simulator
 * builds where native WebRTC modules aren't linked.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { voice as voiceApi } from '../lib/api';

// Lazy-load livekit-client to avoid crashing when native modules aren't linked.
// The module name is split to prevent Metro from statically resolving the require.
let _lk: typeof import('livekit-client') | null = null;
const _lkModuleName = ['livekit', 'client'].join('-');
function getLiveKit() {
  if (!_lk) {
    try {
      _lk = require(_lkModuleName);
    } catch {
      return null;
    }
  }
  return _lk;
}

type Room = import('livekit-client').Room;
type Participant = import('livekit-client').Participant;
type RemoteParticipant = import('livekit-client').RemoteParticipant;

export interface LiveKitParticipant {
  id: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  audioLevel: number;
}

export interface UseLiveKitOptions {
  channelId: string;
  onParticipantJoined?: (participant: LiveKitParticipant) => void;
  onParticipantLeft?: (participantId: string) => void;
  onSpeakingChanged?: (participantId: string, speaking: boolean) => void;
}

export interface UseLiveKitReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  participants: LiveKitParticipant[];
  localParticipant: LiveKitParticipant | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleDeafen: () => void;
}

export function useLiveKit(options: UseLiveKitOptions): UseLiveKitReturn {
  const { channelId, onParticipantJoined, onParticipantLeft, onSpeakingChanged } = options;

  const roomRef = useRef<Room | null>(null);
  const connectAttemptRef = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isDeafened, setIsDeafened] = useState(false);
  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LiveKitParticipant | null>(null);

  // Stable refs for callbacks
  const onParticipantJoinedRef = useRef(onParticipantJoined);
  const onParticipantLeftRef = useRef(onParticipantLeft);
  const onSpeakingChangedRef = useRef(onSpeakingChanged);
  useEffect(() => { onParticipantJoinedRef.current = onParticipantJoined; }, [onParticipantJoined]);
  useEffect(() => { onParticipantLeftRef.current = onParticipantLeft; }, [onParticipantLeft]);
  useEffect(() => { onSpeakingChangedRef.current = onSpeakingChanged; }, [onSpeakingChanged]);

  const participantToInfo = useCallback((p: Participant): LiveKitParticipant => {
    const lk = getLiveKit();
    const audioPublication = lk ? p.getTrackPublication(lk.Track.Source.Microphone) : null;
    return {
      id: p.identity,
      name: p.name || p.identity,
      isSpeaking: p.isSpeaking,
      isMuted: audioPublication?.isMuted ?? true,
      audioLevel: p.audioLevel,
    };
  }, []);

  const updateParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const remote: LiveKitParticipant[] = [];
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      remote.push(participantToInfo(p));
    });
    setParticipants(remote);

    if (room.localParticipant) {
      setLocalParticipant(participantToInfo(room.localParticipant));
    }
  }, [participantToInfo]);

  const connect = useCallback(async () => {
    const lk = getLiveKit();
    if (!lk) {
      setConnectionError('Voice is not available in this build.');
      return;
    }

    if (roomRef.current?.state === lk.ConnectionState.Connected ||
        roomRef.current?.state === lk.ConnectionState.Connecting) {
      return;
    }

    if (!channelId) {
      setConnectionError('Voice channel unavailable.');
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);
    const attemptId = ++connectAttemptRef.current;

    try {
      const { token, endpoint } = await voiceApi.join(channelId, true, false);

      const room = new lk.Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      roomRef.current = room;

      room.on(lk.RoomEvent.Connected, () => {
        if (attemptId !== connectAttemptRef.current) return;
        setIsConnected(true);
        setIsConnecting(false);
        updateParticipants();
      });

      room.on(lk.RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        setParticipants([]);
        setLocalParticipant(null);
        setIsMuted(true);
        setIsDeafened(false);
      });

      room.on(lk.RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        const info = participantToInfo(participant);
        onParticipantJoinedRef.current?.(info);
        updateParticipants();
      });

      room.on(lk.RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        onParticipantLeftRef.current?.(participant.identity);
        updateParticipants();
      });

      room.on(lk.RoomEvent.TrackSubscribed, () => updateParticipants());
      room.on(lk.RoomEvent.TrackUnsubscribed, () => updateParticipants());
      room.on(lk.RoomEvent.TrackMuted, () => updateParticipants());
      room.on(lk.RoomEvent.TrackUnmuted, () => updateParticipants());

      room.on(lk.RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const speakerIds = new Set(speakers.map(s => s.identity));

        setParticipants(prev => prev.map(p => {
          const wasSpeaking = p.isSpeaking;
          const nowSpeaking = speakerIds.has(p.id);
          if (wasSpeaking !== nowSpeaking) {
            onSpeakingChangedRef.current?.(p.id, nowSpeaking);
          }
          return { ...p, isSpeaking: nowSpeaking };
        }));

        if (room.localParticipant) {
          const localSpeaking = speakerIds.has(room.localParticipant.identity);
          setLocalParticipant(prev => prev ? { ...prev, isSpeaking: localSpeaking } : null);
        }
      });

      // Connection timeout
      const connectTimeout = setTimeout(() => {
        if (attemptId !== connectAttemptRef.current || roomRef.current !== room) return;
        setIsConnecting(false);
        setConnectionError('Voice connection timed out.');
        room.disconnect();
        roomRef.current = null;
      }, 30000);

      try {
        await room.connect(endpoint, token);
        clearTimeout(connectTimeout);
        if (attemptId !== connectAttemptRef.current) return;
      } catch (connectErr) {
        clearTimeout(connectTimeout);
        if (attemptId !== connectAttemptRef.current) return;
        throw connectErr;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect to voice channel';
      setConnectionError(message);
      setIsConnecting(false);
    }
  }, [channelId, participantToInfo, updateParticipants]);

  const disconnect = useCallback(async () => {
    connectAttemptRef.current += 1;
    const room = roomRef.current;
    if (!room) {
      setIsConnecting(false);
      setIsMuted(true);
      setIsDeafened(false);
      return;
    }

    try {
      await voiceApi.leave();
    } catch {
      // Ignore API errors during disconnect
    }

    room.disconnect();
    roomRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionError(null);
    setParticipants([]);
    setLocalParticipant(null);
    setIsMuted(true);
    setIsDeafened(false);
  }, []);

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;

    const newMuted = !isMutedRef.current;
    setIsMuted(newMuted);

    try {
      await room.localParticipant.setMicrophoneEnabled(!newMuted);
    } catch {
      setIsMuted(!newMuted); // revert on failure
    }
    updateParticipants();
  }, [updateParticipants]);

  const toggleDeafen = useCallback(() => {
    const lk = getLiveKit();
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);

    if (newDeafened) {
      setIsMuted(true);
      const room = roomRef.current;
      if (room?.localParticipant) {
        room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      }
      // Mute all remote audio tracks
      if (lk) {
        room?.remoteParticipants.forEach((participant: RemoteParticipant) => {
          const audioPublication = participant.getTrackPublication(lk.Track.Source.Microphone);
          if (audioPublication?.track?.mediaStreamTrack) {
            audioPublication.track.mediaStreamTrack.enabled = false;
          }
        });
      }
    } else {
      // Restore remote audio
      const room = roomRef.current;
      if (lk) {
        room?.remoteParticipants.forEach((participant: RemoteParticipant) => {
          const audioPublication = participant.getTrackPublication(lk.Track.Source.Microphone);
          if (audioPublication?.track?.mediaStreamTrack) {
            audioPublication.track.mediaStreamTrack.enabled = true;
          }
        });
      }
    }
  }, [isDeafened]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectAttemptRef.current += 1;
      voiceApi.leave().catch(() => {});
      const room = roomRef.current;
      if (room) {
        room.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    connectionError,
    isMuted,
    isDeafened,
    participants,
    localParticipant,
    connect,
    disconnect,
    toggleMute,
    toggleDeafen,
  };
}
