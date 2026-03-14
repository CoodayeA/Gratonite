/**
 * Guilds domain: guild CRUD, settings, members, roles, bans, emojis, etc.
 */
import { apiFetch } from './_core';
import type { Guild, GuildMember, GuildEmoji } from './_core';

export const guildsApi = {
  getMine: () => apiFetch<Guild[]>('/guilds/@me'),

  discover: (params?: { q?: string; hashtag?: string; featured?: boolean; limit?: number; offset?: number; category?: string; tag?: string; sort?: string }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.hashtag) query.set('hashtag', params.hashtag);
    if (params?.featured !== undefined) query.set('featured', String(params.featured));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.category) query.set('category', params.category);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.sort) query.set('sort', params.sort);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<Array<{
      id: string;
      name: string;
      description: string | null;
      iconHash: string | null;
      bannerHash: string | null;
      memberCount: number;
      tags: string[];
      category: string | null;
      categories: string[];
      featured?: boolean;
      isFeatured?: boolean;
      discoverRank?: number;
      isPublic?: boolean;
      isPinned?: boolean;
      verified?: boolean;
      averageRating?: number;
      totalRatings?: number;
    }>>(`/guilds/discover${suffix}`);
  },

  resolveGratoniteLounge: () =>
    apiFetch<{ id: string; name: string; slug: string; isDiscoverable: boolean; isPinned: boolean }>(
      '/guilds/lounge/gratonite',
    ),

  join: (guildId: string) =>
    apiFetch<{ id: string; name: string; memberCount: number; joined: boolean; alreadyMember: boolean }>(
      `/guilds/${guildId}/join`,
      { method: 'POST' },
    ),

  get: (guildId: string, options?: RequestInit) => apiFetch<Guild>(`/guilds/${guildId}`, options),

  getPublicStats: (guildId: string) =>
    apiFetch<{
      guild: { id: string; name: string; iconHash: string | null; bannerHash: string | null; description: string | null; createdAt: string };
      memberCount: number;
      onlineCount: number;
      messagesToday: number;
      messagesThisWeek: number;
      channelsCount: number;
      boostCount: number;
      boostTier: number;
      activity: Array<{ date: string; messages: number }>;
    }>(`/stats/guilds/${guildId}`),

  getChannelsUnread: (guildId: string) =>
    apiFetch<Array<{ channelId: string; mentionCount: number; lastReadAt: string }>>(`/guilds/${guildId}/channels/unread`),

  getMembers: (
    guildId: string,
    params: { limit?: number; offset?: number; search?: string; status?: 'online' | 'offline'; groupId?: string } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.offset !== undefined) query.set('offset', String(params.offset));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.groupId) query.set('groupId', params.groupId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<GuildMember[]>(`/guilds/${guildId}/members${suffix}`);
  },

  getMemberGroups: (guildId: string) =>
    apiFetch<Array<{ id: string; guildId: string; name: string; color: string; position: number; memberIds: string[] }>>(
      `/guilds/${guildId}/member-groups`,
    ),

  createMemberGroup: (guildId: string, data: { name: string; color?: string; position?: number }) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/member-groups`, { method: 'POST', body: JSON.stringify(data) }),

  updateMemberGroup: (guildId: string, groupId: string, data: { name?: string; color?: string; position?: number }) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/member-groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteMemberGroup: (guildId: string, groupId: string) =>
    apiFetch<void>(`/guilds/${guildId}/member-groups/${groupId}`, { method: 'DELETE' }),

  assignMemberGroup: (guildId: string, groupId: string, userId: string) =>
    apiFetch<void>(`/guilds/${guildId}/member-groups/${groupId}/members/${userId}`, { method: 'PUT' }),

  removeMemberGroup: (guildId: string, groupId: string, userId: string) =>
    apiFetch<void>(`/guilds/${guildId}/member-groups/${groupId}/members/${userId}`, { method: 'DELETE' }),

  create: (data: { name: string; description?: string; isDiscoverable?: boolean; tags?: string[]; categories?: string[] }) =>
    apiFetch<Guild>('/guilds', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (guildId: string, data: { name?: string; description?: string; tags?: string[]; categories?: string[]; accentColor?: string | null; publicStatsEnabled?: boolean }) =>
    apiFetch<Guild>(`/guilds/${guildId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  leave: (guildId: string) =>
    apiFetch<void>(`/guilds/${guildId}/members/@me`, { method: 'DELETE' }),

  delete: (guildId: string) =>
    apiFetch<void>(`/guilds/${guildId}`, { method: 'DELETE' }),

  uploadIcon: (guildId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ iconHash: string; iconAnimated: boolean }>(`/guilds/${guildId}/icon`, {
      method: 'POST',
      body: formData,
    });
  },

  deleteIcon: (guildId: string) =>
    apiFetch<void>(`/guilds/${guildId}/icon`, { method: 'DELETE' }),

  uploadBanner: (guildId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ bannerHash: string; bannerAnimated: boolean }>(`/guilds/${guildId}/banner`, {
      method: 'POST',
      body: formData,
    });
  },

  deleteBanner: (guildId: string) =>
    apiFetch<void>(`/guilds/${guildId}/banner`, { method: 'DELETE' }),

  getRoles: (guildId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/guilds/${guildId}/roles`),

  createRole: (guildId: string, data: { name: string; color?: string; mentionable?: boolean; permissions?: string }) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRole: (guildId: string, roleId: string, data: { name?: string; color?: string; mentionable?: boolean; permissions?: string; unicodeEmoji?: string | null }) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteRole: (guildId: string, roleId: string) =>
    apiFetch<void>(`/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' }),

  getMemberRoles: (guildId: string, userId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/guilds/${guildId}/members/${userId}/roles`),

  assignMemberRole: (guildId: string, userId: string, roleId: string) =>
    apiFetch<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'PUT' }),

  removeMemberRole: (guildId: string, userId: string, roleId: string) =>
    apiFetch<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' }),

  getBans: (guildId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/guilds/${guildId}/bans`),

  ban: (guildId: string, userId: string, reason?: string, duration?: number) =>
    apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ reason, ...(duration ? { duration } : {}) }),
    }),

  unban: (guildId: string, userId: string) =>
    apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' }),

  kickMember: (guildId: string, userId: string) =>
    apiFetch<void>(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' }),

  timeoutMember: (guildId: string, userId: string, durationSeconds: number) =>
    apiFetch<{ success: boolean; timeoutUntil: string | null }>(`/guilds/${guildId}/members/${userId}/timeout`, {
      method: 'POST',
      body: JSON.stringify({ durationSeconds }),
    }),

  warnMember: (guildId: string, userId: string, reason: string) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/members/${userId}/warnings`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getMemberWarnings: (guildId: string, userId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/guilds/${guildId}/members/${userId}/warnings`),

  getVanityUrl: (guildId: string) =>
    apiFetch<{ code: string | null }>(`/guilds/${guildId}/vanity-url`),

  updateVanityUrl: (guildId: string, code: string) =>
    apiFetch<{ code: string }>(`/guilds/${guildId}/vanity-url`, {
      method: 'PATCH',
      body: JSON.stringify({ code }),
    }),

  getTemplates: (guildId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/guilds/${guildId}/templates`),

  createTemplate: (guildId: string, data: { name: string; description?: string }) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/templates`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  syncTemplate: (guildId: string, templateId: string) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/templates/${templateId}`, { method: 'PATCH' }),

  deleteTemplate: (guildId: string, templateId: string) =>
    apiFetch<void>(`/guilds/${guildId}/templates/${templateId}`, { method: 'DELETE' }),

  createFromTemplate: (code: string) =>
    apiFetch<Record<string, unknown>>(`/guilds/templates/${code}`, { method: 'POST' }),

  boost: (guildId: string) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/boost`, { method: 'POST' }),

  removeBoost: (guildId: string) =>
    apiFetch<void>(`/guilds/${guildId}/boost`, { method: 'DELETE' }),

  getCommands: (guildId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/guilds/${guildId}/commands`),

  getAuditLog: (guildId: string, params?: { limit?: number; offset?: number; action?: string; userId?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.action) q.set('action', params.action);
    if (params?.userId) q.set('userId', params.userId);
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/guilds/${guildId}/audit-log?${q}`);
  },

  getEmojis: (guildId: string) =>
    apiFetch<GuildEmoji[]>(`/guilds/${guildId}/emojis`),

  createEmoji: (guildId: string, data: { name: string; file: File; categoryId?: string }) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('file', data.file);
    if (data.categoryId) formData.append('categoryId', data.categoryId);
    return apiFetch<GuildEmoji>(`/guilds/${guildId}/emojis`, {
      method: 'POST',
      body: formData,
    });
  },

  updateEmoji: (guildId: string, emojiId: string, data: { categoryId?: string | null }) =>
    apiFetch<void>(`/guilds/${guildId}/emojis/${emojiId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteEmoji: (guildId: string, emojiId: string) =>
    apiFetch<void>(`/guilds/${guildId}/emojis/${emojiId}`, { method: 'DELETE' }),

  getEmojiCategories: (guildId: string) =>
    apiFetch<Array<{ id: string; guildId: string; name: string; sortOrder: number }>>(`/guilds/${guildId}/emojis/categories/list`),

  createEmojiCategory: (guildId: string, data: { name: string }) =>
    apiFetch<{ id: string; guildId: string; name: string; sortOrder: number }>(`/guilds/${guildId}/emojis/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateEmojiCategory: (guildId: string, categoryId: string, data: { name: string }) =>
    apiFetch<{ id: string; name: string }>(`/guilds/${guildId}/emojis/categories/${categoryId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteEmojiCategory: (guildId: string, categoryId: string) =>
    apiFetch<void>(`/guilds/${guildId}/emojis/categories/${categoryId}`, { method: 'DELETE' }),

  rate: (guildId: string, rating: number) =>
    apiFetch<{ ok: boolean }>(`/guilds/${guildId}/rating`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    }),

  getRating: (guildId: string) =>
    apiFetch<{ averageRating: number; totalRatings: number; userRating: number | null }>(`/guilds/${guildId}/rating`),

  importServer: (guildId: string, data: { source: 'discord' | 'slack'; channels?: Array<Record<string, unknown>>; roles?: Array<Record<string, unknown>> }) =>
    apiFetch<{ success: boolean; created: { categories: number; channels: number; roles: number } }>(`/guilds/${guildId}/import`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
