import { create } from 'zustand';

// ── Types ────────────────────────────────────────────

export type ChannelType =
  | 'GUILD_TEXT'
  | 'GUILD_VOICE'
  | 'GUILD_CATEGORY'
  | 'GUILD_ANNOUNCEMENT'
  | 'GUILD_STAGE_VOICE'
  | 'GUILD_FORUM'
  | 'DM'
  | 'GROUP_DM';

export interface Channel {
  id: string;
  guildId?: string;
  type: ChannelType;
  name?: string;
  topic?: string;
  position?: number;
  parentId?: string;
  nsfw?: boolean;
  lastMessageId?: string;
  rateLimitPerUser?: number;
  recipientIds?: string[];
  ownerId?: string;
  iconHash?: string;
  createdAt?: string;
}

// ── State ────────────────────────────────────────────

interface ChannelsState {
  /** All channels keyed by ID */
  channels: Map<string, Channel>;
  /** Channel IDs grouped by guild ID */
  channelsByGuild: Map<string, string[]>;
  /** DM channel IDs ordered by last message */
  dmChannels: string[];
  /** Currently active channel ID */
  currentChannelId: string | null;

  // Actions
  setChannels: (channels: Channel[]) => void;
  addChannel: (channel: Channel) => void;
  updateChannel: (channelId: string, partial: Partial<Channel>) => void;
  removeChannel: (channelId: string) => void;
  setDmChannels: (channels: Channel[]) => void;
  setCurrentChannel: (channelId: string | null) => void;
  getChannel: (channelId: string) => Channel | undefined;
  getGuildChannels: (guildId: string) => Channel[];
}

export const useChannelsStore = create<ChannelsState>((set, get) => ({
  channels: new Map(),
  channelsByGuild: new Map(),
  dmChannels: [],
  currentChannelId: null,

  setChannels: (channels) => {
    const nextChannels = new Map(get().channels);
    const nextByGuild = new Map(get().channelsByGuild);

    for (const channel of channels) {
      nextChannels.set(channel.id, channel);

      if (channel.guildId) {
        const guildChannels = nextByGuild.get(channel.guildId) ?? [];
        if (!guildChannels.includes(channel.id)) {
          nextByGuild.set(channel.guildId, [...guildChannels, channel.id]);
        }
      }
    }

    set({ channels: nextChannels, channelsByGuild: nextByGuild });
  },

  addChannel: (channel) => {
    const { channels, channelsByGuild, dmChannels } = get();
    const nextChannels = new Map(channels);
    nextChannels.set(channel.id, channel);

    const nextByGuild = new Map(channelsByGuild);
    if (channel.guildId) {
      const guildChannels = nextByGuild.get(channel.guildId) ?? [];
      if (!guildChannels.includes(channel.id)) {
        nextByGuild.set(channel.guildId, [...guildChannels, channel.id]);
      }
    }

    // If DM channel, add to DM list
    const nextDm =
      channel.type === 'DM' || channel.type === 'GROUP_DM'
        ? dmChannels.includes(channel.id)
          ? dmChannels
          : [channel.id, ...dmChannels]
        : dmChannels;

    set({ channels: nextChannels, channelsByGuild: nextByGuild, dmChannels: nextDm });
  },

  updateChannel: (channelId, partial) => {
    const { channels } = get();
    const existing = channels.get(channelId);
    if (!existing) return;

    const nextChannels = new Map(channels);
    nextChannels.set(channelId, { ...existing, ...partial });
    set({ channels: nextChannels });
  },

  removeChannel: (channelId) => {
    const { channels, channelsByGuild, dmChannels } = get();
    const channel = channels.get(channelId);
    if (!channel) return;

    const nextChannels = new Map(channels);
    nextChannels.delete(channelId);

    const nextByGuild = new Map(channelsByGuild);
    if (channel.guildId) {
      const guildChannels = nextByGuild.get(channel.guildId) ?? [];
      nextByGuild.set(
        channel.guildId,
        guildChannels.filter((id) => id !== channelId),
      );
    }

    const nextDm = dmChannels.filter((id) => id !== channelId);

    set({ channels: nextChannels, channelsByGuild: nextByGuild, dmChannels: nextDm });
  },

  setDmChannels: (channels) => {
    const nextChannels = new Map(get().channels);

    for (const channel of channels) {
      nextChannels.set(channel.id, channel);
    }

    set({
      channels: nextChannels,
      dmChannels: channels.map((c) => c.id),
    });
  },

  setCurrentChannel: (channelId) => {
    set({ currentChannelId: channelId });
  },

  getChannel: (channelId) => {
    return get().channels.get(channelId);
  },

  getGuildChannels: (guildId) => {
    const { channels, channelsByGuild } = get();
    const ids = channelsByGuild.get(guildId) ?? [];
    const result: Channel[] = [];

    for (const id of ids) {
      const channel = channels.get(id);
      if (channel) {
        result.push(channel);
      }
    }

    // Sort by position, then by name for equal positions
    return result.sort((a, b) => {
      const posA = a.position ?? 0;
      const posB = b.position ?? 0;
      if (posA !== posB) return posA - posB;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  },
}));
