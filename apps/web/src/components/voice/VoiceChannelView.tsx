import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RoomEvent, Track, type RemoteTrack, type Track as LiveKitTrack, type TrackPublication, type RemoteParticipant } from 'livekit-client';
import { useCallStore } from '@/stores/call.store';
import { useVoiceStore } from '@/stores/voice.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { joinVoiceChannel, leaveVoiceChannel, toggleMute, toggleVideo, toggleScreenShare, setAudioInputDevice, setVideoInputDevice } from '@/lib/dmCall';
import { api } from '@/lib/api';
import { getUserMediaWithFallback, mapMediaError } from '@/lib/media';
import { cacheSoundboardSounds, playSoundboardClip, resolveEntranceSoundIdForGuild } from '@/lib/soundboard';
import { readSoundboardPrefs, subscribeSoundboardPrefs, updateSoundboardPrefs } from '@/lib/soundboardPrefs';
import { MessageList } from '@/components/messages/MessageList';
import { MessageComposer } from '@/components/messages/MessageComposer';
import { TypingIndicator } from '@/components/messages/TypingIndicator';
import type { VoiceState } from '@gratonite/types';
import { useAuthStore } from '@/stores/auth.store';

interface VoiceChannelViewProps {
  channelId: string;
  channelName: string;
}

const EMPTY_STATES: VoiceState[] = [];

export function VoiceChannelView({ channelId, channelName }: VoiceChannelViewProps) {
  const callStatus = useCallStore((s) => s.status);
  const callChannelId = useCallStore((s) => s.channelId);
  const callError = useCallStore((s) => s.error);
  const muted = useCallStore((s) => s.muted);
  const videoEnabled = useCallStore((s) => s.videoEnabled);
  const screenShareEnabled = useCallStore((s) => s.screenShareEnabled);
  const room = useCallStore((s) => s.room);
  const localVideoTrack = useCallStore((s) => s.localVideoTrack);
  const localScreenTrack = useCallStore((s) => s.localScreenTrack);
  const states = useVoiceStore((s) => s.statesByChannel.get(channelId) ?? EMPTY_STATES);
  const updateVoiceState = useVoiceStore((s) => s.updateVoiceState);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const channel = useChannelsStore((s) => s.channels.get(channelId));
  const guildId = channel?.guildId ?? null;
  const guild = useGuildsStore((s) => (guildId ? s.guilds.get(guildId) : undefined));

  const [showChat, setShowChat] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [gridView, setGridView] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const [soundboardLoading, setSoundboardLoading] = useState(false);
  const [soundboardError, setSoundboardError] = useState('');
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const [soundboardSounds, setSoundboardSounds] = useState<Array<{
    id: string;
    name: string;
    soundHash: string;
    volume: number;
    emojiName?: string | null;
    uploaderId?: string;
  }>>([]);
  const [uploadingSound, setUploadingSound] = useState(false);
  const [newSoundName, setNewSoundName] = useState('');
  const [soundboardFavorites, setSoundboardFavorites] = useState<string[]>(() => readSoundboardPrefs().favorites);
  const soundUploadInputRef = useRef<HTMLInputElement>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [preflightError, setPreflightError] = useState('');
  const [preflightStatus, setPreflightStatus] = useState<'unknown' | 'ready' | 'blocked'>('unknown');
  const [remoteTracks, setRemoteTracks] = useState<
    Array<{ id: string; track: RemoteTrack; kind: 'video' | 'audio'; source: string; participantLabel: string }>
  >([]);
  const [presenceEvents, setPresenceEvents] = useState<Array<{ id: string; text: string }>>([]);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const attemptedAutoJoinRef = useRef<string | null>(null);

  const isConnected = callStatus === 'connected' && callChannelId === channelId;
  const isConnecting = callStatus === 'connecting' && callChannelId === channelId;
  const hasActiveRoom = Boolean(room);
  const voiceCount = states.length;
  const hasAudioInput = audioInputs.length > 0;
  const hasDevices = hasAudioInput || videoInputs.length > 0;
  const entranceSoundId = resolveEntranceSoundIdForGuild(guildId);
  const voiceUserIds = useMemo(() => Array.from(new Set(states.map((state) => String(state.userId)))), [states]);

  const { data: voiceUserSummaries = [] } = useQuery({
    queryKey: ['voice-channel-users', channelId, voiceUserIds],
    queryFn: () => api.users.getSummaries(voiceUserIds),
    enabled: voiceUserIds.length > 0,
    staleTime: 15_000,
  });

  const voiceUserLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    voiceUserSummaries.forEach((u) => {
      map.set(String(u.id), u.displayName || u.username);
    });
    return map;
  }, [voiceUserSummaries]);

  useEffect(() => {
    api.voice.getChannelStates(channelId)
      .then((list) => {
        list.forEach((state: VoiceState) => updateVoiceState(state));
      })
      .catch(() => undefined);
  }, [channelId, updateVoiceState]);

  useEffect(() => {
    if (!room) return;
    function handleSubscribed(track: RemoteTrack, publication: TrackPublication, participant: RemoteParticipant) {
      const trackId = track.sid;
      if (!trackId) return;
      const kind = track.kind === Track.Kind.Video ? 'video' : 'audio';
      const source = String((publication as any).source ?? 'unknown');
      const rawIdentity = participant.identity || 'User';
      const participantLabel = rawIdentity.length > 18 ? `${rawIdentity.slice(0, 18)}…` : rawIdentity;
      setRemoteTracks((prev) => {
        if (prev.some((t) => t.id === trackId)) return prev;
        return [...prev, { id: trackId, track, kind, source, participantLabel }];
      });
    }

    function handleUnsubscribed(track: RemoteTrack) {
      const trackId = track.sid;
      if (!trackId) return;
      setRemoteTracks((prev) => prev.filter((t) => t.id !== trackId));
    }

    room.on(RoomEvent.TrackSubscribed, handleSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleUnsubscribed);
    return () => {
      room.off(RoomEvent.TrackSubscribed, handleSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleUnsubscribed);
      setRemoteTracks([]);
    };
  }, [room]);

  const loadDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const nextAudioInputs = devices.filter((d) => d.kind === 'audioinput');
    const nextVideoInputs = devices.filter((d) => d.kind === 'videoinput');
    const nextAudioOutputs = devices.filter((d) => d.kind === 'audiooutput');
    setAudioInputs(nextAudioInputs);
    setVideoInputs(nextVideoInputs);
    setAudioOutputs(nextAudioOutputs);
    if (nextAudioInputs.length > 0 || nextVideoInputs.length > 0) {
      setPreflightStatus('ready');
    }
    return { nextAudioInputs, nextVideoInputs, nextAudioOutputs };
  }, []);

  useEffect(() => {
    loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
  }, [loadDevices]);

  const requestDeviceAccess = useCallback(async () => {
    setPreflightError('');
    let audioGranted = false;
    try {
      const audioStream = await getUserMediaWithFallback([
        { audio: true, video: false },
      ]);
      audioStream.getTracks().forEach((track) => track.stop());
      audioGranted = true;

      // Camera is optional for voice-channel join; best-effort prompt so labels populate.
      try {
        const videoStream = await getUserMediaWithFallback([
          { audio: false, video: true },
        ]);
        videoStream.getTracks().forEach((track) => track.stop());
      } catch {
        // Non-blocking: microphone readiness is sufficient for voice join.
      }
    } catch (err: any) {
      setPreflightError(mapMediaError(err));
    }

    const { nextAudioInputs } = await loadDevices();
    if (audioGranted || nextAudioInputs.length > 0) {
      setPreflightStatus('ready');
      return true;
    }
    setPreflightStatus('blocked');
    return false;
  }, [loadDevices]);

  useEffect(() => {
    if (!selectedMic && audioInputs.length > 0) {
      setSelectedMic(audioInputs[0]!.deviceId);
    }
    if (!selectedCamera && videoInputs.length > 0) {
      setSelectedCamera(videoInputs[0]!.deviceId);
    }
    if (!selectedSpeaker && audioOutputs.length > 0) {
      setSelectedSpeaker(audioOutputs[0]!.deviceId);
    }
  }, [audioInputs, videoInputs, audioOutputs, selectedMic, selectedCamera, selectedSpeaker]);

  const handleJoin = useCallback(async () => {
    if (isConnected || isConnecting) return;
    await joinVoiceChannel(channelId);
    if (!hasAudioInput || preflightStatus !== 'ready') {
      requestDeviceAccess().catch(() => undefined);
    }
  }, [channelId, hasAudioInput, preflightStatus, requestDeviceAccess, isConnected, isConnecting]);

  useEffect(() => {
    if (attemptedAutoJoinRef.current === channelId) return;
    attemptedAutoJoinRef.current = channelId;
    handleJoin().catch(() => undefined);
  }, [channelId, handleJoin]);

  useEffect(() => {
    if (!isConnected) {
      setDevicesOpen(false);
      setMoreOpen(false);
      setSoundboardOpen(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected || (!devicesOpen && !moreOpen && !soundboardOpen)) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.voice-devices-popover') || target.closest('.voice-more-popover') || target.closest('.voice-soundboard-popover')) return;
      if (target.closest('.voice-control-btn')) return;
      setDevicesOpen(false);
      setMoreOpen(false);
      setSoundboardOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [devicesOpen, isConnected, moreOpen, soundboardOpen]);

  const loadSoundboard = useCallback(async () => {
    if (!guildId) return;
    setSoundboardLoading(true);
    setSoundboardError('');
    try {
      const sounds = await api.voice.getSoundboard(guildId);
      const normalized = sounds
        .filter((sound) => sound.available !== false)
        .map((sound) => ({
          id: sound.id,
          name: sound.name,
          soundHash: sound.soundHash,
          volume: sound.volume,
          emojiName: sound.emojiName ?? null,
          uploaderId: sound.uploaderId,
        }));
      setSoundboardSounds(normalized);
      cacheSoundboardSounds(guildId, normalized.map((sound) => ({ ...sound, guildId })));
    } catch (err) {
      setSoundboardError(err instanceof Error ? err.message : 'Failed to load soundboard');
    } finally {
      setSoundboardLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (!soundboardOpen) return;
    loadSoundboard().catch(() => undefined);
  }, [soundboardOpen, loadSoundboard]);

  useEffect(() => subscribeSoundboardPrefs((prefs) => setSoundboardFavorites(prefs.favorites)), []);

  async function handleUploadSound(file: File) {
    if (!guildId) return;
    setUploadingSound(true);
    setSoundboardError('');
    try {
      const upload = await api.files.upload(file, 'upload');
      const soundHash = (() => {
        try {
          const url = new URL(upload.url, window.location.origin);
          return decodeURIComponent(url.pathname.split('/').pop() ?? '');
        } catch {
          return '';
        }
      })();
      if (!soundHash) throw new Error('Unable to resolve sound hash from upload');
      const fallbackName = file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Sound';
      await api.voice.createSoundboard(guildId, {
        name: (newSoundName.trim() || fallbackName).slice(0, 32),
        soundHash,
        volume: 1,
      });
      setNewSoundName('');
      await loadSoundboard();
    } catch (err) {
      setSoundboardError(err instanceof Error ? err.message : 'Failed to upload sound');
    } finally {
      setUploadingSound(false);
      if (soundUploadInputRef.current) soundUploadInputRef.current.value = '';
    }
  }

  useEffect(() => {
    if (!isConnected || !guildId || !entranceSoundId) return;
    const sound = soundboardSounds.find((s) => s.id === entranceSoundId);
    if (!sound) return;
    const timer = window.setTimeout(() => {
      api.voice.playSoundboard(guildId, entranceSoundId).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [isConnected, guildId, entranceSoundId, soundboardSounds]);

  const voiceStatesLabel = useMemo(() => {
    if (voiceCount === 0) return 'No one is currently in voice.';
    if (voiceCount === 1) return '1 person in voice.';
    return `${voiceCount} people in voice.`;
  }, [voiceCount]);

  const orderedSoundboardSounds = useMemo(() => {
    const favoriteSet = new Set(soundboardFavorites);
    return [...soundboardSounds].sort((a, b) => {
      const aFav = favoriteSet.has(a.id) ? 1 : 0;
      const bFav = favoriteSet.has(b.id) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [soundboardFavorites, soundboardSounds]);

  const voiceParticipants = useMemo(
    () => states.map((state) => ({
      userId: String(state.userId),
      label: voiceUserLabelMap.get(String(state.userId)) ?? `User ${String(state.userId).slice(-4)}`,
      muted: Boolean((state as any).mute ?? (state as any).selfMute),
      deafened: Boolean((state as any).deaf ?? (state as any).selfDeaf),
      camera: Boolean((state as any).selfVideo),
      streaming: Boolean((state as any).selfStream),
    })),
    [states, voiceUserLabelMap],
  );

  const roomStatusLabel = useMemo(() => {
    if (isConnected) return 'Connected silently';
    if (isConnecting) return 'Joining room...';
    if (callError && callChannelId === channelId) return 'Connection failed';
    return 'Not connected';
  }, [isConnected, isConnecting, callError, callChannelId, channelId]);

  useEffect(() => {
    const nextIds = new Set(states.map((state) => String(state.userId)));
    const prevIds = previousIdsRef.current;
    if (prevIds.size > 0) {
      const joined: string[] = [];
      const left: string[] = [];
      nextIds.forEach((id) => {
        if (!prevIds.has(id)) joined.push(id);
      });
      prevIds.forEach((id) => {
        if (!nextIds.has(id)) left.push(id);
      });

      const nextEvents = [
        ...joined.map((id) => ({
          id: `join-${id}-${Date.now()}`,
          text: id === currentUserId ? 'You entered the room' : `${voiceUserLabelMap.get(id) ?? `User ${id.slice(-4)}`} joined`,
        })),
        ...left.map((id) => ({
          id: `left-${id}-${Date.now()}`,
          text: id === currentUserId ? 'You left the room' : `${voiceUserLabelMap.get(id) ?? `User ${id.slice(-4)}`} left`,
        })),
      ];

      if (nextEvents.length > 0) {
        setPresenceEvents((prev) => [...nextEvents, ...prev].slice(0, 5));
      }
    }
    previousIdsRef.current = nextIds;
  }, [states, currentUserId, voiceUserLabelMap]);

  return (
    <div className="voice-channel-view">
      <div className="voice-channel-header">
        <div className="voice-channel-header-panel">
          <div className="voice-channel-title-row">
            <div className="voice-channel-title">Chat Room</div>
            <div className="voice-channel-header-badges">
              <span className="voice-channel-badge voice-channel-badge-live">Live</span>
              <span className="voice-channel-badge">{voiceCount} in room</span>
            </div>
          </div>
          <div className="voice-channel-subtitle">{channelName}</div>
          <div className="voice-channel-subtle-status">{roomStatusLabel}</div>
        </div>
        <button className="voice-chat-toggle" onClick={() => setShowChat((prev) => !prev)}>
          {showChat ? 'Hide Chat' : 'Open Chat'}
        </button>
      </div>

      <div className="voice-channel-body">
        <div className="voice-channel-empty">
          {voiceParticipants.length > 0 && (
            <div className="voice-participants-rail" aria-label="People in this room">
              {voiceParticipants.slice(0, 8).map((participant) => (
                <div key={participant.userId} className="voice-participant-pill">
                  <span className="voice-participant-name">{participant.label}</span>
                  <span className="voice-participant-state" aria-hidden="true">
                    {participant.streaming ? '🖥' : participant.camera ? '📷' : participant.deafened ? '🔇' : participant.muted ? '🎙' : '•'}
                  </span>
                </div>
              ))}
              {voiceParticipants.length > 8 && (
                <div className="voice-participant-pill voice-participant-pill-more">
                  +{voiceParticipants.length - 8} more
                </div>
              )}
            </div>
          )}
          <div className="voice-channel-status">{voiceStatesLabel}</div>
          {presenceEvents.length > 0 && (
            <div className="voice-presence-feed" aria-live="polite">
              {presenceEvents.map((entry) => (
                <div key={entry.id} className="voice-presence-item">{entry.text}</div>
              ))}
            </div>
          )}
          {callError && callChannelId === channelId && (
            <div className="voice-channel-error">{callError}</div>
          )}
          {!isConnected && (preflightStatus !== 'ready' || !hasDevices) && (
            <div className="voice-preflight">
              <div className="voice-preflight-title">Microphone optional</div>
              <div className="voice-preflight-subtitle">
                {preflightStatus === 'blocked'
                  ? 'Join works in listen-only mode. Allow microphone permission when you want to speak.'
                  : 'You can join now and enable mic/camera after entering the room.'}
              </div>
              {preflightError && <div className="voice-preflight-error">{preflightError}</div>}
              <button className="voice-preflight-btn" onClick={requestDeviceAccess}>
                Enable Mic/Camera
              </button>
              {preflightStatus === 'ready' && hasDevices && (
                <div className="voice-preflight-selects">
                  <label>
                    Mic
                    <select
                      value={selectedMic}
                      onChange={(e) => {
                        setSelectedMic(e.target.value);
                        setAudioInputDevice(e.target.value);
                      }}
                    >
                      <option value="">Default</option>
                      {audioInputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone'}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Camera
                    <select
                      value={selectedCamera}
                      onChange={(e) => {
                        setSelectedCamera(e.target.value);
                        setVideoInputDevice(e.target.value);
                      }}
                    >
                      <option value="">Default</option>
                      {videoInputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Speaker
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                    >
                      <option value="">Default</option>
                      {audioOutputs.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>{device.label || 'Speaker'}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}
          {!isConnected ? (
            <button className="voice-join voice-join-primary" onClick={handleJoin} disabled={isConnecting}>
              {isConnecting ? 'Connecting…' : 'Join Room Silently'}
            </button>
          ) : (
            <button className="voice-join voice-leave" onClick={() => leaveVoiceChannel()}>
              Leave Call
            </button>
          )}
        </div>

        {showChat && (
          <div className="voice-chat-panel">
            <MessageList
              channelId={channelId}
              emptyTitle="No messages in this voice chat"
              emptySubtitle="Say hello while you wait."
              onReply={() => undefined}
              onOpenEmojiPicker={() => undefined}
              hideIntroEmpty
            />
            <TypingIndicator channelId={channelId} />
            <MessageComposer
              channelId={channelId}
              placeholder={`Message #${channelName}`}
            />
          </div>
        )}
      </div>

      {isConnected && (
        <div className="voice-control-dock">
          <div className="voice-control-group voice-control-group-primary">
            <button
              className={`voice-control-btn voice-control-btn-mic ${muted ? 'is-active' : ''}`}
              onClick={() => toggleMute()}
              aria-pressed={muted}
              disabled={!hasActiveRoom}
              title={!hasActiveRoom ? 'Connecting voice room...' : muted ? 'Unmute microphone' : 'Mute microphone'}
            >
              <span className="voice-btn-label-full">{muted ? 'Unmute' : 'Mute'}</span>
              <span className="voice-btn-label-short">{muted ? 'Unmute' : 'Mute'}</span>
            </button>
            <button
              className={`voice-control-btn voice-control-btn-camera ${videoEnabled ? 'is-active' : ''}`}
              onClick={() => toggleVideo()}
              aria-pressed={videoEnabled}
              disabled={!hasActiveRoom}
              title={!hasActiveRoom ? 'Join must complete before enabling camera' : videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            >
              <span className="voice-btn-label-full">{videoEnabled ? 'Stop Video' : 'Camera'}</span>
              <span className="voice-btn-label-short">{videoEnabled ? 'Video Off' : 'Camera'}</span>
            </button>
            <button
              className={`voice-control-btn voice-control-btn-share ${screenShareEnabled ? 'is-active' : ''}`}
              onClick={() => toggleScreenShare()}
              aria-pressed={screenShareEnabled}
              disabled={!hasActiveRoom}
              title={!hasActiveRoom ? 'Join must complete before screen sharing' : screenShareEnabled ? 'Stop sharing your screen' : 'Start sharing your screen'}
            >
              <span className="voice-btn-label-full">{screenShareEnabled ? 'Stop Share' : 'Share Screen'}</span>
              <span className="voice-btn-label-short">{screenShareEnabled ? 'Share Off' : 'Share'}</span>
            </button>
          </div>
          <div className="voice-control-group voice-control-group-tools">
            <button
              className="voice-control-btn"
              onClick={() => {
                setSoundboardOpen((prev) => !prev);
                setDevicesOpen(false);
                setMoreOpen(false);
              }}
              aria-expanded={soundboardOpen}
              disabled={!hasActiveRoom || !guildId}
              title={!guildId ? 'Soundboard is available in server voice channels' : 'Open soundboard'}
            >
              Soundboard ▾
            </button>
            <button
              className="voice-control-btn"
              onClick={() => setDevicesOpen((prev) => !prev)}
              aria-expanded={devicesOpen}
              disabled={!hasActiveRoom}
            >
              Devices ▾
            </button>
            <button
              className="voice-control-btn"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-expanded={moreOpen}
              disabled={!hasActiveRoom}
            >
              More ▾
            </button>
          </div>

          {devicesOpen && (
            <div className="voice-devices-popover">
              <label>
                Mic
                <select
                  value={selectedMic}
                  onChange={(e) => {
                    setSelectedMic(e.target.value);
                    setAudioInputDevice(e.target.value);
                  }}
                >
                  <option value="">Default</option>
                  {audioInputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone'}</option>
                  ))}
                </select>
              </label>
              <label>
                Speaker
                <select
                  value={selectedSpeaker}
                  onChange={(e) => setSelectedSpeaker(e.target.value)}
                >
                  <option value="">Default</option>
                  {audioOutputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label || 'Speaker'}</option>
                  ))}
                </select>
              </label>
              <label>
                Camera
                <select
                  value={selectedCamera}
                  onChange={(e) => {
                    setSelectedCamera(e.target.value);
                    setVideoInputDevice(e.target.value);
                  }}
                >
                  <option value="">Default</option>
                  {videoInputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {soundboardOpen && (
            <div className="voice-soundboard-popover">
              <div className="voice-soundboard-head">
                <strong>Soundboard</strong>
                <button type="button" className="voice-soundboard-refresh" onClick={() => loadSoundboard().catch(() => undefined)}>
                  Refresh
                </button>
              </div>
              {soundboardLoading ? (
                <div className="voice-soundboard-empty">Loading sounds...</div>
              ) : soundboardError ? (
                <div className="voice-soundboard-error">{soundboardError}</div>
              ) : soundboardSounds.length === 0 ? (
                <div className="voice-soundboard-empty">No sounds configured for this server yet.</div>
              ) : (
                <div className="voice-soundboard-list">
                  {orderedSoundboardSounds.slice(0, 24).map((sound) => (
                    <div key={sound.id} className={`voice-soundboard-item-wrap ${soundboardFavorites.includes(sound.id) ? 'is-favorite' : ''}`}>
                      <button
                        type="button"
                        className="voice-soundboard-item"
                        disabled={playingSoundId === sound.id}
                        onClick={async () => {
                          if (!guildId) return;
                          setPlayingSoundId(sound.id);
                          setSoundboardError('');
                          try {
                            await api.voice.playSoundboard(guildId, sound.id);
                          } catch (err) {
                            setSoundboardError(err instanceof Error ? err.message : 'Failed to play sound');
                          } finally {
                            setPlayingSoundId(null);
                          }
                        }}
                      >
                        <span className="voice-soundboard-item-name">
                          {sound.emojiName ? `${sound.emojiName} ` : ''}{sound.name}
                        </span>
                        <span className="voice-soundboard-item-meta">
                          {playingSoundId === sound.id ? 'Playing...' : `${Math.round((sound.volume ?? 1) * 100)}%`}
                        </span>
                      </button>
                      <div className="voice-soundboard-actions">
                        <button
                          type="button"
                          className={`voice-soundboard-mini ${soundboardFavorites.includes(sound.id) ? 'is-active is-favorite' : 'is-favorite'}`}
                          onClick={() =>
                            updateSoundboardPrefs((current) => {
                              const exists = current.favorites.includes(sound.id);
                              return {
                                ...current,
                                favorites: exists
                                  ? current.favorites.filter((id) => id !== sound.id)
                                  : [sound.id, ...current.favorites].slice(0, 100),
                              };
                            })
                          }
                          title={soundboardFavorites.includes(sound.id) ? 'Remove favorite' : 'Favorite sound'}
                        >
                          <span className="voice-soundboard-mini-label is-favorite">{soundboardFavorites.includes(sound.id) ? '★' : '☆'}</span>
                        </button>
                        <button
                          type="button"
                          className="voice-soundboard-mini"
                          onClick={() => playSoundboardClip(sound)}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className={`voice-soundboard-mini ${entranceSoundId === sound.id ? 'is-active' : ''}`}
                          onClick={() => {
                            if (!guildId) return;
                            updateSoundboardPrefs((current) => ({
                              ...current,
                              entranceByGuild: {
                                ...current.entranceByGuild,
                                [guildId]: current.entranceByGuild[guildId] === sound.id ? null : sound.id,
                              },
                            }));
                          }}
                        >
                          {entranceSoundId === sound.id ? 'Entrance ✓' : 'Entrance'}
                        </button>
                        {currentUserId && (sound.uploaderId === currentUserId || guild?.ownerId === currentUserId) && (
                          <button
                            type="button"
                            className="voice-soundboard-mini danger"
                            onClick={async () => {
                              if (!guildId) return;
                              try {
                                await api.voice.deleteSoundboard(guildId, sound.id);
                                await loadSoundboard();
                              } catch (err) {
                                setSoundboardError(err instanceof Error ? err.message : 'Failed to delete sound');
                              }
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="voice-soundboard-upload">
                <div className="voice-soundboard-upload-row">
                  <input
                    className="voice-soundboard-name-input"
                    type="text"
                    value={newSoundName}
                    onChange={(e) => setNewSoundName(e.target.value)}
                    placeholder="Optional sound name"
                    maxLength={32}
                  />
                  <button
                    type="button"
                    className="voice-soundboard-refresh"
                    disabled={uploadingSound}
                    onClick={() => soundUploadInputRef.current?.click()}
                  >
                    {uploadingSound ? 'Uploading...' : 'Add Sound'}
                  </button>
                </div>
                <input
                  ref={soundUploadInputRef}
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadSound(file).catch(() => undefined);
                  }}
                />
              </div>
            </div>
          )}

          {moreOpen && (
            <div className="voice-more-popover">
              <label className="voice-checkbox">
                <input
                  type="checkbox"
                  checked={gridView}
                  onChange={(e) => setGridView(e.target.checked)}
                />
                <span>Grid view</span>
              </label>
            </div>
          )}
        </div>
      )}

      {isConnected && (
        <div className="voice-media-layer">
          {gridView && (
            <div className="voice-grid">
              {localVideoTrack && videoEnabled && (
                <VideoTile track={localVideoTrack} label="You" variant="self" />
              )}
              {localScreenTrack && screenShareEnabled && (
                <VideoTile track={localScreenTrack} label="You (Screen)" variant="screen" />
              )}
              {screenShareEnabled && !localScreenTrack && (
                <div className="voice-video-tile voice-video-tile-pending">
                  <span className="voice-video-label">Screen share is starting...</span>
                </div>
              )}
              {remoteTracks.filter((t) => t.kind === 'video').map((t) => (
                <VideoTile
                  key={t.id}
                  track={t.track}
                  label={t.source.toLowerCase().includes('screen') ? `${t.participantLabel} (Screen)` : t.participantLabel}
                  variant={t.source.toLowerCase().includes('screen') ? 'screen' : 'remote'}
                />
              ))}
            </div>
          )}
          {remoteTracks.filter((t) => t.kind === 'audio').map((t) => (
            <AudioTile key={t.id} track={t.track} outputDeviceId={selectedSpeaker} />
          ))}
        </div>
      )}
    </div>
  );
}

function VideoTile({ track, label, variant = 'remote' }: { track: LiveKitTrack; label: string; variant?: 'self' | 'remote' | 'screen' }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <div className={`voice-video-tile voice-video-tile-${variant}`}>
      <video ref={ref} autoPlay playsInline muted={label === 'You'} />
      <span className="voice-video-label">{label}</span>
    </div>
  );
}

function AudioTile({ track, outputDeviceId }: { track: RemoteTrack; outputDeviceId: string }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  useEffect(() => {
    const el = ref.current as HTMLMediaElement | null;
    if (!el || !outputDeviceId) return;
    if (typeof (el as any).setSinkId === 'function') {
      (el as any).setSinkId(outputDeviceId).catch(() => undefined);
    }
  }, [outputDeviceId]);

  return <audio ref={ref} autoPlay />;
}
