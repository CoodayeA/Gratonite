/**
 * Messages domain: message CRUD, reactions, pins, typing, threads, search.
 */
import { apiFetch, buildQuery } from './_core';
import type { Message, Thread, CursorPaginationParams, SearchMessagesResponse, InviteInfo, Guild } from './_core';

export const messagesApi = {
  list: (channelId: string, params?: CursorPaginationParams) =>
    apiFetch<Message[]>(
      `/channels/${channelId}/messages${params ? '?' + buildQuery(params) : ''}`,
    ),

  send: (channelId: string, data: { content?: string | null; nonce?: string; messageReference?: { messageId: string }; attachmentIds?: string[]; replyToId?: string; threadId?: string; expiresIn?: number; isEncrypted?: boolean; encryptedContent?: string; keyVersion?: number; embeds?: Record<string, unknown>[] }) =>
    apiFetch<Message>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  edit: (channelId: string, messageId: string, data: { content?: string; encryptedContent?: string; isEncrypted?: boolean; keyVersion?: number }) =>
    apiFetch<Message>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (channelId: string, messageId: string) =>
    apiFetch<void>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
    }),

  bulkDelete: (channelId: string, ids: string[]) =>
    apiFetch<{ deleted: number }>(`/channels/${channelId}/messages/bulk`, {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    }),

  addReaction: (channelId: string, messageId: string, emoji: string) =>
    apiFetch<void>(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
      method: 'PUT',
    }),

  removeReaction: (channelId: string, messageId: string, emoji: string) =>
    apiFetch<void>(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
      method: 'DELETE',
    }),

  getReactions: (channelId: string, messageId: string) =>
    apiFetch<any[]>(`/channels/${channelId}/messages/${messageId}/reactions`),

  getPins: (channelId: string) =>
    apiFetch<Message[]>(`/channels/${channelId}/pins`),

  pin: (channelId: string, messageId: string) =>
    apiFetch<void>(`/channels/${channelId}/pins/${messageId}`, { method: 'PUT' }),

  unpin: (channelId: string, messageId: string) =>
    apiFetch<void>(`/channels/${channelId}/pins/${messageId}`, { method: 'DELETE' }),

  startTyping: (channelId: string) =>
    apiFetch<void>(`/channels/${channelId}/messages/typing`, { method: 'POST' }),

  markRead: (channelId: string, lastReadMessageId?: string) =>
    apiFetch<{ ok: boolean }>(`/channels/${channelId}/messages/read`, { method: 'POST', body: JSON.stringify(lastReadMessageId ? { lastReadMessageId } : {}) }),

  ack: (channelId: string, lastMessageId?: string) =>
    apiFetch<void>(`/channels/${channelId}/messages/ack`, { method: 'POST', body: JSON.stringify(lastMessageId ? { lastMessageId } : {}) }),

  getReadState: (channelId: string) =>
    apiFetch<{ userId: string; lastReadAt: string; lastReadMessageId: string | null }[]>(`/channels/${channelId}/messages/read-state`),

  setDisappearTimer: (channelId: string, seconds: number | null) =>
    apiFetch<{ disappearTimer: number | null }>(`/channels/${channelId}/messages/disappear-timer`, { method: 'PATCH', body: JSON.stringify({ seconds }) }),

  translate: (channelId: string, messageId: string, targetLang?: string) =>
    apiFetch<{ translatedText: string; detectedLanguage: string }>(`/channels/${channelId}/messages/${messageId}/translate`, {
      method: 'POST',
      body: JSON.stringify({ targetLang: targetLang || 'en' }),
    }),

  jumpToDate: (channelId: string, date: string) =>
    apiFetch<{ targetMessageId: string; messages: Message[] }>(`/channels/${channelId}/messages/jump-to-date?date=${encodeURIComponent(date)}`),
};

export const searchApi = {
  messages: (params: { query: string; guildId?: string; channelId?: string; authorId?: string; before?: string; after?: string; has?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    query.set('query', params.query);
    if (params.guildId) query.set('guildId', params.guildId);
    if (params.channelId) query.set('channelId', params.channelId);
    if (params.authorId) query.set('authorId', params.authorId);
    if (params.before) query.set('before', params.before);
    if (params.after) query.set('after', params.after);
    if (params.has) query.set('has', params.has);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    return apiFetch<SearchMessagesResponse>(`/search/messages?${query.toString()}`);
  },
};

export const threadsApi = {
  create: (channelId: string, data: { name: string; body?: string; type?: string; archiveAfter?: number; message?: string; messageId?: string }) =>
    apiFetch<Thread>(`/channels/${channelId}/threads`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: (channelId: string, sort?: string) =>
    apiFetch<Thread[]>(`/channels/${channelId}/threads${sort ? `?sort=${sort}` : ''}`),

  get: (threadId: string) =>
    apiFetch<Thread>(`/threads/${threadId}`),

  listMessages: (threadId: string, limit?: number) =>
    apiFetch<Message[]>(`/threads/${threadId}/messages${limit ? `?limit=${limit}` : ''}`),

  join: (threadId: string) =>
    apiFetch<void>(`/threads/${threadId}/members/@me`, { method: 'PUT' }),

  leave: (threadId: string) =>
    apiFetch<void>(`/threads/${threadId}/members/@me`, { method: 'DELETE' }),
};

export const invitesApi = {
  get: (code: string) => apiFetch<InviteInfo>(`/invites/${code}`),

  accept: (code: string) =>
    apiFetch<Guild>(`/invites/${code}`, { method: 'POST' }),

  create: (guildId: string, data: { maxUses?: number; expiresIn?: number }) =>
    apiFetch<{ code: string; expiresAt: string | null }>(`/guilds/${guildId}/invites`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: (guildId: string) =>
    apiFetch<InviteInfo[]>(`/guilds/${guildId}/invites`),

  delete: (code: string) =>
    apiFetch<void>(`/invites/${code}`, { method: 'DELETE' }),
};

export const filesApi = {
  upload: (file: File, purpose: string = 'upload') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);
    return apiFetch<{ id: string; url: string; filename: string; size: number; mimeType: string }>('/files/upload', {
      method: 'POST',
      body: formData,
    });
  },
};
