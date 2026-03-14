/**
 * Users domain: user profile, settings, friends, presence, sessions, data exports.
 */
import { apiFetch, meRequestPromise, setMeRequestPromise } from './_core';
import type { PresenceStatus, AvatarDecoration, ProfileEffect, Nameplate } from './_core';

export const usersApi = {
  get: (userId: string) => apiFetch<{ id: string; username: string; displayName?: string; avatarHash?: string | null }>(`/users/${userId}/profile`),

  getMe: () => {
    if (meRequestPromise) return meRequestPromise;
    const p = apiFetch<{
      id: string;
      username: string;
      email: string;
      emailVerified: boolean;
      createdAt: string;
      isAdmin: boolean;
      status?: string;
      onboardingCompleted: boolean;
      interests: string[] | null;
      profile: {
        displayName: string;
        avatarHash: string | null;
        bannerHash: string | null;
        bio: string | null;
        pronouns: string | null;
        avatarDecorationId: string | null;
        profileEffectId: string | null;
        nameplateId: string | null;
        tier: string;
        previousAvatarHashes: string[];
        messageCount: number;
      } | null;
    }>('/users/@me').finally(() => {
      setMeRequestPromise(null);
    });
    setMeRequestPromise(p);
    return p;
  },

  updateProfile: (data: { displayName?: string; bio?: string; pronouns?: string; accentColor?: string; primaryColor?: string; onboardingCompleted?: boolean; interests?: string[] | null; nameplateStyle?: string; customStatus?: string }) =>
    apiFetch<any>('/users/@me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  updateAccountBasics: (data: { username?: string; displayName?: string; email?: string }) =>
    apiFetch<{
      success: true;
      user: {
        id: string;
        username: string;
        email: string;
        emailVerified: boolean;
      };
      profile: {
        displayName: string;
      } | null;
    }>('/users/@me/account', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ avatarHash: string; avatarAnimated: boolean }>('/users/@me/avatar', {
      method: 'POST',
      body: formData,
    });
  },

  deleteAvatar: () =>
    apiFetch<void>('/users/@me/avatar', { method: 'DELETE' }),

  uploadBanner: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ bannerHash: string; bannerAnimated: boolean }>('/users/@me/banner', {
      method: 'POST',
      body: formData,
    });
  },

  deleteBanner: () =>
    apiFetch<void>('/users/@me/banner', { method: 'DELETE' }),

  updateSettings: (data: Record<string, unknown>) =>
    apiFetch<any>('/users/@me/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getDndSchedule: () =>
    apiFetch<{
      enabled: boolean;
      startTime: string;
      endTime: string;
      timezone: string;
      daysOfWeek: number;
      allowExceptions: string[];
    }>('/users/@me/dnd-schedule'),

  updateDndSchedule: (data: Record<string, unknown>) =>
    apiFetch<any>('/users/@me/dnd-schedule', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getSummaries: (ids: string[]) =>
    apiFetch<Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>>(
      `/users?ids=${encodeURIComponent(ids.join(','))}`,
    ),

  searchUsers: (query: string) =>
    apiFetch<Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>>(
      `/users/search?q=${encodeURIComponent(query)}`,
    ),

  getPresences: (ids: string[]) =>
    apiFetch<Array<{ userId: string; status: PresenceStatus; updatedAt: string; lastSeen: number | null }>>(
      `/users/presences?ids=${encodeURIComponent(ids.join(','))}`,
    ),

  getProfile: (userId: string) =>
    apiFetch<{
      id: string;
      username: string;
      displayName: string;
      avatarHash: string | null;
      bannerHash: string | null;
      bio: string | null;
      pronouns: string | null;
      accentColor: string | null;
      primaryColor: string | null;
      badges: string[];
      messageCount: number;
      createdAt: string;
    }>(`/users/${userId}/profile`),

  getMutuals: (userId: string) =>
    apiFetch<{
      mutualServers: Array<{ id: string; name: string; iconHash: string | null; nickname: string | null }>;
      mutualFriends: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>;
    }>(`/users/${userId}/mutuals`),

  getConnections: (userId: string) =>
    apiFetch<Array<{ id: string; provider: string; providerUsername: string; profileUrl: string | null }>>(`/users/${userId}/connections`),

  getMyConnections: () =>
    apiFetch<Array<{ id: string; provider: string; providerUsername: string; profileUrl: string | null }>>('/users/@me/connections'),

  addConnection: (data: { provider: string; providerUsername: string; profileUrl?: string }) =>
    apiFetch<any>('/users/@me/connections', { method: 'POST', body: JSON.stringify(data) }),

  removeConnection: (provider: string) =>
    apiFetch<void>(`/users/@me/connections/${provider}`, { method: 'DELETE' }),

  getNote: (userId: string) =>
    apiFetch<{ content: string }>(`/users/${userId}/note`),

  saveNote: (userId: string, content: string) =>
    apiFetch<{ success: boolean }>(`/users/${userId}/note`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),

  updatePresence: (status: Extract<PresenceStatus, 'online' | 'idle' | 'dnd' | 'invisible'>) =>
    apiFetch<{ status: PresenceStatus }>('/users/@me/presence', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  updateCustomStatus: (data: { text: string | null; expiresAt: string | null; emoji?: string | null }) =>
    apiFetch<void>('/users/@me/status', { method: 'PATCH', body: JSON.stringify(data) }),

  setActivity: (data: { type: string; name: string }) =>
    apiFetch<void>('/users/@me/activity', { method: 'PATCH', body: JSON.stringify(data) }),

  clearActivity: () =>
    apiFetch<void>('/users/@me/activity', { method: 'DELETE' }),

  updateWidgets: (widgets: string[]) =>
    apiFetch<void>('/users/@me/widgets', { method: 'PATCH', body: JSON.stringify({ widgets }) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch<void>('/users/@me/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteAccount: (password: string) =>
    apiFetch<void>('/users/@me', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  getSettings: () =>
    apiFetch<any>('/users/@me/settings'),

  getGuildFolders: () =>
    apiFetch<any[]>('/users/@me/guild-folders'),

  createGuildFolder: (data: { name: string; color: string; guildIds: string[] }) =>
    apiFetch<any>('/users/@me/guild-folders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateGuildFolder: (folderId: string, data: { name?: string; color?: string; guildIds?: string[] }) =>
    apiFetch<any>(`/users/@me/guild-folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteGuildFolder: (folderId: string) =>
    apiFetch<void>(`/users/@me/guild-folders/${folderId}`, { method: 'DELETE' }),

  getFavorites: () =>
    apiFetch<any[]>('/users/@me/favorites'),

  addFavorite: (channelId: string) =>
    apiFetch<any>(`/users/@me/favorites/${channelId}`, {
      method: 'PUT',
    }),

  removeFavorite: (channelId: string) =>
    apiFetch<void>(`/users/@me/favorites/${channelId}`, { method: 'DELETE' }),

  getSessions: () =>
    apiFetch<any[]>('/users/@me/sessions'),
  revokeSession: (sessionId: string) =>
    apiFetch<void>(`/users/@me/sessions/${sessionId}`, { method: 'DELETE' }),
  revokeAllOtherSessions: () =>
    apiFetch<void>('/users/@me/sessions', { method: 'DELETE' }),

  getDataExports: () =>
    apiFetch<any[]>('/users/@me/data-exports'),
  requestDataExport: () =>
    apiFetch<any>('/users/@me/data-exports', { method: 'POST', body: '{}' }),
};

export const profilesApi = {
  getMemberProfile: (guildId: string, userId: string) =>
    apiFetch<any>(`/guilds/${guildId}/members/${userId}/profile`),

  updateMemberProfile: (guildId: string, data: { nickname?: string | null; bio?: string | null }) =>
    apiFetch<any>(`/guilds/${guildId}/members/@me/profile`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  uploadMemberAvatar: (guildId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<any>(`/guilds/${guildId}/members/@me/profile/avatar`, {
      method: 'POST',
      body: formData,
    });
  },

  deleteMemberAvatar: (guildId: string) =>
    apiFetch<any>(`/guilds/${guildId}/members/@me/profile/avatar`, { method: 'DELETE' }),

  uploadMemberBanner: (guildId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<any>(`/guilds/${guildId}/members/@me/profile/banner`, {
      method: 'POST',
      body: formData,
    });
  },

  deleteMemberBanner: (guildId: string) =>
    apiFetch<any>(`/guilds/${guildId}/members/@me/profile/banner`, { method: 'DELETE' }),

  getAvatarDecorations: () =>
    apiFetch<AvatarDecoration[]>('/avatar-decorations'),

  getProfileEffects: () =>
    apiFetch<ProfileEffect[]>('/profile-effects'),

  getNameplates: () =>
    apiFetch<Nameplate[]>('/nameplates'),

  updateCustomization: (data: { avatarDecorationId?: string | null; profileEffectId?: string | null; nameplateId?: string | null }) =>
    apiFetch<any>('/users/@me/customization', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
