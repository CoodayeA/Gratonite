/**
 * Tests for the API module — token management and fetch wrapper.
 */

// Mock expo-secure-store
const mockStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStore[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockStore[key];
    return Promise.resolve();
  }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { forum, setTokens, getAccessToken, loadTokens } from '../src/lib/api';

beforeEach(async () => {
  jest.clearAllMocks();
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  await setTokens(null, null);
  jest.clearAllMocks();
});

describe('Token Management', () => {
  it('stores and retrieves access token', async () => {
    await setTokens('test-access-token', 'test-refresh-token');
    expect(getAccessToken()).toBe('test-access-token');
  });

  it('returns null when no token is set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('loads tokens from secure store', async () => {
    mockStore['gratonite_access_token'] = 'stored-token';
    mockStore['gratonite_refresh_token'] = 'stored-refresh';
    await loadTokens();
    expect(getAccessToken()).toBe('stored-token');
  });

  it('clears tokens when set to null', async () => {
    await setTokens('token', 'refresh');
    expect(getAccessToken()).toBe('token');
    await setTokens(null, null);
    expect(getAccessToken()).toBeNull();
  });
});

describe('Forum API', () => {
  function mockJsonResponse(body: unknown) {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: jest.fn() },
      json: jest.fn().mockResolvedValue(body),
    });
  }

  it('lists forum posts through canonical thread responses', async () => {
    mockJsonResponse([
      {
        id: 'thread-1',
        channelId: 'forum-1',
        name: 'Show your builds',
        creatorId: 'user-1',
        creatorName: 'Ada',
        forumTagIds: ['showcase'],
        messageCount: 3,
        createdAt: '2026-04-17T12:00:00.000Z',
        lastActivity: '2026-04-17T12:30:00.000Z',
      },
    ]);

    const posts = await forum.listPosts('forum-1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.gratonite.chat/api/v1/channels/forum-1/threads',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(posts).toEqual([
      expect.objectContaining({
        id: 'thread-1',
        channelId: 'forum-1',
        title: 'Show your builds',
        authorId: 'user-1',
        authorName: 'Ada',
        tags: ['showcase'],
        replyCount: 2,
        lastReplyAt: '2026-04-17T12:30:00.000Z',
      }),
    ]);
  });

  it('creates forum posts through canonical thread creation with an optional body', async () => {
    mockJsonResponse({
      id: 'thread-2',
      channelId: 'forum-1',
      name: 'Image drop',
      creatorId: 'user-2',
      creatorName: 'Grace',
      forumTagIds: ['art'],
      messageCount: 1,
      createdAt: '2026-04-17T13:00:00.000Z',
      lastActivity: '2026-04-17T13:00:00.000Z',
    });

    const post = await forum.createPost('forum-1', {
      title: 'Image drop',
      content: '',
      tags: ['art'],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.gratonite.chat/api/v1/channels/forum-1/threads',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Image drop', body: null, tags: ['art'] }),
      }),
    );
    expect(post).toEqual(expect.objectContaining({
      id: 'thread-2',
      title: 'Image drop',
      content: '',
      tags: ['art'],
    }));
  });

  it('loads forum replies from thread messages', async () => {
    mockJsonResponse([
      { id: 'reply-1', channelId: 'forum-1', content: 'Reply', createdAt: '2026-04-17T12:05:00.000Z' },
      { id: 'op-1', channelId: 'forum-1', content: 'Original post', createdAt: '2026-04-17T12:00:00.000Z' },
    ]);

    const replies = await forum.getReplies('thread-1');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.gratonite.chat/api/v1/threads/thread-1/messages',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(replies).toEqual([{ id: 'reply-1', channelId: 'forum-1', content: 'Reply', createdAt: '2026-04-17T12:05:00.000Z' }]);
  });
});
