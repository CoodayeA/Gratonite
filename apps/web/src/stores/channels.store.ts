import { create } from 'zustand';
import type { Channel } from '@gratonite/types';

interface ChannelsState {
  channels: Map<string, Channel>;
  channelsByGuild: Map<string, string[]>;
  currentChannelId: string | null;

  setGuildChannels: (guildId: string, channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;
  updateChannel: (channelId: string, partial: Partial<Channel>) => void;
  setCurrentChannel: (channelId: string | null) => void;
  clear: () => void;
}

export const useChannelsStore = create<ChannelsState>((set) => ({
  channels: new Map(),
  channelsByGuild: new Map(),
  currentChannelId: null,

  setGuildChannels: (guildId, channels) =>
    set((state) => {
      const newChannels = new Map(state.channels);
      const ids: string[] = [];
      for (const ch of channels) {
        newChannels.set(ch.id, ch);
        ids.push(ch.id);
      }
      const newByGuild = new Map(state.channelsByGuild);
      newByGuild.set(guildId, ids);
      return { channels: newChannels, channelsByGuild: newByGuild };
    }),

  addChannel: (channel) =>
    set((state) => {
      const channels = new Map(state.channels);
      channels.set(channel.id, channel);
      const channelsByGuild = new Map(state.channelsByGuild);
      const guildChannels = channelsByGuild.get(channel.guildId ?? '') ?? [];
      if (!guildChannels.includes(channel.id)) {
        channelsByGuild.set(channel.guildId ?? '', [...guildChannels, channel.id]);
      }
      return { channels, channelsByGuild };
    }),

  removeChannel: (channelId) =>
    set((state) => {
      const channels = new Map(state.channels);
      const removed = channels.get(channelId);
      channels.delete(channelId);
      const channelsByGuild = new Map(state.channelsByGuild);
      if (removed?.guildId) {
        const guildChannels = channelsByGuild.get(removed.guildId) ?? [];
        channelsByGuild.set(
          removed.guildId,
          guildChannels.filter((id) => id !== channelId),
        );
      }
      return {
        channels,
        channelsByGuild,
        currentChannelId: state.currentChannelId === channelId ? null : state.currentChannelId,
      };
    }),

  updateChannel: (channelId, partial) =>
    set((state) => {
      const existing = state.channels.get(channelId);
      if (!existing) return state;
      const channels = new Map(state.channels);
      channels.set(channelId, { ...existing, ...partial });
      return { channels };
    }),

  setCurrentChannel: (channelId) =>
    set({ currentChannelId: channelId }),

  clear: () =>
    set({ channels: new Map(), channelsByGuild: new Map(), currentChannelId: null }),
}));
