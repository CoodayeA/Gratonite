/**
 * Misc domain: everything not covered by auth, users, guilds, channels,
 * messages, voice, or themes.
 */
import { apiFetch, ApiRequestError, walletRequestPromise, setWalletRequestPromise } from './_core';
import type {
  CommunityShopItem,
  CurrencyWallet,
  CurrencyLedgerEntry,
  ShopItem,
  InventoryItem,
  BetaBugReport,
  BetaBugReportInboxItem,
  ClientTelemetryEvent,
} from './_core';

export const communityShopApi = {
  listItems: (params: {
    itemType?: string;
    status?: string;
    search?: string;
    mine?: boolean;
    limit?: number;
    offset?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.itemType) query.set('itemType', params.itemType);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);
    if (params.mine !== undefined) query.set('mine', String(params.mine));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.offset !== undefined) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<CommunityShopItem[]>(`/community-items${suffix}`);
  },

  createItem: (data: {
    itemType: CommunityShopItem['itemType'];
    name: string;
    description?: string;
    payload?: Record<string, unknown>;
    payloadSchemaVersion?: number;
    assetHash?: string;
    tags?: string[];
  }) =>
    apiFetch<any>('/cosmetics', {
      method: 'POST',
      body: JSON.stringify({
        name: data.name,
        type: data.itemType,
        description: data.description,
        assetUrl: data.assetHash,
        price: (data.payload as Record<string, unknown>)?.proposedPrice ?? 0,
      }),
    }).then((r: Record<string, unknown>): CommunityShopItem => ({
      id: r.id as string,
      itemType: r.type as CommunityShopItem['itemType'],
      name: r.name as string,
      description: r.description as string | null,
      uploaderId: r.creatorId as string,
      payload: {},
      payloadSchemaVersion: 1,
      assetHash: (r.assetUrl as string) ?? null,
      tags: [],
      status: (r.isPublished as boolean) ? 'published' : 'draft',
      moderationNotes: null,
      rejectionCode: null,
      publishedAt: (r.isPublished as boolean) ? (r.updatedAt as string) : null,
      createdAt: r.createdAt as string,
      updatedAt: r.updatedAt as string,
      installCount: 0,
    })),

  submitForReview: (itemId: string) =>
    apiFetch<any>(`/cosmetics/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished: true }),
    }).then((r: Record<string, unknown>): CommunityShopItem => ({
      id: r.id as string,
      itemType: r.type as CommunityShopItem['itemType'],
      name: r.name as string,
      description: r.description as string | null,
      uploaderId: r.creatorId as string,
      payload: {},
      payloadSchemaVersion: 1,
      assetHash: (r.assetUrl as string) ?? null,
      tags: [],
      status: 'published',
      moderationNotes: null,
      rejectionCode: null,
      publishedAt: r.updatedAt as string,
      createdAt: r.createdAt as string,
      updatedAt: r.updatedAt as string,
      installCount: 0,
    })),

  install: (itemId: string, _data: { scope?: 'global' | 'guild'; scopeId?: string } = {}) =>
    apiFetch<any>(`/cosmetics/${itemId}/purchase`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  uninstall: (_itemId: string, _data: { scope?: 'global' | 'guild'; scopeId?: string } = {}) =>
    Promise.resolve() as Promise<void>,

  getMyItems: async () => {
    const rows = await apiFetch<any[]>('/cosmetics/mine');
    return {
      created: rows.map((r: Record<string, unknown>): CommunityShopItem => ({
        id: r.id as string,
        itemType: r.type as CommunityShopItem['itemType'],
        name: r.name as string,
        description: r.description as string | null,
        uploaderId: r.creatorId as string,
        payload: {},
        payloadSchemaVersion: 1,
        assetHash: (r.assetUrl as string) ?? null,
        tags: [],
        status: (r.isPublished as boolean) ? 'published' : 'draft',
        moderationNotes: null,
        rejectionCode: null,
        publishedAt: (r.isPublished as boolean) ? (r.updatedAt as string) : null,
        createdAt: r.createdAt as string,
        updatedAt: r.updatedAt as string,
        installCount: 0,
      })),
      installed: [],
    };
  },
};

export const economyApi = {
  getWallet: () => {
    if (walletRequestPromise) return walletRequestPromise;
    const p = apiFetch<CurrencyWallet>('/economy/wallet').finally(() => {
      setWalletRequestPromise(null);
    });
    setWalletRequestPromise(p);
    return p;
  },

  getLedger: (limit = 20) =>
    apiFetch<CurrencyLedgerEntry[]>(`/economy/ledger?limit=${limit}`),

  claimReward: (data: {
    source: 'chat_message' | 'server_engagement' | 'daily_checkin';
    contextKey?: string;
  }) =>
    apiFetch<{ wallet: CurrencyWallet; ledgerEntry: CurrencyLedgerEntry | null; amount: number; nextClaimAt?: string }>('/economy/rewards/claim', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  spend: (data: {
    source: 'shop_purchase' | 'creator_item_purchase';
    amount: number;
    description: string;
    contextKey?: string;
  }) =>
    apiFetch<{ wallet: CurrencyWallet | null; ledgerEntry: CurrencyLedgerEntry | null }>('/economy/spend', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const relationshipsApi = {
  getAll: () =>
    apiFetch<any[]>('/relationships'),

  sendFriendRequest: (userId: string) =>
    apiFetch<any>('/relationships/friends', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  acceptFriendRequest: (userId: string) =>
    apiFetch<any>(`/relationships/friends/${userId}`, { method: 'PUT' }),

  removeFriend: (userId: string) =>
    apiFetch<void>(`/relationships/friends/${userId}`, { method: 'DELETE' }),

  block: (userId: string) =>
    apiFetch<void>(`/relationships/blocks/${userId}`, { method: 'PUT' }),

  unblock: (userId: string) =>
    apiFetch<void>(`/relationships/blocks/${userId}`, { method: 'DELETE' }),

  listBlocked: () =>
    apiFetch<Array<{ blockedUserId: string; username: string; displayName: string; avatarHash: string | null; createdAt: string }>>('/relationships/blocks'),

  listFriends: () =>
    apiFetch<any[]>('/relationships').then((rels: any[]) => (rels || []).filter((r: any) => r.type === 'FRIEND' || r.type === 'friend')),

  getDmChannels: () =>
    apiFetch<any[]>('/relationships/channels'),

  openDm: (userId: string) =>
    apiFetch<any>('/relationships/channels', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Friend groups
  getGroups: () =>
    apiFetch<{ id: string; name: string; color: string; position: number; friendIds: string[] }[]>('/relationships/groups'),

  createGroup: (name: string, color?: string) =>
    apiFetch<{ id: string; name: string; color: string; position: number; friendIds: string[] }>('/relationships/groups', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),

  updateGroup: (groupId: string, data: { name?: string; color?: string }) =>
    apiFetch<any>(`/relationships/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteGroup: (groupId: string) =>
    apiFetch<void>(`/relationships/groups/${groupId}`, { method: 'DELETE' }),

  addToGroup: (groupId: string, userId: string) =>
    apiFetch<void>(`/relationships/groups/${groupId}/members/${userId}`, { method: 'PUT' }),

  removeFromGroup: (groupId: string, userId: string) =>
    apiFetch<void>(`/relationships/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
};

export const groupDmsApi = {
  create: (userIds: string[], name?: string) =>
    apiFetch<any>('/dms/group', {
      method: 'POST',
      body: JSON.stringify({ userIds, name }),
    }),

  addMember: (channelId: string, userId: string) =>
    apiFetch<any>(`/dms/group/${channelId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  removeMember: (channelId: string, userId: string) =>
    apiFetch<any>(`/dms/group/${channelId}/members/${userId}`, {
      method: 'DELETE',
    }),

  update: (channelId: string, data: { groupName?: string; groupIcon?: string }) =>
    apiFetch<any>(`/dms/group/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export const messageRequestsApi = {
  list: (bucket: 'requests' | 'spam' = 'requests') =>
    apiFetch<Array<{
      id: string;
      user: {
        id: string;
        username: string;
        displayName: string;
        avatarHash: string | null;
      };
      isSpam: boolean;
      preview: string;
      createdAt: string;
      mutualServers: number;
    }>>(`/relationships/message-requests?bucket=${bucket}`),

  accept: (userId: string) =>
    apiFetch<{ code: string; message: string }>(`/relationships/message-requests/${userId}/accept`, {
      method: 'POST',
    }),

  ignore: (userId: string) =>
    apiFetch<{ code: string; message: string }>(`/relationships/message-requests/${userId}/ignore`, {
      method: 'POST',
    }),

  report: (userId: string) =>
    apiFetch<{ code: string; message: string }>(`/relationships/message-requests/${userId}/report`, {
      method: 'POST',
    }),
};

export const bugReportsApi = {
  create: (data: {
    title: string;
    summary: string;
    steps?: string;
    expected?: string;
    actual?: string;
    route?: string;
    pageUrl?: string;
    channelLabel?: string;
    viewport?: string;
    userAgent?: string;
    clientTimestamp?: string;
    metadata?: Record<string, unknown>;
    attachments?: string[];
  }) =>
    apiFetch<BetaBugReport>('/bug-reports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  list: (params: {
    status?: 'open' | 'triaged' | 'resolved' | 'dismissed';
    mine?: boolean;
    limit?: number;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.mine !== undefined) query.set('mine', String(params.mine));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<{ items: BetaBugReportInboxItem[]; adminView: boolean }>(`/bug-reports${suffix}`);
  },

  updateStatus: (reportId: string, status: 'open' | 'triaged' | 'resolved' | 'dismissed') =>
    apiFetch<BetaBugReport>(`/bug-reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export const shopApi = {
  getItems: () => apiFetch<ShopItem[]>('/shop/items'),
  getInventory: () => apiFetch<any[]>('/shop/inventory'),
  purchase: (itemId: string, idempotencyKey?: string) => apiFetch<any>('/shop/purchase', {
    method: 'POST',
    body: JSON.stringify({ itemId, idempotencyKey }),
  }),
  equipItem: async (itemId: string) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await apiFetch<any>(`/shop/items/${itemId}/equip`, { method: 'PATCH' });
      } catch (err: unknown) {
        lastErr = err;
        const retriable = err instanceof ApiRequestError && err.status >= 500;
        if (!retriable || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
      }
    }
    throw lastErr;
  },
  unequipItem: (itemId: string) => apiFetch<void>(`/shop/items/${itemId}/equip`, { method: 'DELETE' }),
};

export const inventoryApi = {
  get: () => apiFetch<{ items: InventoryItem[] }>('/inventory'),
};

export const auctionsApi = {
  list: (params?: { type?: string; sort?: string; search?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.search) qs.set('search', params.search);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return apiFetch<any[]>(`/auctions${query ? `?${query}` : ''}`);
  },
  get: (auctionId: string) => apiFetch<any>(`/auctions/${auctionId}`),
  create: (data: { cosmeticId: string; startingPrice: number; reservePrice?: number; durationHours: number }) =>
    apiFetch<any>('/auctions', { method: 'POST', body: JSON.stringify(data) }),
  bid: (auctionId: string, amount: number) =>
    apiFetch<any>(`/auctions/${auctionId}/bid`, { method: 'POST', body: JSON.stringify({ amount }) }),
  cancel: (auctionId: string) =>
    apiFetch<void>(`/auctions/${auctionId}`, { method: 'DELETE' }),
  mySelling: () => apiFetch<any[]>('/auctions/me/selling'),
  myBids: () => apiFetch<any[]>('/auctions/me/bids'),
};

export const marketplaceApi = {
  listItem: (data: {
    name: string;
    description?: string;
    type: 'avatar_frame' | 'decoration' | 'profile_effect' | 'nameplate' | 'soundboard';
    price: number;
    previewImageUrl?: string;
    assetUrl?: string;
    category?: string;
    metadata?: Record<string, unknown>;
  }) => apiFetch<{ listingId: string; createdAt: string }>('/marketplace/listings', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

export const botApplicationsApi = {
  create: (data: { name: string; description?: string; webhookUrl: string; avatarHash?: string }) =>
    apiFetch<any>('/bots/applications', { method: 'POST', body: JSON.stringify(data) }),
  listMine: () => apiFetch<any[]>('/bots/applications/mine'),
  get: (id: string) => apiFetch<any>(`/bots/applications/${id}`),
  update: (id: string, data: { name?: string; description?: string; webhookUrl?: string; isActive?: boolean }) =>
    apiFetch<any>(`/bots/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch<void>(`/bots/applications/${id}`, { method: 'DELETE' }),
  rotate: (id: string) => apiFetch<{ apiToken: string }>(`/bots/applications/${id}/rotate`, { method: 'POST' }),
};

export const wikiApi = {
  listPages: (channelId: string) =>
    apiFetch<any[]>(`/channels/${channelId}/wiki`),
  createPage: (channelId: string, data: { title: string; content: string }) =>
    apiFetch<any>(`/channels/${channelId}/wiki`, { method: 'POST', body: JSON.stringify(data) }),
  getPage: (pageId: string) =>
    apiFetch<any>(`/wiki/${pageId}`),
  updatePage: (pageId: string, data: { title?: string; content?: string }) =>
    apiFetch<any>(`/wiki/${pageId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePage: (pageId: string) =>
    apiFetch<void>(`/wiki/${pageId}`, { method: 'DELETE' }),
  getRevisions: (pageId: string) =>
    apiFetch<any[]>(`/wiki/${pageId}/revisions`),
  revertRevision: (pageId: string, revisionId: string) =>
    apiFetch<any>(`/wiki/${pageId}/revert/${revisionId}`, { method: 'POST' }),
};

function assertGuildId(guildId: string): asserts guildId is string {
  if (!guildId || guildId === 'null' || guildId === 'undefined') {
    throw new Error(`Invalid guildId: ${guildId}`);
  }
}

export const eventsApi = {
  list: (guildId: string) => { assertGuildId(guildId); return apiFetch<any[]>(`/guilds/${guildId}/scheduled-events`); },
  get: (guildId: string, eventId: string) =>
    apiFetch<any>(`/guilds/${guildId}/scheduled-events/${eventId}`),
  create: (guildId: string, data: { name: string; description?: string; startTime: string; endTime?: string; entityType: 'STAGE' | 'VOICE' | 'EXTERNAL'; location?: string; channelId?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/scheduled-events`, { method: 'POST', body: JSON.stringify(data) }),
  update: (guildId: string, eventId: string, data: { name?: string; description?: string; startTime?: string; endTime?: string; status?: string; location?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/scheduled-events/${eventId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (guildId: string, eventId: string) =>
    apiFetch<void>(`/guilds/${guildId}/scheduled-events/${eventId}`, { method: 'DELETE' }),
  markInterested: (guildId: string, eventId: string) =>
    apiFetch<void>(`/guilds/${guildId}/scheduled-events/${eventId}/interested`, { method: 'PUT' }),
  unmarkInterested: (guildId: string, eventId: string) =>
    apiFetch<void>(`/guilds/${guildId}/scheduled-events/${eventId}/interested`, { method: 'DELETE' }),
};

export const pollsApi = {
  list: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/polls`),
  get: (pollId: string) => apiFetch<any>(`/polls/${pollId}`),
  create: (channelId: string, data: { question: string; options: string[]; duration?: number; multiselect?: boolean }) =>
    apiFetch<any>(`/channels/${channelId}/polls`, { method: 'POST', body: JSON.stringify(data) }),
  vote: (pollId: string, optionIds: string[]) =>
    apiFetch<any>(`/polls/${pollId}/answers`, { method: 'POST', body: JSON.stringify({ optionIds }) }),
  removeVote: (pollId: string) => apiFetch<void>(`/polls/${pollId}/answers/@me`, { method: 'DELETE' }),
  end: (pollId: string) => apiFetch<void>(`/polls/${pollId}/expire`, { method: 'POST' }),
  getVoters: (pollId: string, optionId: string) =>
    apiFetch<any[]>(`/polls/${pollId}/answers/${optionId}/voters`),
};

export const scheduledMessagesApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/scheduled-messages`),
  create: (guildId: string, data: { channelId: string; content: string; scheduledFor: string }) =>
    apiFetch<any>(`/guilds/${guildId}/scheduled-messages`, { method: 'POST', body: JSON.stringify(data) }),
  get: (guildId: string, messageId: string) =>
    apiFetch<any>(`/guilds/${guildId}/scheduled-messages/${messageId}`),
  delete: (guildId: string, messageId: string) =>
    apiFetch<void>(`/guilds/${guildId}/scheduled-messages/${messageId}`, { method: 'DELETE' }),
};

export const leaderboardApi = {
  get: (period: 'week' | 'month' | 'all' = 'week') =>
    apiFetch<Array<{
      rank: number;
      userId: string;
      username: string;
      displayName: string;
      avatarHash: string | null;
      fameReceived: number;
      memberSince: string;
    }>>(`/leaderboard?period=${period}`),
  getGuild: (guildId: string, period: 'week' | 'month' | 'all' = 'week') =>
    apiFetch<Array<{
      rank: number;
      userId: string;
      username: string;
      displayName: string;
      avatarHash: string | null;
      fameReceived: number;
      memberSince: string;
    }>>(`/guilds/${guildId}/leaderboard?period=${period}`),
};

export const cosmeticsApi = {
  browse: (params?: { type?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return apiFetch<any[]>(`/cosmetics/marketplace${query ? `?${query}` : ''}`);
  },
  get: (cosmeticId: string) => apiFetch<any>(`/cosmetics/${cosmeticId}`),
  listByCreator: (creatorId: string, params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return apiFetch<any[]>(`/cosmetics/creator/${creatorId}${query ? `?${query}` : ''}`);
  },
  listMine: () => apiFetch<any[]>('/cosmetics/mine'),
  create: (data: { name: string; description?: string; type: string; previewImageUrl?: string; assetUrl?: string; price?: number }) =>
    apiFetch<any>('/cosmetics', { method: 'POST', body: JSON.stringify(data) }),
  update: (cosmeticId: string, data: { name?: string; description?: string; previewImageUrl?: string; assetUrl?: string; price?: number; isPublished?: boolean }) =>
    apiFetch<any>(`/cosmetics/${cosmeticId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (cosmeticId: string) => apiFetch<void>(`/cosmetics/${cosmeticId}`, { method: 'DELETE' }),
  upload: (formData: FormData) =>
    apiFetch<{ preview_image_url?: string; asset_url?: string }>('/cosmetics/upload', { method: 'POST', body: formData }),
  purchase: (cosmeticId: string) =>
    apiFetch<any>(`/cosmetics/${cosmeticId}/purchase`, { method: 'POST' }),
  equip: (cosmeticId: string) =>
    apiFetch<any>(`/cosmetics/${cosmeticId}/equip`, { method: 'PATCH' }),
  unequip: (cosmeticId: string) =>
    apiFetch<void>(`/cosmetics/${cosmeticId}/equip`, { method: 'DELETE' }),
  getEquipped: () =>
    apiFetch<Array<{ type: string; cosmeticId: string; name: string; assetUrl: string | null; previewImageUrl: string | null }>>('/users/@me/equipped-cosmetics'),
  getStats: (cosmeticId: string) =>
    apiFetch<{ cosmeticId: string; totalSales: number; totalRevenueGratonites: number; createdAt: string; updatedAt: string }>(`/cosmetics/${cosmeticId}/stats`),
  submitForReview: (cosmeticId: string) =>
    apiFetch<any>(`/cosmetics/${cosmeticId}/submit`, { method: 'PATCH' }),
  uploadAsset: (cosmeticId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch<{ assetUrl: string }>(`/cosmetics/${cosmeticId}/upload`, { method: 'POST', body: formData });
  },
  equipCosmetic: (cosmeticId: string) =>
    apiFetch<any>(`/cosmetics/${cosmeticId}/equip`, { method: 'PATCH' }),
};

export const interactionsApi = {
  create: (channelId: string, data: { commandId: string; options?: Record<string, unknown> }) =>
    apiFetch<any>(`/channels/${channelId}/interactions`, { method: 'POST', body: JSON.stringify(data) }),
  component: (channelId: string, messageId: string, customId: string, data?: { values?: string[] }) =>
    apiFetch<any>(`/channels/${channelId}/messages/${messageId}/components/${encodeURIComponent(customId)}/interactions`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
};

export const botStoreApi = {
  list: (params?: { category?: string; verified?: boolean; search?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set('category', params.category);
    if (params?.verified !== undefined) q.set('verified', String(params.verified));
    if (params?.search) q.set('search', params.search);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/bot-store?${q}`);
  },
  get: (listingId: string) => apiFetch<any>(`/bot-store/${listingId}`),
  reviews: (listingId: string, limit = 25, offset = 0) =>
    apiFetch<{ items: Array<Record<string, unknown>> }>(`/bot-store/${listingId}/reviews?limit=${limit}&offset=${offset}`),
  postReview: (listingId: string, data: { rating: number; content: string }) =>
    apiFetch<any>(`/bot-store/${listingId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  updateReview: (listingId: string, reviewId: string, data: { rating?: number; content?: string }) =>
    apiFetch<any>(`/bot-store/${listingId}/reviews/${reviewId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteReview: (listingId: string, reviewId: string) =>
    apiFetch<void>(`/bot-store/${listingId}/reviews/${reviewId}`, { method: 'DELETE' }),
  createListing: (data: { applicationId?: string; name?: string; shortDescription: string; longDescription?: string; category: string; tags?: string[]; iconUrl?: string; bannerUrl?: string }) =>
    apiFetch<any>('/bot-store/listings', { method: 'POST', body: JSON.stringify(data) }),
  updateListing: (listingId: string, data: { shortDescription?: string; longDescription?: string; category?: string; tags?: string[]; listed?: boolean }) =>
    apiFetch<any>(`/bot-store/listings/${listingId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteListing: (listingId: string) =>
    apiFetch<void>(`/bot-store/listings/${listingId}`, { method: 'DELETE' }),
  developerListings: () => apiFetch<{ items: Array<Record<string, unknown>> }>('/bot-store/listings/mine'),
};

export const botInstallsApi = {
  list: (guildId: string) => apiFetch<any[]>(`/bots/installs/${guildId}`),
  install: (guildId: string, applicationId: string) =>
    apiFetch<any>('/bots/installs', { method: 'POST', body: JSON.stringify({ guildId, applicationId }) }),
  uninstall: (guildId: string, appId: string) =>
    apiFetch<any>(`/bots/installs/${guildId}/${appId}`, { method: 'DELETE' }),
  listBotGuilds: (appId: string) =>
    apiFetch<any[]>(`/bots/${appId}/installs`),
};

export const webhooksApi = {
  listByGuild: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/webhooks`),
  listByChannel: (channelId: string) => apiFetch<any[]>(`/webhooks/channel/${channelId}`),
  create: (data: { channelId: string; name: string; avatarUrl?: string }) =>
    apiFetch<any>(`/channels/${data.channelId}/webhooks`, { method: 'POST', body: JSON.stringify({ name: data.name, avatarUrl: data.avatarUrl }) }),
  delete: (webhookId: string) => apiFetch<void>(`/webhooks/${webhookId}`, { method: 'DELETE' }),
  getDeliveries: (webhookId: string) =>
    apiFetch<Array<{ id: string; webhookId: string; eventType: string; responseStatus: number | null; success: boolean; durationMs: number | null; attemptedAt: string }>>(`/webhooks/${webhookId}/deliveries`),
};

export const adminTeamApi = {
  list: () => apiFetch<{ items: Array<Record<string, unknown>> }>('/admin/team'),
  invite: (data: { email: string; role: 'admin' | 'moderator' | 'support' }) =>
    apiFetch<any>('/admin/team/invite', { method: 'POST', body: JSON.stringify(data) }),
  acceptInvite: (token: string) =>
    apiFetch<any>('/admin/team/accept', { method: 'POST', body: JSON.stringify({ token }) }),
  updateRole: (userId: string, role: 'admin' | 'moderator' | 'support') =>
    apiFetch<any>(`/admin/team/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  remove: (userId: string) =>
    apiFetch<any>(`/admin/team/${userId}`, { method: 'DELETE' }),
};

export const adminAuditApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/admin/audit-log?${q}`);
  },
};

export const adminBotStoreApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/admin/bot-store?${q}`);
  },
  toggleVerified: (listingId: string) =>
    apiFetch<any>(`/admin/bot-store/${listingId}/verify`, { method: 'PATCH' }),
  forceDelist: (listingId: string) =>
    apiFetch<any>(`/admin/bot-store/${listingId}/delist`, { method: 'PATCH' }),
  deleteReview: (reviewId: string) =>
    apiFetch<void>(`/admin/bot-store/reviews/${reviewId}`, { method: 'DELETE' }),
};

export const feedbackApi = {
  submit: (data: { category: string; title: string; body: string }) =>
    apiFetch<any>('/feedback', { method: 'POST', body: JSON.stringify(data) }),
  mine: () => apiFetch<{ items: Array<Record<string, unknown>> }>('/feedback/mine'),
  list: (params?: { status?: string; category?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.category) q.set('category', params.category);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/admin/feedback?${q}`);
  },
  updateStatus: (feedbackId: string, data: { status?: string; adminNotes?: string }) =>
    apiFetch<any>(`/admin/feedback/${feedbackId}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const reportsApi = {
  submit: (data: { targetType: 'message' | 'user' | 'guild' | 'bot' | 'channel'; targetId: string; reason: string; details?: string }) =>
    apiFetch<any>('/reports', { method: 'POST', body: JSON.stringify(data) }),
  list: (params?: { status?: string; targetType?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.targetType) q.set('targetType', params.targetType);
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    return apiFetch<{ items: Array<Record<string, unknown>> }>(`/admin/reports?${q}`);
  },
  updateStatus: (reportId: string, data: { status?: string; adminNotes?: string }) =>
    apiFetch<any>(`/admin/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const adminPortalsApi = {
  list: () =>
    apiFetch<{ items: Array<{
      id: string;
      name: string;
      description: string | null;
      iconHash: string | null;
      memberCount: number;
      isDiscoverable: boolean;
      isFeatured: boolean;
      isPinned: boolean;
      discoverRank: number;
      createdAt: string;
    }> }>('/admin/portals'),
  update: (guildId: string, data: { isPinned?: boolean; isFeatured?: boolean; isPublic?: boolean }) =>
    apiFetch<any>(`/admin/portals/${guildId}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const telemetryApi = {
  captureClientEvent: (payload: ClientTelemetryEvent) => {
    const clean: Record<string, unknown> = { ...payload };
    if (clean.guildId && typeof clean.guildId === 'string' && !UUID_RE.test(clean.guildId)) {
      delete clean.guildId;
    }
    if (!clean.timestamp) {
      clean.timestamp = new Date().toISOString();
    }
    return apiFetch<{ ok: true }>('/telemetry/client-events', {
      method: 'POST',
      body: JSON.stringify(clean),
    });
  },
};

export const notificationsApi = {
  list: (limit = 50) =>
    apiFetch<{ id: string; type: string; senderId: string | null; senderName: string | null; channelId: string | null; guildId: string | null; guildName: string | null; messageId: string | null; content: string; preview: string | null; read: boolean; createdAt: string }[]>(`/notifications?limit=${limit}`),
  markRead: (notificationId: string) =>
    apiFetch<void>(`/notifications/${notificationId}/read`, { method: 'POST' }),
  markAllRead: () =>
    apiFetch<void>('/notifications/read-all', { method: 'POST' }),
  dismiss: (notificationId: string) =>
    apiFetch<void>(`/notifications/${notificationId}`, { method: 'DELETE' }),
  clearAll: () =>
    apiFetch<void>('/notifications', { method: 'DELETE' }),
};

export const bookmarksApi = {
  list: (params?: { folderId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.folderId) query.set('folderId', params.folderId);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<any[]>(`/users/@me/bookmarks${qs ? '?' + qs : ''}`);
  },
  add: (messageId: string, data?: { note?: string; folderId?: string }) =>
    apiFetch<any>('/users/@me/bookmarks', { method: 'POST', body: JSON.stringify({ messageId, ...data }) }),
  update: (bookmarkId: string, data: { folderId?: string | null; note?: string | null }) =>
    apiFetch<any>(`/users/@me/bookmarks/${bookmarkId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (messageId: string) =>
    apiFetch<void>(`/users/@me/bookmarks/${messageId}`, { method: 'DELETE' }),
  folders: {
    list: () => apiFetch<any[]>('/users/@me/bookmark-folders'),
    create: (data: { name: string; color?: string }) =>
      apiFetch<any>('/users/@me/bookmark-folders', { method: 'POST', body: JSON.stringify(data) }),
    update: (folderId: string, data: { name?: string; color?: string }) =>
      apiFetch<any>(`/users/@me/bookmark-folders/${folderId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (folderId: string) =>
      apiFetch<void>(`/users/@me/bookmark-folders/${folderId}`, { method: 'DELETE' }),
  },
};

export const workflowsApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/workflows`),
  create: (guildId: string, data: { name: string; triggers: Array<{ type: string; config?: Record<string, unknown> }>; actions: Array<{ order: number; type: string; config?: Record<string, unknown> }> }) =>
    apiFetch<any>(`/guilds/${guildId}/workflows`, { method: 'POST', body: JSON.stringify(data) }),
  update: (guildId: string, workflowId: string, data: { name?: string; enabled?: boolean; triggers?: Array<{ type: string; config?: Record<string, unknown> }>; actions?: Array<{ order: number; type: string; config?: Record<string, unknown> }> }) =>
    apiFetch<any>(`/guilds/${guildId}/workflows/${workflowId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (guildId: string, workflowId: string) =>
    apiFetch<void>(`/guilds/${guildId}/workflows/${workflowId}`, { method: 'DELETE' }),
};

export const fameApi = {
  give: (userId: string, data: { messageId?: string; guildId: string; channelId?: string }) =>
    apiFetch<{ success: boolean; fameGiven: number; remaining: number }>(`/users/${userId}/fame`, { method: 'POST', body: JSON.stringify(data) }),
  getStats: (userId: string) =>
    apiFetch<{ fameReceived: number; fameGiven: number }>(`/users/${userId}/fame`),
  getRemaining: () =>
    apiFetch<{ remaining: number; used: number }>('/users/@me/fame/remaining'),
};

export const stageApi = {
  getSession: (channelId: string) =>
    apiFetch<{ session: { id: string; channelId: string; hostId: string | null; topic: string | null; startedAt: string; endedAt: string | null } | null; speakers: Array<{ id: string; sessionId: string; userId: string; invitedBy: string | null; joinedAt: string }> }>(`/channels/${channelId}/stage`),
  startSession: (channelId: string, data?: { topic?: string }) =>
    apiFetch<{ session: { id: string; channelId: string; hostId: string | null; topic: string | null; startedAt: string; endedAt: string | null }; speakers: Array<unknown> }>(`/channels/${channelId}/stage/start`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  endSession: (channelId: string) =>
    apiFetch<{ session: { id: string; endedAt: string | null } }>(`/channels/${channelId}/stage`, { method: 'DELETE' }),
  inviteSpeaker: (channelId: string, userId: string) =>
    apiFetch<{ speaker: unknown }>(`/channels/${channelId}/stage/speakers`, { method: 'POST', body: JSON.stringify({ userId }) }),
  removeSpeaker: (channelId: string, userId: string) =>
    apiFetch<void>(`/channels/${channelId}/stage/speakers/${userId}`, { method: 'DELETE' }),
  raiseHand: (channelId: string) =>
    apiFetch<{ code: string }>(`/channels/${channelId}/stage/request-speak`, { method: 'POST', body: JSON.stringify({}) }),
};

export const stickersApi = {
  getDefault: () => apiFetch<any[]>('/stickers/default'),
  getGuildStickers: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/stickers`),
};

export const pushApi = {
  getVapidPublicKey: () => apiFetch<{ key: string }>('/push/vapid-public-key'),
  subscribe: (sub: Record<string, unknown>) => apiFetch<any>('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
  unsubscribe: (endpoint: string) => apiFetch<any>('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
};

export const draftsApi = {
  listAll: () => apiFetch<Array<{ channelId: string; content: string }>>('/users/@me/drafts'),
  get: (channelId: string) => apiFetch<any>(`/channels/${channelId}/draft`),
  save: (channelId: string, content: string) =>
    apiFetch<any>(`/channels/${channelId}/draft`, { method: 'PUT', body: JSON.stringify({ content }) }),
  remove: (channelId: string) =>
    apiFetch<void>(`/channels/${channelId}/draft`, { method: 'DELETE' }),
};

export const mutesApi = {
  list: () => apiFetch<Array<{ mutedUserId: string; createdAt: string; username: string; displayName: string; avatarHash: string | null }>>('/users/@me/mutes'),
  mute: (userId: string) => apiFetch<void>(`/users/@me/mutes/${userId}`, { method: 'PUT' }),
  unmute: (userId: string) => apiFetch<void>(`/users/@me/mutes/${userId}`, { method: 'DELETE' }),
};

export const channelNotifPrefsApi = {
  get: (channelId: string) =>
    apiFetch<{ level: string; mutedUntil: string | null }>(`/channels/${channelId}/notification-prefs`),
  set: (channelId: string, level: string, mutedUntil?: string | null) =>
    apiFetch<any>(`/channels/${channelId}/notification-prefs`, { method: 'PUT', body: JSON.stringify({ level, mutedUntil }) }),
};

export const wordFilterApi = {
  get: (guildId: string) =>
    apiFetch<{ words: string[]; action: 'block' | 'delete' | 'warn'; exemptRoles: string[] }>(`/guilds/${guildId}/word-filter`),
  set: (guildId: string, data: { words: string[]; action: 'block' | 'delete' | 'warn'; exemptRoles: string[] }) =>
    apiFetch<any>(`/guilds/${guildId}/word-filter`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const oauthAppsApi = {
  list: () => apiFetch<any[]>('/oauth/applications'),
  create: (data: { name: string; description?: string; redirectUris?: string[]; scopes?: string[] }) =>
    apiFetch<any>('/oauth/applications', { method: 'POST', body: JSON.stringify(data) }),
  get: (appId: string) => apiFetch<any>(`/oauth/applications/${appId}`),
  update: (appId: string, data: { name?: string; description?: string; redirectUris?: string[]; scopes?: string[] }) =>
    apiFetch<any>(`/oauth/applications/${appId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (appId: string) => apiFetch<void>(`/oauth/applications/${appId}`, { method: 'DELETE' }),
};

export const referralsApi = {
  get: () => apiFetch<{ code: string; referralLink: string; count: number }>('/referrals/@me'),
};

export const banAppealsApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/bans/appeals`),
  submit: (guildId: string, userId: string, text: string) =>
    apiFetch<any>(`/guilds/${guildId}/bans/${userId}/appeal`, { method: 'POST', body: JSON.stringify({ text }) }),
  review: (guildId: string, userId: string, status: 'approved' | 'denied') =>
    apiFetch<any>(`/guilds/${guildId}/bans/${userId}/appeal`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const reactionRolesApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/reaction-roles`),
  create: (guildId: string, data: { messageId: string; channelId: string; mode: string; mappings: Array<{ emoji: string; roleId: string }> }) =>
    apiFetch<any>(`/guilds/${guildId}/reaction-roles`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (guildId: string, id: string) =>
    apiFetch<void>(`/guilds/${guildId}/reaction-roles/${id}`, { method: 'DELETE' }),
  apply: (guildId: string, id: string, data: { emoji: string; userId: string }) =>
    apiFetch<any>(`/guilds/${guildId}/reaction-roles/${id}/apply`, { method: 'POST', body: JSON.stringify(data) }),
};

export const stickyMessagesApi = {
  get: (channelId: string) => apiFetch<any>(`/channels/${channelId}/sticky`),
  set: (channelId: string, data: { content: string }) =>
    apiFetch<any>(`/channels/${channelId}/sticky`, { method: 'POST', body: JSON.stringify(data) }),
  remove: (channelId: string) =>
    apiFetch<void>(`/channels/${channelId}/sticky`, { method: 'DELETE' }),
};

export const remindersApi = {
  create: (data: { messageId: string; channelId: string; guildId?: string; remindAt: string; note?: string }) =>
    apiFetch<any>('/reminders', { method: 'POST', body: JSON.stringify(data) }),
  list: () => apiFetch<any[]>('/reminders'),
  delete: (id: string) => apiFetch<void>(`/reminders/${id}`, { method: 'DELETE' }),
};

export const starboardApi = {
  getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/starboard/config`),
  setConfig: (guildId: string, data: { targetChannelId: string; emoji?: string; threshold?: number; enabled?: boolean }) =>
    apiFetch<any>(`/guilds/${guildId}/starboard/config`, { method: 'PUT', body: JSON.stringify(data) }),
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/starboard`),
  check: (guildId: string, data: { messageId: string; reactionCount: number }) =>
    apiFetch<any>(`/guilds/${guildId}/starboard/check`, { method: 'POST', body: JSON.stringify(data) }),
};

export const autoRolesApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/auto-roles`),
  create: (guildId: string, data: { roleId: string; triggerType: string; triggerValue: number }) =>
    apiFetch<any>(`/guilds/${guildId}/auto-roles`, { method: 'POST', body: JSON.stringify(data) }),
  update: (guildId: string, id: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/auto-roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (guildId: string, id: string) =>
    apiFetch<void>(`/guilds/${guildId}/auto-roles/${id}`, { method: 'DELETE' }),
};

export const showcaseApi = {
  get: (userId: string) => apiFetch<any[]>(`/users/${userId}/showcase`),
  set: (items: Array<{ slot: number; itemType: string; referenceId: string }>) =>
    apiFetch<any>('/users/@me/showcase', { method: 'PUT', body: JSON.stringify({ items }) }),
  removeSlot: (slot: number) =>
    apiFetch<void>(`/users/@me/showcase/${slot}`, { method: 'DELETE' }),
};

export const friendshipStreaksApi = {
  getStreak: (friendId: string) => apiFetch<any>(`/relationships/${friendId}/streak`),
  listStreaks: () => apiFetch<any[]>('/relationships/streaks'),
  getMilestones: (friendId: string) => apiFetch<any[]>(`/relationships/${friendId}/milestones`),
  interact: (friendId: string) =>
    apiFetch<any>(`/relationships/${friendId}/interact`, { method: 'POST', body: '{}' }),
};

export const interestTagsApi = {
  listTags: () => apiFetch<any[]>('/interest-tags'),
  getMyInterests: () => apiFetch<any[]>('/users/@me/interests'),
  setInterests: (tags: string[]) =>
    apiFetch<any>('/users/@me/interests', { method: 'PUT', body: JSON.stringify({ tags }) }),
  getMatches: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/interest-matches`),
};

export const greetingCardsApi = {
  getTemplates: () => apiFetch<any[]>('/greeting-cards/templates'),
  send: (data: { templateId: string; recipientId: string; message: string; stickers?: Array<Record<string, unknown>> }) =>
    apiFetch<any>('/greeting-cards', { method: 'POST', body: JSON.stringify(data) }),
  getInbox: () => apiFetch<any[]>('/greeting-cards/inbox'),
  markViewed: (id: string) =>
    apiFetch<any>(`/greeting-cards/${id}/view`, { method: 'PATCH' }),
};

export const textReactionsApi = {
  add: (channelId: string, messageId: string, text: string) =>
    apiFetch<any>(`/channels/${channelId}/messages/${messageId}/text-reactions`, { method: 'POST', body: JSON.stringify({ text }) }),
  remove: (channelId: string, messageId: string, text: string) =>
    apiFetch<void>(`/channels/${channelId}/messages/${messageId}/text-reactions/${encodeURIComponent(text)}`, { method: 'DELETE' }),
  get: (channelId: string, messageId: string) =>
    apiFetch<any[]>(`/channels/${channelId}/messages/${messageId}/text-reactions`),
  popular: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/text-reactions/popular`),
};

export const timelineApi = {
  get: (guildId: string, params?: { before?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.before) qs.set('before', params.before);
    if (params?.limit) qs.set('limit', String(params.limit));
    return apiFetch<any[]>(`/guilds/${guildId}/timeline?${qs.toString()}`);
  },
  addEvent: (guildId: string, data: { title: string; description?: string; iconUrl?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/timeline`, { method: 'POST', body: JSON.stringify(data) }),
  deleteEvent: (guildId: string, id: string) =>
    apiFetch<void>(`/guilds/${guildId}/timeline/${id}`, { method: 'DELETE' }),
};

export const ticketsApi = {
  list: (guildId: string, params?: { status?: string; assignee?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.assignee) qs.set('assignee', params.assignee);
    return apiFetch<any[]>(`/guilds/${guildId}/tickets?${qs.toString()}`);
  },
  create: (guildId: string, data: { subject: string; priority?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/tickets`, { method: 'POST', body: JSON.stringify(data) }),
  update: (guildId: string, id: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  close: (guildId: string, id: string) =>
    apiFetch<any>(`/guilds/${guildId}/tickets/${id}/close`, { method: 'POST', body: '{}' }),
  getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/tickets/config`),
  setConfig: (guildId: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/tickets/config`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const giveawaysApi = {
  list: (guildId: string, status?: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/giveaways${status ? `?status=${status}` : ''}`),
  create: (guildId: string, data: { channelId: string; prize: string; description?: string; winnersCount: number; endsAt: string; requiredRoleId?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/giveaways`, { method: 'POST', body: JSON.stringify(data) }),
  enter: (guildId: string, id: string) =>
    apiFetch<any>(`/guilds/${guildId}/giveaways/${id}/enter`, { method: 'POST', body: '{}' }),
  leave: (guildId: string, id: string) =>
    apiFetch<void>(`/guilds/${guildId}/giveaways/${id}/enter`, { method: 'DELETE' }),
  end: (guildId: string, id: string) =>
    apiFetch<any>(`/guilds/${guildId}/giveaways/${id}/end`, { method: 'POST', body: '{}' }),
  reroll: (guildId: string, id: string) =>
    apiFetch<any>(`/guilds/${guildId}/giveaways/${id}/reroll`, { method: 'POST', body: '{}' }),
  cancel: (guildId: string, id: string) =>
    apiFetch<void>(`/guilds/${guildId}/giveaways/${id}`, { method: 'DELETE' }),
};

export const onboardingApi = {
  getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/onboarding/config`),
  setConfig: (guildId: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/onboarding/config`, { method: 'PUT', body: JSON.stringify(data) }),
  complete: (guildId: string, selections: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/onboarding/complete`, { method: 'POST', body: JSON.stringify({ selections }) }),
  getStatus: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/onboarding/status`),
};

export const guildLogApi = {
  getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/log-config`),
  setConfig: (guildId: string, data: { channelId: string; events: string[] }) =>
    apiFetch<any>(`/guilds/${guildId}/log-config`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const guildDigestApi = {
  getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/digest/config`),
  setConfig: (guildId: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/digest/config`, { method: 'PUT', body: JSON.stringify(data) }),
  preview: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/digest/preview`),
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/digest/history`),
};

export const musicRoomsApi = {
  get: (channelId: string) => apiFetch<any>(`/channels/${channelId}/music`),
  updateSettings: (channelId: string, data: { mode?: string; volume?: number }) =>
    apiFetch<any>(`/channels/${channelId}/music/settings`, { method: 'PUT', body: JSON.stringify(data) }),
  addTrack: (channelId: string, data: { url: string; title: string; thumbnail?: string; duration?: number }) =>
    apiFetch<any>(`/channels/${channelId}/music/queue`, { method: 'POST', body: JSON.stringify(data) }),
  removeTrack: (channelId: string, id: string) =>
    apiFetch<void>(`/channels/${channelId}/music/queue/${id}`, { method: 'DELETE' }),
  skip: (channelId: string) =>
    apiFetch<any>(`/channels/${channelId}/music/skip`, { method: 'POST', body: '{}' }),
  next: (channelId: string) =>
    apiFetch<any>(`/channels/${channelId}/music/next`, { method: 'POST', body: '{}' }),
};

export const whiteboardsApi = {
  list: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/whiteboards`),
  create: (channelId: string, data?: { name?: string }) =>
    apiFetch<any>(`/channels/${channelId}/whiteboards`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  get: (channelId: string, id: string) => apiFetch<any>(`/channels/${channelId}/whiteboards/${id}`),
  save: (channelId: string, id: string, data: { data: Record<string, unknown>; name?: string }) =>
    apiFetch<any>(`/channels/${channelId}/whiteboards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (channelId: string, id: string) =>
    apiFetch<void>(`/channels/${channelId}/whiteboards/${id}`, { method: 'DELETE' }),
};

export const moodBoardApi = {
  get: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/mood-board`),
  addItem: (channelId: string, data: { itemType: string; content: string; position?: Record<string, unknown> }) =>
    apiFetch<any>(`/channels/${channelId}/mood-board`, { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (channelId: string, id: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/channels/${channelId}/mood-board/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  removeItem: (channelId: string, id: string) =>
    apiFetch<void>(`/channels/${channelId}/mood-board/${id}`, { method: 'DELETE' }),
};

export const photoAlbumsApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/albums`),
  create: (guildId: string, data: { name: string; description?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/albums`, { method: 'POST', body: JSON.stringify(data) }),
  get: (guildId: string, id: string) => apiFetch<any>(`/guilds/${guildId}/albums/${id}`),
  update: (guildId: string, id: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/albums/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (guildId: string, id: string) =>
    apiFetch<void>(`/guilds/${guildId}/albums/${id}`, { method: 'DELETE' }),
  addPhoto: (guildId: string, albumId: string, data: { fileUrl: string; caption?: string; messageId?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/albums/${albumId}/photos`, { method: 'POST', body: JSON.stringify(data) }),
  removePhoto: (guildId: string, albumId: string, photoId: string) =>
    apiFetch<void>(`/guilds/${guildId}/albums/${albumId}/photos/${photoId}`, { method: 'DELETE' }),
};

export const voiceEffectsApi = {
  listEffects: () => apiFetch<any[]>('/voice/effects'),
  getSettings: () => apiFetch<any>('/users/@me/voice-settings'),
  setSettings: (data: { activeEffect: string | null; effectVolume?: number }) =>
    apiFetch<any>('/users/@me/voice-settings', { method: 'PUT', body: JSON.stringify(data) }),
};

export const studyRoomsApi = {
  getSettings: (channelId: string) => apiFetch<any>(`/channels/${channelId}/study`),
  updateSettings: (channelId: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/channels/${channelId}/study/settings`, { method: 'PUT', body: JSON.stringify(data) }),
  startSession: (channelId: string, data: { sessionType: string }) =>
    apiFetch<any>(`/channels/${channelId}/study/start`, { method: 'POST', body: JSON.stringify(data) }),
  endSession: (channelId: string) =>
    apiFetch<any>(`/channels/${channelId}/study/end`, { method: 'POST', body: '{}' }),
  getStats: (guildId: string, period?: string) =>
    apiFetch<any>(`/guilds/${guildId}/study/stats${period ? `?period=${period}` : ''}`),
  getLeaderboard: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/study/leaderboard`),
};

export const questsApi = {
  list: (guildId: string, status?: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/quests${status ? `?status=${status}` : ''}`),
  create: (guildId: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/quests`, { method: 'POST', body: JSON.stringify(data) }),
  update: (guildId: string, id: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/quests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (guildId: string, id: string) =>
    apiFetch<void>(`/guilds/${guildId}/quests/${id}`, { method: 'DELETE' }),
  contribute: (guildId: string, id: string, value?: number) =>
    apiFetch<any>(`/guilds/${guildId}/quests/${id}/contribute`, { method: 'POST', body: JSON.stringify({ value }) }),
  contributions: (guildId: string, id: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/quests/${id}/contributions`),
};

export const formsApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/forms`),
  create: (guildId: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/forms`, { method: 'POST', body: JSON.stringify(data) }),
  get: (guildId: string, id: string) => apiFetch<any>(`/guilds/${guildId}/forms/${id}`),
  update: (guildId: string, id: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/forms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (guildId: string, id: string) =>
    apiFetch<void>(`/guilds/${guildId}/forms/${id}`, { method: 'DELETE' }),
  submitResponse: (guildId: string, formId: string, answers: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/forms/${formId}/responses`, { method: 'POST', body: JSON.stringify({ answers }) }),
  listResponses: (guildId: string, formId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/forms/${formId}/responses`),
  reviewResponse: (guildId: string, formId: string, responseId: string, data: { status: string }) =>
    apiFetch<any>(`/guilds/${guildId}/forms/${formId}/responses/${responseId}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const confessionsApi = {
  designateChannel: (guildId: string, channelId: string) =>
    apiFetch<any>(`/guilds/${guildId}/confession-channels`, { method: 'POST', body: JSON.stringify({ channelId }) }),
  undesignateChannel: (guildId: string, channelId: string) =>
    apiFetch<void>(`/guilds/${guildId}/confession-channels/${channelId}`, { method: 'DELETE' }),
  list: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/confessions`),
  post: (channelId: string, content: string) =>
    apiFetch<any>(`/channels/${channelId}/confessions`, { method: 'POST', body: JSON.stringify({ content }) }),
  reveal: (guildId: string, id: string) =>
    apiFetch<any>(`/guilds/${guildId}/confessions/${id}/reveal`, { method: 'POST', body: '{}' }),
};

export const encryptionApi = {
  getPublicKey: (userId: string) =>
    apiFetch<{ publicKeyJwk: string | null }>(`/users/${userId}/public-key`),
  uploadPublicKey: (publicKeyJwk: string) =>
    apiFetch<void>('/users/@me/public-key', { method: 'POST', body: JSON.stringify({ publicKeyJwk }) }),
  getGroupKey: (channelId: string) =>
    apiFetch<{ version: number | null; encryptedKey: string | null }>(`/channels/${channelId}/group-key`),
  postGroupKey: (channelId: string, data: { version: number; keyData: Record<string, string> }) =>
    apiFetch<void>(`/channels/${channelId}/group-key`, { method: 'POST', body: JSON.stringify(data) }),
  toggleE2E: (channelId: string, enabled: boolean) =>
    apiFetch<{ ok: boolean; enabled: boolean }>(`/channels/${channelId}/e2e-toggle`, { method: 'POST', body: JSON.stringify({ enabled }) }),
};

export const profileVisitorsApi = {
  record: (userId: string) =>
    apiFetch<{ recorded: boolean }>(`/users/${userId}/profile-view`, { method: 'POST', body: '{}' }),
  getVisitors: () => apiFetch<{ totalThisWeek: number; visitors: Array<Record<string, unknown>> }>('/users/me/profile-visitors'),
};

export const friendActivityApi = {
  get: () => apiFetch<any[]>('/users/me/friend-activity'),
};

export const activityFeedApi = {
  list: (params?: { before?: string; type?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.before) q.set('before', params.before);
    if (params?.type) q.set('type', params.type);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiFetch<any[]>(`/users/@me/feed${qs ? `?${qs}` : ''}`);
  },
};

export const dailySpinApi = {
  spin: () => apiFetch<{ reward: { type: string; amount: number; label: string } }>('/economy/daily-spin', { method: 'POST', body: '{}' }),
};

export const bundlePurchaseApi = {
  buy: (itemIds: string[]) =>
    apiFetch<{ success: boolean; totalPrice: number; discountedPrice: number; savings: number; discount: number; wallet: { balance: number } }>('/shop/bundle-purchase', { method: 'POST', body: JSON.stringify({ itemIds }) }),
};

export const tradesApi = {
  propose: (data: { recipientId: string; proposerItems: Array<Record<string, unknown>>; recipientItems: Array<Record<string, unknown>>; proposerGratonites: number; recipientGratonites: number }) =>
    apiFetch<any>('/trades/propose', { method: 'POST', body: JSON.stringify(data) }),
  pending: () => apiFetch<any[]>('/trades/pending'),
  accept: (tradeId: string) => apiFetch<any>(`/trades/${tradeId}/accept`, { method: 'POST', body: '{}' }),
  reject: (tradeId: string) => apiFetch<any>(`/trades/${tradeId}/reject`, { method: 'POST', body: '{}' }),
};

export const channelDocumentsApi = {
  list: (channelId: string) =>
    apiFetch<Array<{
      id: string; channelId: string; title: string; content: string; lastEditorId: string | null;
      createdAt: string; updatedAt: string; editorUsername: string | null; editorDisplayName: string | null;
    }>>(`/channels/${channelId}/documents`),
  create: (channelId: string, data: { title: string; content?: string }) =>
    apiFetch<any>(`/channels/${channelId}/documents`, { method: 'POST', body: JSON.stringify(data) }),
  update: (channelId: string, docId: string, data: { title?: string; content?: string }) =>
    apiFetch<any>(`/channels/${channelId}/documents/${docId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (channelId: string, docId: string) =>
    apiFetch<{ ok: boolean }>(`/channels/${channelId}/documents/${docId}`, { method: 'DELETE' }),
};

export const dailyChallengesApi = {
  get: () => apiFetch<{
    date: string;
    challenges: Array<{ id: string; type: string; description: string; target: number; progress: number; completed: boolean; claimed: boolean; reward: number }>;
    streak: { current: number; longest: number; allCompleted: boolean; allClaimed: boolean; streakBonus: number };
  }>('/daily-challenges'),
  claim: (challengeId: string) =>
    apiFetch<{ ok: boolean; reward: number }>(`/daily-challenges/${challengeId}/claim`, { method: 'POST', body: '{}' }),
  claimStreak: () =>
    apiFetch<{ ok: boolean; streakBonus: number; currentStreak: number; longestStreak: number }>('/daily-challenges/claim-streak', { method: 'POST', body: '{}' }),
};

export const welcomeScreenApi = {
  get: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/welcome-screen`),
  update: (guildId: string, data: { enabled?: boolean; description?: string; blocks?: Array<Record<string, unknown>> }) =>
    apiFetch<any>(`/guilds/${guildId}/welcome-screen`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (guildId: string) => apiFetch<void>(`/guilds/${guildId}/welcome-screen`, { method: 'DELETE' }),
};

export const giftsApi = {
  create: (data: { recipientId: string; giftType: string; guildId?: string; quantity?: number; message?: string }) =>
    apiFetch<any>('/gifts', { method: 'POST', body: JSON.stringify(data) }),
  send: (itemId: string, recipientId: string) =>
    apiFetch<{ success: boolean; giftedItem: string; price: number }>('/shop/gift', { method: 'POST', body: JSON.stringify({ itemId, recipientId }) }),
  redeem: (code: string) =>
    apiFetch<any>('/gifts/redeem', { method: 'POST', body: JSON.stringify({ code }) }),
  getSent: () => apiFetch<any[]>('/gifts/sent'),
  getReceived: () => apiFetch<any[]>('/gifts/received'),
};

export const collectibleCardsApi = {
  getCollection: () => apiFetch<any[]>('/cards/collection'),
  getPacks: () => apiFetch<any[]>('/cards/packs'),
  openPack: (packId: string) =>
    apiFetch<{ cards: Array<Record<string, unknown>>; coinsSpent: number }>('/cards/open-pack', { method: 'POST', body: JSON.stringify({ packId }) }),
  getTrades: () => apiFetch<any[]>('/cards/trades'),
  proposeTrade: (data: { toUserId: string; offerCardIds: string[]; requestCardIds?: string[] }) =>
    apiFetch<{ tradeId: string; status: string }>('/cards/trade', { method: 'POST', body: JSON.stringify(data) }),
  acceptTrade: (tradeId: string) =>
    apiFetch<{ status: string }>(`/cards/trade/${tradeId}/accept`, { method: 'POST', body: '{}' }),
  declineTrade: (tradeId: string) =>
    apiFetch<{ status: string }>(`/cards/trade/${tradeId}/decline`, { method: 'POST', body: '{}' }),
};

export const storiesApi = {
  create: (data: { content: string; type?: 'text' | 'image'; imageUrl?: string; backgroundColor?: string }) =>
    apiFetch<any>('/stories', { method: 'POST', body: JSON.stringify(data) }),
  feed: () => apiFetch<any[]>('/stories/feed'),
  get: (storyId: string) => apiFetch<any>(`/stories/${storyId}`),
  delete: (storyId: string) => apiFetch<void>(`/stories/${storyId}`, { method: 'DELETE' }),
  view: (storyId: string) => apiFetch<any>(`/stories/${storyId}/view`, { method: 'POST', body: '{}' }),
};

export const emojisApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/emojis`),
};

export const capabilitiesApi = () =>
  apiFetch<{ routes: Record<string, boolean>; source: 'server' }>('/capabilities');

// Phase 4 & 5 API modules (items 81-110)

export const spamConfigApi = {
  get: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/spam-config`),
  update: (guildId: string, data: any) => apiFetch<any>(`/guilds/${guildId}/spam-config`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const soundboardApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/soundboard`),
  upload: (guildId: string, data: { name: string; fileHash: string; emoji?: string; volume?: number }) =>
    apiFetch<any>(`/guilds/${guildId}/soundboard`, { method: 'POST', body: JSON.stringify(data) }),
  play: (guildId: string, clipId: string) =>
    apiFetch<any>(`/guilds/${guildId}/soundboard/${clipId}/play`, { method: 'POST', body: '{}' }),
  delete: (guildId: string, clipId: string) =>
    apiFetch<any>(`/guilds/${guildId}/soundboard/${clipId}`, { method: 'DELETE' }),
};

export const guildBackupApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/backups`),
  create: (guildId: string, name?: string) =>
    apiFetch<any>(`/guilds/${guildId}/backups`, { method: 'POST', body: JSON.stringify({ name }) }),
  get: (guildId: string, backupId: string) => apiFetch<any>(`/guilds/${guildId}/backups/${backupId}`),
  delete: (guildId: string, backupId: string) =>
    apiFetch<any>(`/guilds/${guildId}/backups/${backupId}`, { method: 'DELETE' }),
};

export const modQueueApi = {
  list: (guildId: string, status?: string) =>
    apiFetch<any>(`/guilds/${guildId}/mod-queue${status ? `?status=${status}` : ''}`),
  create: (guildId: string, data: { type: string; targetId?: string; content?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/mod-queue`, { method: 'POST', body: JSON.stringify(data) }),
  resolve: (guildId: string, itemId: string, status: 'approved' | 'rejected') =>
    apiFetch<any>(`/guilds/${guildId}/mod-queue/${itemId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const guildHighlightsApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/highlights`),
  generate: (guildId: string) =>
    apiFetch<any>(`/guilds/${guildId}/highlights/generate`, { method: 'POST', body: '{}' }),
};

export const vanityProfileApi = {
  lookup: (vanityUrl: string) => apiFetch<any>(`/users/vanity/${vanityUrl}`),
  set: (vanityUrl: string) =>
    apiFetch<any>(`/users/@me/vanity`, { method: 'PUT', body: JSON.stringify({ vanityUrl }) }),
  remove: () => apiFetch<any>(`/users/@me/vanity`, { method: 'DELETE' }),
};

export const auditLogEntriesApi = {
  list: (guildId: string, params?: { action?: string; userId?: string; before?: string; after?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.action) q.set('action', params.action);
    if (params?.userId) q.set('userId', params.userId);
    if (params?.before) q.set('before', params.before);
    if (params?.after) q.set('after', params.after);
    if (params?.limit) q.set('limit', String(params.limit));
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return apiFetch<any>(`/guilds/${guildId}/log-config/entries${suffix}`);
  },
};

export const wordFilterTestApi = {
  test: (guildId: string, pattern: string, testText: string) =>
    apiFetch<any>(`/guilds/${guildId}/word-filter/test`, { method: 'POST', body: JSON.stringify({ pattern, testText }) }),
};

// ── Phase 6: Productivity & Collaboration ────────────────────────────────────

export const calendarsApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/calendar`),
  create: (guildId: string, data: { title: string; startAt: string; endAt?: string; allDay?: boolean; color?: string; recurring?: string; description?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/calendar`, { method: 'POST', body: JSON.stringify(data) }),
  update: (guildId: string, eventId: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/calendar/${eventId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (guildId: string, eventId: string) =>
    apiFetch<void>(`/guilds/${guildId}/calendar/${eventId}`, { method: 'DELETE' }),
  rsvp: (guildId: string, eventId: string, status: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/calendar/${eventId}/rsvp`, { method: 'POST', body: JSON.stringify({ status }) }),
  getRsvps: (guildId: string, eventId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/calendar/${eventId}/rsvps`),
};

export const calendarSyncApi = {
  list: () => apiFetch<any[]>('/users/@me/calendar-integrations'),
  connectGoogle: (guildId?: string) =>
    apiFetch<{ authUrl: string }>('/users/@me/calendar-integrations/google/connect', {
      method: 'POST',
      body: JSON.stringify({ guildId }),
    }),
  disconnect: (id: string) =>
    apiFetch<void>(`/users/@me/calendar-integrations/${id}`, { method: 'DELETE' }),
  sync: (id: string) =>
    apiFetch<{ synced: boolean; eventCount: number; events: any[] }>(
      `/users/@me/calendar-integrations/${id}/sync`,
      { method: 'POST' },
    ),
  toggleSync: (id: string, syncEnabled: boolean) =>
    apiFetch<any>(`/users/@me/calendar-integrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ syncEnabled }),
    }),
};

export const messageTranslateApi = {
  translate: (messageId: string, targetLang: string) =>
    apiFetch<{ translatedContent: string; sourceLang: string | null; targetLang: string; cached: boolean }>(
      `/messages/${messageId}/translate`,
      { method: 'POST', body: JSON.stringify({ targetLang }) },
    ),
};

export const codePlaygroundApi = {
  // Code playground is purely frontend (sandboxed iframe), no API needed
};

export const fileManagerApi = {
  list: (guildId: string, search?: string, page?: number) => {
    const q = new URLSearchParams();
    if (search) q.set('search', search);
    if (page) q.set('page', String(page));
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return apiFetch<any[]>(`/guilds/${guildId}/file-manager${suffix}`);
  },
};

export const meetingSchedulerApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/meetings`),
  create: (guildId: string, data: { title: string; timeSlots: Array<{ date: string; startTime: string; endTime: string }>; description?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/meetings`, { method: 'POST', body: JSON.stringify(data) }),
  get: (guildId: string, pollId: string) => apiFetch<any>(`/guilds/${guildId}/meetings/${pollId}`),
  vote: (guildId: string, pollId: string, selectedSlots: number[], timezone?: string) =>
    apiFetch<any>(`/guilds/${guildId}/meetings/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ selectedSlots, timezone }) }),
  delete: (guildId: string, pollId: string) =>
    apiFetch<void>(`/guilds/${guildId}/meetings/${pollId}`, { method: 'DELETE' }),
};

export const todoListsApi = {
  list: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/todos`),
  create: (channelId: string, title: string) =>
    apiFetch<any>(`/channels/${channelId}/todos`, { method: 'POST', body: JSON.stringify({ title }) }),
  getItems: (channelId: string, listId: string) =>
    apiFetch<any[]>(`/channels/${channelId}/todos/${listId}/items`),
  addItem: (channelId: string, listId: string, data: { text: string; assigneeId?: string }) =>
    apiFetch<any>(`/channels/${channelId}/todos/${listId}/items`, { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (channelId: string, listId: string, itemId: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/channels/${channelId}/todos/${listId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteItem: (channelId: string, listId: string, itemId: string) =>
    apiFetch<void>(`/channels/${channelId}/todos/${listId}/items/${itemId}`, { method: 'DELETE' }),
  deleteList: (channelId: string, listId: string) =>
    apiFetch<void>(`/channels/${channelId}/todos/${listId}`, { method: 'DELETE' }),
};

export const integrationsApi = {
  catalog: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/integrations/catalog`),
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/integrations`),
  install: (guildId: string, data: { type: string; channelId: string; name?: string; config?: Record<string, unknown> }) =>
    apiFetch<any>(`/guilds/${guildId}/integrations`, { method: 'POST', body: JSON.stringify(data) }),
  update: (guildId: string, id: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/integrations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (guildId: string, id: string) =>
    apiFetch<void>(`/guilds/${guildId}/integrations/${id}`, { method: 'DELETE' }),
  logs: (guildId: string, id: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/integrations/${id}/logs`),
};

export const botFrameworkApi = {
  docs: () => apiFetch<any>('/bots/framework/docs'),
  templates: () => apiFetch<any[]>('/bots/framework/templates'),
};

export const standupApi = {
  getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/standup/config`),
  setConfig: (guildId: string, data: Record<string, unknown>) =>
    apiFetch<any>(`/guilds/${guildId}/standup/config`, { method: 'POST', body: JSON.stringify(data) }),
  respond: (guildId: string, answers: string[]) =>
    apiFetch<any>(`/guilds/${guildId}/standup/respond`, { method: 'POST', body: JSON.stringify({ answers }) }),
  getSummary: (guildId: string, date?: string) => {
    const suffix = date ? `?date=${date}` : '';
    return apiFetch<any>(`/guilds/${guildId}/standup/summary${suffix}`);
  },
};

export const timezoneApi = {
  get: () => apiFetch<{ timezone: string | null }>('/users/@me/timezone'),
  set: (timezone: string) =>
    apiFetch<{ timezone: string }>('/users/@me/timezone', { method: 'PATCH', body: JSON.stringify({ timezone }) }),
  getUser: (userId: string) =>
    apiFetch<{ timezone: string | null; localTime: string | null }>(`/users/${userId}/timezone`),
};

export const afkApi = {
  get: () => apiFetch<{ message: string; since: string } | null>('/users/@me/afk'),
  set: (message: string) =>
    apiFetch<any>('/users/@me/afk', { method: 'POST', body: JSON.stringify({ message }) }),
  clear: () => apiFetch<any>('/users/@me/afk', { method: 'DELETE' }),
  getUser: (userId: string) =>
    apiFetch<{ message: string; since: string } | null>(`/users/${userId}/afk`),
};

export const playlistsApi = {
  list: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/playlists`),
  create: (channelId: string, name: string) =>
    apiFetch<any>(`/channels/${channelId}/playlists`, { method: 'POST', body: JSON.stringify({ name }) }),
  getTracks: (channelId: string, playlistId: string) =>
    apiFetch<any>(`/channels/${channelId}/playlists/${playlistId}/tracks`),
  addTrack: (channelId: string, playlistId: string, data: { url: string; title: string; artist?: string; duration?: number }) =>
    apiFetch<any>(`/channels/${channelId}/playlists/${playlistId}/tracks`, { method: 'POST', body: JSON.stringify(data) }),
  removeTrack: (channelId: string, playlistId: string, trackId: string) =>
    apiFetch<void>(`/channels/${channelId}/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' }),
  vote: (channelId: string, playlistId: string, trackId: string, vote: 'skip' | 'keep') =>
    apiFetch<any>(`/channels/${channelId}/playlists/${playlistId}/tracks/${trackId}/vote`, { method: 'POST', body: JSON.stringify({ vote }) }),
  next: (channelId: string, playlistId: string) =>
    apiFetch<any>(`/channels/${channelId}/playlists/${playlistId}/next`, { method: 'POST', body: '{}' }),
};

// ── Phase 7: Gamification & Engagement ───────────────────────────────────────

export const xpApi = {
  getMyXp: () => apiFetch<{ xp: number; level: number; progress: number; xpForNextLevel: number }>('/users/@me/xp'),
  getGuildXp: (guildId: string) =>
    apiFetch<{ xp: number; level: number; progress: number }>(`/guilds/${guildId}/xp/@me`),
  getGuildLeaderboard: (guildId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/xp/leaderboard`),
};

export const loginRewardsApi = {
  get: () => apiFetch<any>('/login-reward'),
  claim: () => apiFetch<any>('/login-reward/claim', { method: 'POST', body: '{}' }),
};

export const userTitlesApi = {
  listAll: () => apiFetch<any[]>('/titles'),
  listOwned: () => apiFetch<any[]>('/users/@me/titles'),
  equip: (titleId: string) =>
    apiFetch<any>(`/users/@me/titles/${titleId}/equip`, { method: 'POST', body: '{}' }),
  unequip: () =>
    apiFetch<any>('/users/@me/titles/unequip', { method: 'POST', body: '{}' }),
  getUserTitle: (userId: string) =>
    apiFetch<{ name: string; color: string; rarity: string } | null>(`/users/${userId}/title`),
};

export const quizzesApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/quizzes`),
  create: (guildId: string, data: { title: string; description?: string; questions: Array<{ question: string; options: string[]; correctIndex: number }>; timeLimit?: number }) =>
    apiFetch<any>(`/guilds/${guildId}/quizzes`, { method: 'POST', body: JSON.stringify(data) }),
  get: (guildId: string, quizId: string) => apiFetch<any>(`/guilds/${guildId}/quizzes/${quizId}`),
  attempt: (guildId: string, quizId: string, answers: number[]) =>
    apiFetch<any>(`/guilds/${guildId}/quizzes/${quizId}/attempt`, { method: 'POST', body: JSON.stringify({ answers }) }),
  leaderboard: (guildId: string, quizId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/quizzes/${quizId}/leaderboard`),
  delete: (guildId: string, quizId: string) =>
    apiFetch<void>(`/guilds/${guildId}/quizzes/${quizId}`, { method: 'DELETE' }),
};

export const reputationApi = {
  upvote: (channelId: string, messageId: string, value?: number) =>
    apiFetch<{ messageId: string; upvotes: number; downvotes: number; score: number }>(
      `/channels/${channelId}/messages/${messageId}/upvote`,
      { method: 'POST', body: JSON.stringify({ value: value ?? 1 }) },
    ),
  getUserReputation: (userId: string) =>
    apiFetch<{ userId: string; upvotes: number; downvotes: number; reputation: number }>(`/users/${userId}/reputation`),
};

export const seasonalEventsApi = {
  getActive: () => apiFetch<any[]>('/events/active'),
  getProgress: (eventId: string) => apiFetch<any>(`/events/${eventId}/progress`),
  claim: (eventId: string, rewardIndex: number) =>
    apiFetch<any>(`/events/${eventId}/claim`, { method: 'POST', body: JSON.stringify({ rewardIndex }) }),
};

export const guildQuestsApi = {
  list: (guildId: string, status?: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/quests${status ? `?status=${status}` : ''}`),
  create: (guildId: string, data: { title: string; description?: string; questType?: string; targetValue: number; reward?: number; endDate: string }) =>
    apiFetch<any>(`/guilds/${guildId}/quests`, { method: 'POST', body: JSON.stringify(data) }),
  contribute: (guildId: string, questId: string, amount?: number) =>
    apiFetch<any>(`/guilds/${guildId}/quests/${questId}/contribute`, { method: 'POST', body: JSON.stringify({ amount: amount ?? 1 }) }),
  getContributions: (guildId: string, questId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/quests/${questId}/contributions`),
};

export const profileBackgroundApi = {
  get: () => apiFetch<{ background: string | null }>('/users/@me/settings').then(s => ({ background: (s as any)?.themePreferences?.profileBackground ?? null })),
  set: (background: string) =>
    apiFetch<any>('/users/@me/settings', { method: 'PATCH', body: JSON.stringify({ themePreferences: { profileBackground: background } }) }),
};

export const genericApi = {
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, data: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T = unknown>(path: string, data: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  put: <T = unknown>(path: string, data: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
};

// ---------------------------------------------------------------------------
// Federation + Relay API
// ---------------------------------------------------------------------------

export const federationApi = {
  /** Discover remote guilds from federated instances. */
  discoverGuilds: (params?: { q?: string; category?: string; sort?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.category) query.set('category', params.category);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.limit) query.set('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiFetch(`/federation/discover/remote-guilds${suffix}`);
  },

  /** Get join info for a remote guild. */
  joinRemoteGuild: (remoteGuildId: string) =>
    apiFetch(`/federation/discover/remote-guilds/${remoteGuildId}/join`, { method: 'POST' }),

  /** Resolve a federation address. */
  resolve: (address: string) => apiFetch(`/federation/resolve/${encodeURIComponent(address)}`),

  /** Preview another instance's /.well-known/gratonite (server-side fetch). */
  wellKnownPreview: (host: string) =>
    apiFetch<{ host: string; wellKnown: Record<string, unknown> }>(
      `/federation/well-known-preview?${new URLSearchParams({ host }).toString()}`,
    ),

  /** Export account data. */
  exportAccount: () => apiFetch('/federation/export'),

  /** Import account data. */
  importAccount: (data: unknown, signature: string) =>
    apiFetch('/federation/import', { method: 'POST', body: JSON.stringify({ data, signature }) }),

  /** Import a new account from another instance (public endpoint, returns temp credentials). */
  importNewAccount: (data: unknown, signature: string) =>
    apiFetch<{ accessToken: string; username: string; tempPassword: string; message: string }>(
      '/federation/import-new-account',
      { method: 'POST', body: JSON.stringify({ data, signature }) },
    ),

  /** Admin: list instances. */
  adminInstances: () => apiFetch('/federation/admin/instances'),

  /** Admin: federation stats. */
  adminStats: () => apiFetch('/federation/admin/stats'),

  /** Admin: activity queue. */
  adminQueue: () => apiFetch('/federation/admin/queue'),

  /** Admin: blocks. */
  adminBlocks: () => apiFetch('/federation/admin/blocks'),

  /** Admin: add block. */
  adminAddBlock: (domain: string, reason?: string) =>
    apiFetch('/federation/admin/blocks', { method: 'POST', body: JSON.stringify({ domain, reason }) }),

  /** Admin: remove block. */
  adminRemoveBlock: (blockId: string) =>
    apiFetch(`/federation/admin/blocks/${blockId}`, { method: 'DELETE' }),

  /** Admin: discover guilds (including unapproved). */
  adminDiscover: () => apiFetch('/federation/admin/discover'),
};

export const relayApi = {
  /** List available relays with reputation scores. */
  list: () => apiFetch('/relays'),

  /** Get detailed relay status. */
  status: (relayId: string) => apiFetch(`/relays/${relayId}/status`),

  /** Report a relay. */
  report: (relayId: string, reason: string) =>
    apiFetch(`/relays/${relayId}/report`, { method: 'POST', body: JSON.stringify({ reason }) }),

  /** Get reputation breakdown. */
  reputation: (relayId: string) => apiFetch(`/relays/reputation/${relayId}`),
};

// =========================================================================
// Wave 26: Cutting-edge features
// =========================================================================

export const spatialRoomsApi = {
  get: (channelId: string) => apiFetch<any>(`/channels/${channelId}/spatial-room`),
  update: (channelId: string, data: { name?: string; width?: number; height?: number; backgroundUrl?: string; gridEnabled?: boolean; maxParticipants?: number }) =>
    apiFetch<any>(`/channels/${channelId}/spatial-room`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const channelPresenceApi = {
  get: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/presence`),
};

export const ephemeralPodsApi = {
  list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/pods`),
  create: (guildId: string, name?: string) => apiFetch<any>(`/guilds/${guildId}/pods`, { method: 'POST', body: JSON.stringify({ name }) }),
  delete: (guildId: string, channelId: string) => apiFetch<void>(`/guilds/${guildId}/pods/${channelId}`, { method: 'DELETE' }),
};

export const voiceReactionsApi = {
  presets: () => apiFetch<any[]>('/voice-reactions/presets'),
};

export const focusSessionsApi = {
  list: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/focus-sessions`),
  get: (channelId: string, sessionId: string) => apiFetch<any>(`/channels/${channelId}/focus-sessions/${sessionId}`),
  create: (channelId: string, data: { name?: string; workDuration?: number; breakDuration?: number }) =>
    apiFetch<any>(`/channels/${channelId}/focus-sessions`, { method: 'POST', body: JSON.stringify(data) }),
  join: (channelId: string, sessionId: string) =>
    apiFetch<any>(`/channels/${channelId}/focus-sessions/${sessionId}/join`, { method: 'POST' }),
  leave: (channelId: string, sessionId: string) =>
    apiFetch<any>(`/channels/${channelId}/focus-sessions/${sessionId}/leave`, { method: 'POST' }),
  update: (channelId: string, sessionId: string, data: { currentPhase?: string; roundNumber?: number }) =>
    apiFetch<any>(`/channels/${channelId}/focus-sessions/${sessionId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  end: (channelId: string, sessionId: string) =>
    apiFetch<void>(`/channels/${channelId}/focus-sessions/${sessionId}`, { method: 'DELETE' }),
};

export const channelBookmarksApi = {
  list: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/bookmarks`),
  create: (channelId: string, data: { title: string; url?: string; fileId?: string; messageId?: string; type?: string }) =>
    apiFetch<any>(`/channels/${channelId}/bookmarks`, { method: 'POST', body: JSON.stringify(data) }),
  update: (channelId: string, bookmarkId: string, data: { title?: string; url?: string; position?: number }) =>
    apiFetch<any>(`/channels/${channelId}/bookmarks/${bookmarkId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (channelId: string, bookmarkId: string) =>
    apiFetch<void>(`/channels/${channelId}/bookmarks/${bookmarkId}`, { method: 'DELETE' }),
  reorder: (channelId: string, items: Array<{ id: string; position: number }>) =>
    apiFetch<any>(`/channels/${channelId}/bookmarks/reorder`, { method: 'PATCH', body: JSON.stringify({ items }) }),
};

export const messageComponentsApi = {
  interact: (channelId: string, messageId: string, componentId: string, data: { action: string; value?: string }) =>
    apiFetch<any>(`/channels/${channelId}/messages/${messageId}/components/${componentId}/interact`, { method: 'POST', body: JSON.stringify(data) }),
};

export const guildDigestGenerateApi = {
  generateNow: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/digest/generate-now`, { method: 'POST' }),
};

export const threadDashboardApi = {
  get: (guildId: string, params?: { sort?: string; channel?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.sort) query.set('sort', params.sort);
    if (params?.channel) query.set('channel', params.channel);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query}` : '';
    return apiFetch<any>(`/guilds/${guildId}/threads/dashboard${suffix}`);
  },
};

export const notificationSoundsApi = {
  list: () => apiFetch<any[]>('/notification-sounds'),
  upload: (data: { name: string; fileHash: string; duration: number; guildId?: string }) =>
    apiFetch<any>('/notification-sounds', { method: 'POST', body: JSON.stringify(data) }),
  delete: (soundId: string) => apiFetch<void>(`/notification-sounds/${soundId}`, { method: 'DELETE' }),
  getPrefs: () => apiFetch<any[]>('/notification-sounds/prefs'),
  setPrefs: (data: { guildId?: string; eventType: string; soundId: string | null }) =>
    apiFetch<any>('/notification-sounds/prefs', { method: 'PUT', body: JSON.stringify(data) }),
};

export const ambientRoomsApi = {
  get: (channelId: string) => apiFetch<any>(`/channels/${channelId}/ambient-room`),
  update: (channelId: string, data: { theme?: string; musicEnabled?: boolean; musicVolume?: number; maxParticipants?: number }) =>
    apiFetch<any>(`/channels/${channelId}/ambient-room`, { method: 'PATCH', body: JSON.stringify(data) }),
  join: (channelId: string) => apiFetch<any>(`/channels/${channelId}/ambient-room/join`, { method: 'POST' }),
  leave: (channelId: string) => apiFetch<any>(`/channels/${channelId}/ambient-room/leave`, { method: 'POST' }),
  updateStatus: (channelId: string, status: string) =>
    apiFetch<any>(`/channels/${channelId}/ambient-room/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const p2pTransferApi = {
  signal: (data: { targetUserId: string; signal: any; transferId: string; fileName?: string; fileSize?: number }) =>
    apiFetch<any>('/p2p/signal', { method: 'POST', body: JSON.stringify(data) }),
};

export const serverStatusApi = {
  get: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/status`),
  history: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/status/history`),
  heartbeat: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/status/heartbeat`, { method: 'POST' }),
};

export const scheduleCalendarApi = {
  getCalendar: (start?: string, end?: string) => {
    const query = new URLSearchParams();
    if (start) query.set('start', start);
    if (end) query.set('end', end);
    const suffix = query.toString() ? `?${query}` : '';
    return apiFetch<any[]>(`/users/@me/scheduled-messages/calendar${suffix}`);
  },
  reschedule: (messageId: string, scheduledAt: string) =>
    apiFetch<any>(`/users/@me/scheduled-messages/${messageId}/reschedule`, { method: 'PATCH', body: JSON.stringify({ scheduledAt }) }),
};

export const readingListsApi = {
  list: (channelId: string, params?: { sort?: string; tag?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.sort) query.set('sort', params.sort);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const suffix = query.toString() ? `?${query}` : '';
    return apiFetch<any>(`/channels/${channelId}/reading-list${suffix}`);
  },
  add: (channelId: string, data: { url: string; title: string; description?: string; tags?: string[] }) =>
    apiFetch<any>(`/channels/${channelId}/reading-list`, { method: 'POST', body: JSON.stringify(data) }),
  delete: (channelId: string, itemId: string) =>
    apiFetch<void>(`/channels/${channelId}/reading-list/${itemId}`, { method: 'DELETE' }),
  vote: (channelId: string, itemId: string) =>
    apiFetch<any>(`/channels/${channelId}/reading-list/${itemId}/vote`, { method: 'POST' }),
  markRead: (channelId: string, itemId: string) =>
    apiFetch<any>(`/channels/${channelId}/reading-list/${itemId}/read`, { method: 'POST' }),
  stats: (channelId: string) => apiFetch<any>(`/channels/${channelId}/reading-list/stats`),
};

export const channelFollowingApi = {
  follow: (channelId: string, data: { targetChannelId: string; targetGuildId: string }) =>
    apiFetch<any>(`/channels/${channelId}/followers`, { method: 'POST', body: JSON.stringify(data) }),
  listFollowers: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/followers`),
  unfollow: (channelId: string, followId: string) =>
    apiFetch<void>(`/channels/${channelId}/followers/${followId}`, { method: 'DELETE' }),
  listGuildFollowing: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/following`),
};
