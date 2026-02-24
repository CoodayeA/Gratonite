import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  LocalAudioTrack,
} from 'livekit-client';
import { api } from '@/lib/api';
import { useCallStore } from '@/stores/call.store';
import { getSocket } from '@/lib/socket';
import { playSound, stopSound, stopAllSounds } from './audio';
import { getUserMediaWithFallback, mapMediaError } from './media';

let room: Room | null = null;
let localAudioTrack: LocalAudioTrack | null = null;
let localVideoTrack: LocalVideoTrack | null = null;
let localScreenTrack: LocalVideoTrack | null = null;
let ringTimeout: ReturnType<typeof setTimeout> | null = null;

export function clearRingTimeout() {
  if (ringTimeout) {
    clearTimeout(ringTimeout);
    ringTimeout = null;
  }
}

async function ensureAudioTrack(deviceId?: string) {
  if (localAudioTrack) return localAudioTrack;
  const normalizedDeviceId = deviceId && deviceId.length > 0 ? deviceId : undefined;
  const audioConstraints: MediaTrackConstraints | boolean = normalizedDeviceId
    ? { deviceId: { ideal: normalizedDeviceId } }
    : true;
  const stream = await getUserMediaWithFallback([
    { audio: audioConstraints, video: false },
    { audio: true, video: false },
  ]);
  const track = stream.getAudioTracks()[0];
  if (!track) throw new Error('No audio track available.');
  localAudioTrack = new LocalAudioTrack(track, undefined, false);
  return localAudioTrack;
}

async function ensureVideoTrack(deviceId?: string) {
  if (localVideoTrack) return localVideoTrack;
  const normalizedDeviceId = deviceId && deviceId.length > 0 ? deviceId : undefined;
  const videoConstraints: MediaTrackConstraints | boolean = normalizedDeviceId
    ? {
      deviceId: { ideal: normalizedDeviceId },
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 60 },
    }
    : {
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 60 },
    };
  const stream = await getUserMediaWithFallback([
    { audio: false, video: videoConstraints },
    { audio: false, video: true },
  ]);
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error('No video track available.');
  localVideoTrack = new LocalVideoTrack(track, undefined, false);
  return localVideoTrack;
}

async function connectToVoice(channelId: string, opts: { video: boolean; mode: 'dm' | 'guild' }) {
  const store = useCallStore.getState();
  if (store.status === 'connecting') return;

  if (opts.mode === 'guild') {
    clearRingTimeout();
    stopAllSounds();
    useCallStore.getState().setState({
      incomingCall: null,
      outgoingCall: null,
    });
  }

  if (store.channelId && store.channelId !== channelId) {
    await leaveVoiceChannel();
  }

  store.setState({ status: 'connecting', channelId, error: null, mode: opts.mode });
  try {
    const { token, endpoint } = await api.voice.join(channelId, {
      selfMute: false,
      selfDeaf: false,
    });

    const normalizedEndpoint = normalizeLiveKitEndpoint(endpoint);

    room = new Room({
      adaptiveStream: true,
      dynacast: true,
      stopLocalTrackOnUnpublish: true,
    });

    room.on(RoomEvent.Disconnected, () => {
      cleanupMedia(true);
    });

    const connectTimeout = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error('LiveKit connection timed out. Check LIVEKIT_URL/TURN.'));
      }, 10000);
    });

    await Promise.race([
      room.connect(normalizedEndpoint, token),
      connectTimeout,
    ]);

    let audioTrack: LocalAudioTrack | null = null;
    let videoTrack: LocalVideoTrack | null = null;
    try {
      audioTrack = await ensureAudioTrack(store.inputDeviceId ?? undefined);
      await room.localParticipant.publishTrack(audioTrack);
    } catch (err) {
      console.warn('[Call] Audio track failed, connected in listen-only mode.', err);
      audioTrack = null;
    }
    try {
      if (opts.video) {
        try {
          videoTrack = await ensureVideoTrack(store.videoDeviceId ?? undefined);
          await room.localParticipant.publishTrack(videoTrack);
        } catch (err) {
          console.warn('[Call] Video track failed, continuing audio-only.', err);
          videoTrack = null;
        }
      }
    } catch {
      // Non-fatal; retain room connection.
    }

    useCallStore.getState().setState({
      status: 'connected',
      channelId,
      muted: audioTrack ? false : true,
      videoEnabled: Boolean(videoTrack),
      room,
      localAudioTrack: audioTrack,
      localVideoTrack: videoTrack,
    });
  } catch (err: any) {
    try {
      await api.voice.leave();
    } catch {
      // best effort
    }
    cleanupMedia(false);
    useCallStore.getState().setState({
      status: 'error',
      error: err?.message ?? 'Failed to start call',
      channelId,
    });
  }
}

function normalizeLiveKitEndpoint(endpoint: string) {
  let next = endpoint.trim();
  if (next.startsWith('http://')) {
    next = `ws://${next.slice('http://'.length)}`;
  }
  if (next.startsWith('https://')) {
    next = `wss://${next.slice('https://'.length)}`;
  }
  if (next.includes('localhost')) {
    next = next.replace('localhost', '127.0.0.1');
  }
  return next;
}

export async function startDmCall(channelId: string, opts: { video: boolean }) {
  const store = useCallStore.getState();
  if (store.status === 'connecting' || store.status === 'connected') return;
  // Join audio-first even for "video" calls; camera should be user-initiated.
  await connectToVoice(channelId, { video: false, mode: 'dm' });
  stopSound('outgoing-ring');
  playSound('call-connect');
  useCallStore.getState().setState({
    outgoingCall: useCallStore.getState().outgoingCall
      ? { ...useCallStore.getState().outgoingCall!, status: 'accepted' }
      : null,
  });
}

export async function startOutgoingCall(channelId: string, opts: { video: boolean }) {
  useCallStore.getState().setState({
    outgoingCall: {
      channelId,
      type: opts.video ? 'video' : 'voice',
      status: 'ringing',
    },
  });

  const socket = getSocket();
  socket?.emit('CALL_INVITE', {
    channelId,
    type: opts.video ? 'video' : 'voice',
  });

  playSound('outgoing-ring');

  clearRingTimeout();
  ringTimeout = setTimeout(() => {
    const state = useCallStore.getState();
    if (state.outgoingCall?.status === 'ringing') {
      stopSound('outgoing-ring');
      playSound('call-end');
      state.setState({
        outgoingCall: { ...state.outgoingCall, status: 'timeout' },
      });
      setTimeout(() => {
        useCallStore.getState().setState({ outgoingCall: null });
      }, 3000);
    }
  }, 60000);

  await startDmCall(channelId, opts);
}

export function acceptIncomingCall(channelId: string, type: 'voice' | 'video', toUserId: string) {
  const socket = getSocket();
  socket?.emit('CALL_ACCEPT', { channelId, toUserId });
  useCallStore.getState().setState({ incomingCall: null });
  stopSound('ringtone');
  playSound('call-connect');
  return startDmCall(channelId, { video: type === 'video' });
}

export function declineIncomingCall(channelId: string, toUserId: string) {
  const socket = getSocket();
  socket?.emit('CALL_DECLINE', { channelId, toUserId });
  useCallStore.getState().setState({ incomingCall: null });
  stopSound('ringtone');
}

export async function endDmCall() {
  stopAllSounds();
  clearRingTimeout();
  playSound('call-end');
  const { outgoingCall, channelId } = useCallStore.getState();
  if (outgoingCall?.status === 'ringing' && channelId) {
    const socket = getSocket();
    socket?.emit('CALL_CANCEL', { channelId });
  }
  try {
    await api.voice.leave();
  } catch {
    // best effort
  }
  cleanupMedia(true);
}

export async function joinVoiceChannel(channelId: string, opts: { video: boolean } = { video: false }) {
  const store = useCallStore.getState();
  if (store.status === 'connecting') return;
  if (store.channelId === channelId && store.status === 'connected') return;
  clearRingTimeout();
  stopAllSounds();
  await connectToVoice(channelId, { video: opts.video, mode: 'guild' });
}

export async function leaveVoiceChannel() {
  try {
    await api.voice.leave();
  } catch {
    // best effort
  }
  cleanupMedia(true);
}

export async function setAudioInputDevice(deviceId: string) {
  const store = useCallStore.getState();
  const normalizedDeviceId = deviceId && deviceId.length > 0 ? deviceId : null;
  store.setState({ inputDeviceId: normalizedDeviceId });
  if (!room) return;
  if (localAudioTrack) {
    await room.localParticipant.unpublishTrack(localAudioTrack);
    localAudioTrack.stop();
    localAudioTrack = null;
  }
  const track = await ensureAudioTrack(normalizedDeviceId ?? undefined);
  await room.localParticipant.publishTrack(track);
  store.setState({ localAudioTrack: track });
}

export async function setVideoInputDevice(deviceId: string) {
  const store = useCallStore.getState();
  const normalizedDeviceId = deviceId && deviceId.length > 0 ? deviceId : null;
  store.setState({ videoDeviceId: normalizedDeviceId });
  if (!room) return;
  if (localVideoTrack) {
    await room.localParticipant.unpublishTrack(localVideoTrack);
    localVideoTrack.stop();
    localVideoTrack = null;
  }
  const track = await ensureVideoTrack(normalizedDeviceId ?? undefined);
  await room.localParticipant.publishTrack(track);
  store.setState({ localVideoTrack: track, videoEnabled: true });
}

export async function toggleMute() {
  const { muted } = useCallStore.getState();
  if (!localAudioTrack && room) {
    try {
      const track = await ensureAudioTrack(useCallStore.getState().inputDeviceId ?? undefined);
      await room.localParticipant.publishTrack(track);
      useCallStore.getState().setState({ localAudioTrack: track, muted: false });
      return;
    } catch (err) {
      const msg = mapMediaError(err);
      useCallStore.getState().setState({ error: msg });
      return;
    }
  }
  if (!localAudioTrack) return;
  if (muted) {
    await localAudioTrack.unmute();
  } else {
    await localAudioTrack.mute();
  }
  useCallStore.getState().setState({ muted: !muted });
}

export async function toggleVideo() {
  const { videoEnabled } = useCallStore.getState();
  if (!room) return;

  if (!videoEnabled) {
    try {
      const videoTrack = await ensureVideoTrack(useCallStore.getState().videoDeviceId ?? undefined);
      await room.localParticipant.publishTrack(videoTrack);
      useCallStore.getState().setState({ videoEnabled: true, localVideoTrack: videoTrack, error: null });
    } catch (err: any) {
      useCallStore.getState().setState({ error: mapMediaError(err) });
    }
    return;
  }

  if (localVideoTrack) {
    await room.localParticipant.unpublishTrack(localVideoTrack);
    localVideoTrack.stop();
    localVideoTrack = null;
  }
  useCallStore.getState().setState({ videoEnabled: false, localVideoTrack: null });
}

export async function toggleScreenShare(): Promise<void> {
  const { room: r, screenShareEnabled } = useCallStore.getState();
  if (!r) return;

  if (screenShareEnabled) {
    if (localScreenTrack) {
      await r.localParticipant.unpublishTrack(localScreenTrack);
      localScreenTrack.stop();
      localScreenTrack = null;
    }
    useCallStore.getState().setState({ screenShareEnabled: false, localScreenTrack: null });
  } else {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      const lvt = new LocalVideoTrack(track, undefined, false);
      await r.localParticipant.publishTrack(lvt, { source: Track.Source.ScreenShare });
      localScreenTrack = lvt;
      useCallStore.getState().setState({ screenShareEnabled: true, localScreenTrack: lvt });

      // Handle user stopping share via browser's "Stop sharing" button
      track.onended = () => {
        toggleScreenShare();
      };
    } catch (err: any) {
      const name = err?.name ?? '';
      if (name === 'NotAllowedError' || name === 'AbortError') {
        return;
      }
      useCallStore.getState().setState({ error: mapMediaError(err) });
    }
  }
}

function cleanupMedia(resetStore = true) {
  stopAllSounds();
  clearRingTimeout();
  if (room) {
    room.disconnect();
    room = null;
  }
  if (localAudioTrack) {
    localAudioTrack.stop();
    localAudioTrack = null;
  }
  if (localVideoTrack) {
    localVideoTrack.stop();
    localVideoTrack = null;
  }
  if (localScreenTrack) {
    localScreenTrack.stop();
    localScreenTrack = null;
  }
  if (resetStore) {
    useCallStore.getState().reset();
  } else {
    useCallStore.getState().setState({
      room: null,
      localAudioTrack: null,
      localVideoTrack: null,
      localScreenTrack: null,
      screenShareEnabled: false,
    });
  }
}
