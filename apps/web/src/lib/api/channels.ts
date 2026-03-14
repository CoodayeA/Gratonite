/**
 * Channels domain: channel CRUD, permissions, notification prefs.
 */
import { apiFetch } from './_core';
import type { Channel } from './_core';

function assertGuildId(guildId: string): asserts guildId is string {
  if (!guildId || guildId === 'null' || guildId === 'undefined') {
    throw new Error(`Invalid guildId: ${guildId}`);
  }
}

export const channelsApi = {
  getGuildChannels: (guildId: string, options?: RequestInit) => {
    assertGuildId(guildId);
    return apiFetch<Channel[]>(`/guilds/${guildId}/channels`, options);
  },

  get: (channelId: string) =>
    apiFetch<Channel>(`/channels/${channelId}`),

  create: (
    guildId: string,
    data: {
      name: string;
      type?: string;
      parentId?: string;
      topic?: string;
      nsfw?: boolean;
      rateLimitPerUser?: number;
    },
  ) => {
    assertGuildId(guildId);
    const normalizedType = (() => {
      const raw = String(data.type ?? 'GUILD_TEXT').trim().toUpperCase().replace(/-/g, '_');
      if (raw === 'TEXT' || raw === 'GUILD_TEXT') return 'GUILD_TEXT';
      if (raw === 'VOICE' || raw === 'GUILD_VOICE') return 'GUILD_VOICE';
      if (raw === 'CATEGORY' || raw === 'GUILD_CATEGORY') return 'GUILD_CATEGORY';
      return raw;
    })();

    const normalizedName = data.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);

    return apiFetch<Channel>(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        name: normalizedName || 'channel',
        type: normalizedType,
      }),
    });
  },

  update: (channelId: string, data: { name?: string; topic?: string; nsfw?: boolean; rateLimitPerUser?: number; backgroundUrl?: string | null; backgroundType?: 'image' | 'video' | null; isAnnouncement?: boolean; isEncrypted?: boolean; attachmentsEnabled?: boolean; permissionSynced?: boolean; parentId?: string | null; userLimit?: number; archived?: boolean; autoArchiveDays?: number | null }) =>
    apiFetch<Channel>(`/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  follow: (channelId: string, targetChannelId?: string) =>
    apiFetch<any>(`/channels/${channelId}/followers`, {
      method: 'POST',
      body: JSON.stringify({ targetChannelId }),
    }),

  crosspost: (channelId: string, messageId: string) =>
    apiFetch<any>(`/channels/${channelId}/messages/${messageId}/crosspost`, { method: 'POST' }),

  getCallHistory: (channelId: string) =>
    apiFetch<any[]>(`/channels/${channelId}/call-history`),

  delete: (channelId: string) =>
    apiFetch<void>(`/channels/${channelId}`, { method: 'DELETE' }),

  updatePositions: (guildId: string, positions: Array<{ id: string; position: number; parentId?: string | null }>) => {
    assertGuildId(guildId);
    return apiFetch<void>(`/guilds/${guildId}/channels/positions`, {
      method: 'PATCH',
      body: JSON.stringify(positions),
    });
  },

  getPermissionOverrides: (channelId: string) =>
    apiFetch<Array<{ id: string; channelId: string; targetId: string; targetType: 'role' | 'member'; allow: string; deny: string }>>(
      `/channels/${channelId}/permissions`,
    ),

  setPermissionOverride: (
    channelId: string,
    targetId: string,
    data: { targetType: 'role' | 'member'; allow: string; deny: string },
  ) =>
    apiFetch<{ id: string; channelId: string; targetId: string; targetType: 'role' | 'member'; allow: string; deny: string }>(
      `/channels/${channelId}/permissions/${targetId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          type: data.targetType,
          allow: data.allow,
          deny: data.deny,
        }),
      },
    ),

  deletePermissionOverride: (channelId: string, targetId: string) =>
    apiFetch<void>(`/channels/${channelId}/permissions/${targetId}`, { method: 'DELETE' }),

  duplicate: (channelId: string) =>
    apiFetch<Channel>(`/channels/${channelId}/duplicate`, { method: 'POST' }),

  getEncryptionKeys: (guildId: string, channelId: string) => {
    assertGuildId(guildId);
    return apiFetch<{ id: string; channelId: string; version: number; keyData: Record<string, string> }>(`/guilds/${guildId}/channels/${channelId}/encryption-keys`);
  },

  uploadEncryptionKeys: (guildId: string, channelId: string, data: { version: number; keyData: Record<string, string> }) => {
    assertGuildId(guildId);
    return apiFetch<any>(`/guilds/${guildId}/channels/${channelId}/encryption-keys`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getNotificationPrefs: (channelId: string) =>
    apiFetch<{ level: string; mutedUntil: string | null }>(`/channels/${channelId}/notification-prefs`),

  setNotificationPrefs: (channelId: string, data: { level: 'all' | 'mentions' | 'none' | 'default'; mutedUntil?: string | null }) =>
    apiFetch<any>(`/channels/${channelId}/notification-prefs`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
