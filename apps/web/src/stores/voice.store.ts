import { create } from 'zustand';
import type { VoiceState } from '@gratonite/types';

interface VoiceStateStore {
  statesByChannel: Map<string, VoiceState[]>;
  userChannel: Map<string, string>;
  setChannelStates: (channelId: string, states: VoiceState[]) => void;
  updateVoiceState: (state: VoiceState) => void;
  clear: () => void;
}

export const useVoiceStore = create<VoiceStateStore>((set, get) => ({
  statesByChannel: new Map(),
  userChannel: new Map(),

  setChannelStates: (channelId, states) => {
    const userChannel = new Map(get().userChannel);
    states.forEach((state) => {
      if (state.channelId) userChannel.set(String(state.userId), String(state.channelId));
    });
    const statesByChannel = new Map(get().statesByChannel);
    statesByChannel.set(channelId, states);
    set({ statesByChannel, userChannel });
  },

  updateVoiceState: (state) => {
    const statesByChannel = new Map(get().statesByChannel);
    const userChannel = new Map(get().userChannel);
    const userId = String(state.userId);
    const nextChannelId = state.channelId ? String(state.channelId) : null;
    const prevChannelId = userChannel.get(userId) ?? null;

    if (prevChannelId && prevChannelId !== nextChannelId) {
      const prevList = statesByChannel.get(prevChannelId) ?? [];
      statesByChannel.set(prevChannelId, prevList.filter((s) => String(s.userId) !== userId));
    }

    if (!nextChannelId) {
      userChannel.delete(userId);
      set({ statesByChannel, userChannel });
      return;
    }

    const nextList = statesByChannel.get(nextChannelId) ?? [];
    const filtered = nextList.filter((s) => String(s.userId) !== userId);
    filtered.push(state);
    statesByChannel.set(nextChannelId, filtered);
    userChannel.set(userId, nextChannelId);
    set({ statesByChannel, userChannel });
  },

  clear: () => set({ statesByChannel: new Map(), userChannel: new Map() }),
}));
