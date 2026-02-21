import { create } from 'zustand';
import type { LocalAudioTrack, LocalVideoTrack, Room } from 'livekit-client';

type CallStatus = 'idle' | 'connecting' | 'connected' | 'error';

type CallType = 'voice' | 'video';

interface IncomingCall {
  channelId: string;
  fromUserId: string;
  fromDisplayName: string;
  type: CallType;
}

interface OutgoingCall {
  channelId: string;
  type: CallType;
  status: 'ringing' | 'accepted' | 'declined' | 'timeout' | 'cancelled';
}

interface CallState {
  status: CallStatus;
  channelId: string | null;
  muted: boolean;
  videoEnabled: boolean;
  error: string | null;
  room: Room | null;
  localAudioTrack: LocalAudioTrack | null;
  localVideoTrack: LocalVideoTrack | null;
  incomingCall: IncomingCall | null;
  outgoingCall: OutgoingCall | null;
  setState: (partial: Partial<CallState>) => void;
  reset: () => void;
}

const initialState: Omit<CallState, 'setState' | 'reset'> = {
  status: 'idle',
  channelId: null,
  muted: false,
  videoEnabled: false,
  error: null,
  room: null,
  localAudioTrack: null,
  localVideoTrack: null,
  incomingCall: null,
  outgoingCall: null,
};

export const useCallStore = create<CallState>((set) => ({
  ...initialState,
  setState: (partial) => set((state) => ({ ...state, ...partial })),
  reset: () => set({ ...initialState }),
}));
