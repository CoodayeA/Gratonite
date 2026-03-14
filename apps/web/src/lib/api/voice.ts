/**
 * Voice domain: voice channel endpoints, soundboard, stage, calls.
 */
import { apiFetch } from './_core';

export const voiceApi = {
  join: (channelId: string, data?: { selfMute?: boolean; selfDeaf?: boolean }) =>
    apiFetch<{ token: string; voiceState: Record<string, unknown>; endpoint: string }>('/voice/join', {
      method: 'POST',
      body: JSON.stringify({ channelId, ...(data ?? {}) }),
    }),
  leave: () =>
    apiFetch<void>('/voice/leave', { method: 'POST' }),
  getChannelStates: (channelId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/channels/${channelId}/voice-states`),
  getGuildVoiceStates: (guildId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/guilds/${guildId}/voice-states`),
  getSoundboard: (guildId: string) =>
    apiFetch<Array<{
      id: string;
      guildId: string;
      name: string;
      soundHash: string;
      volume: number;
      emojiId?: string | null;
      emojiName?: string | null;
      uploaderId: string;
      available: boolean;
    }>>(`/guilds/${guildId}/soundboard`),
  playSoundboard: (guildId: string, soundId: string) =>
    apiFetch<void>(`/guilds/${guildId}/soundboard/${soundId}/play`, {
      method: 'POST',
    }),
  createSoundboard: (
    guildId: string,
    data: { name: string; soundHash: string; volume?: number; emojiName?: string },
  ) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/soundboard`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateSoundboard: (
    guildId: string,
    soundId: string,
    data: { name?: string; volume?: number; available?: boolean; emojiName?: string | null },
  ) =>
    apiFetch<Record<string, unknown>>(`/guilds/${guildId}/soundboard/${soundId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteSoundboard: (guildId: string, soundId: string) =>
    apiFetch<void>(`/guilds/${guildId}/soundboard/${soundId}`, { method: 'DELETE' }),
  getStageInstances: (guildId: string) =>
    apiFetch<Array<Record<string, unknown>>>(`/guilds/${guildId}/stage-instances`),
  requestToSpeak: (channelId: string) =>
    apiFetch<void>(`/channels/${channelId}/voice/request-speak`, { method: 'PUT' }),
  addSpeaker: (channelId: string, userId: string) =>
    apiFetch<void>(`/channels/${channelId}/voice/speakers/${userId}`, { method: 'PUT' }),
  removeSpeaker: (channelId: string, userId: string) =>
    apiFetch<void>(`/channels/${channelId}/voice/speakers/${userId}`, { method: 'DELETE' }),
  createStageInstance: (channelId: string, data: { topic: string }) =>
    apiFetch<Record<string, unknown>>('/stage-instances', {
      method: 'POST',
      body: JSON.stringify({ channelId, ...data }),
    }),
  deleteStageInstance: (channelId: string) =>
    apiFetch<void>(`/stage-instances/${channelId}`, { method: 'DELETE' }),
  callInvite: (channelId: string, withVideo: boolean) =>
    apiFetch<void>('/voice/call-invite', {
      method: 'POST',
      body: JSON.stringify({ channelId, withVideo }),
    }),
  callAnswer: (channelId: string) =>
    apiFetch<{ token: string; endpoint: string }>('/voice/call-answer', {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    }),
  callReject: (channelId: string) =>
    apiFetch<void>('/voice/call-reject', {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    }),
  callCancel: (channelId: string) =>
    apiFetch<void>('/voice/call-cancel', {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    }),
};
