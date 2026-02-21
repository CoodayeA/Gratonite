import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalAudioTrack,
} from 'livekit-client';
import { api } from '@/lib/api';
import { useCallStore } from '@/stores/call.store';
import { getSocket } from '@/lib/socket';
import { playSound, stopSound, stopAllSounds } from './audio';

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

async function ensureAudioTrack() {
  if (localAudioTrack) return localAudioTrack;
  localAudioTrack = await createLocalAudioTrack({
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  });
  return localAudioTrack;
}

async function ensureVideoTrack() {
  if (localVideoTrack) return localVideoTrack;
  localVideoTrack = await createLocalVideoTrack({
    resolution: { width: 1280, height: 720 },
  });
  return localVideoTrack;
}

export async function startDmCall(channelId: string, opts: { video: boolean }) {
  const store = useCallStore.getState();
  if (store.status === 'connecting' || store.status === 'connected') return;

  store.setState({ status: 'connecting', channelId, error: null });
  try {
    const { token, endpoint } = await api.voice.join(channelId, {
      selfMute: false,
      selfDeaf: false,
    });

    room = new Room({
      adaptiveStream: true,
      dynacast: true,
      stopLocalTrackOnUnpublish: true,
    });

    room.on(RoomEvent.Disconnected, () => {
      cleanup();
    });

    await room.connect(endpoint, token);

    let audioTrack: LocalAudioTrack;
    let videoTrack: LocalVideoTrack | null = null;
    try {
      audioTrack = await ensureAudioTrack();
      await room.localParticipant.publishTrack(audioTrack);
      if (opts.video) {
        videoTrack = await ensureVideoTrack();
        await room.localParticipant.publishTrack(videoTrack);
      }
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera/microphone permission denied. Check your browser settings.'
        : err?.name === 'NotFoundError'
        ? 'No camera or microphone found.'
        : `Media error: ${err?.message ?? 'Unknown'}`;
      useCallStore.getState().setState({ status: 'error', error: msg });
      stopAllSounds();
      return;
    }

    stopSound('outgoing-ring');
    playSound('call-connect');

    useCallStore.getState().setState({
      status: 'connected',
      channelId,
      muted: false,
      videoEnabled: Boolean(videoTrack),
      room,
      localAudioTrack: audioTrack,
      localVideoTrack: videoTrack,
      outgoingCall: useCallStore.getState().outgoingCall
        ? { ...useCallStore.getState().outgoingCall!, status: 'accepted' }
        : null,
    });
  } catch (err: any) {
    cleanup();
    useCallStore.getState().setState({
      status: 'error',
      error: err?.message ?? 'Failed to start call',
      outgoingCall: null,
    });
  }
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
  cleanup();
}

export async function toggleMute() {
  const { muted } = useCallStore.getState();
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
    const videoTrack = await ensureVideoTrack();
    await room.localParticipant.publishTrack(videoTrack);
    useCallStore.getState().setState({ videoEnabled: true, localVideoTrack: videoTrack });
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
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
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
    } catch {
      // User cancelled the screen share picker — do nothing
    }
  }
}

function cleanup() {
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
  useCallStore.getState().reset();
}
