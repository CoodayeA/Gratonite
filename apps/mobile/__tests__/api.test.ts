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

import { forum, messages, setTokens, getAccessToken, loadTokens } from '../src/lib/api';

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
        opAttachment: {
          id: 'file-1',
          url: 'https://cdn.test/file-1.png',
          filename: 'preview.png',
          size: 1234,
          mimeType: 'image/png',
        },
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
        opAttachment: expect.objectContaining({
          id: 'file-1',
          url: 'https://cdn.test/file-1.png',
          filename: 'preview.png',
          contentType: 'image/png',
        }),
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

  it('passes attachment-heavy post edits through the canonical thread update endpoint', async () => {
    mockJsonResponse({
      id: 'thread-2',
      channelId: 'forum-1',
      name: 'Edited title',
      creatorId: 'user-2',
      creatorName: 'Grace',
      forumTagIds: ['art'],
      messageCount: 2,
      createdAt: '2026-04-17T13:00:00.000Z',
      lastActivity: '2026-04-17T13:30:00.000Z',
    });

    const post = await forum.updatePost('thread-2', {
      title: 'Edited title',
      content: 'Fresh copy',
      tags: ['art'],
      attachmentIds: ['file-1', 'file-2'],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.gratonite.chat/api/v1/threads/thread-2',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Edited title',
          body: 'Fresh copy',
          tags: ['art'],
          attachmentIds: ['file-1', 'file-2'],
        }),
      }),
    );
    expect(post).toEqual(expect.objectContaining({
      id: 'thread-2',
      title: 'Edited title',
      content: 'Fresh copy',
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
      'https://api.gratonite.chat/api/v1/threads/thread-1/messages?limit=100',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(replies).toEqual([{ id: 'reply-1', channelId: 'forum-1', content: 'Reply', createdAt: '2026-04-17T12:05:00.000Z' }]);
  });

  it('keeps paging backward until it finds the original post for forum details', async () => {
    mockJsonResponse({
      id: 'thread-99',
      channelId: 'forum-1',
      name: 'Long-running thread',
      creatorId: 'user-1',
      creatorName: 'Ada',
      messageCount: 101,
      createdAt: '2026-04-17T12:00:00.000Z',
      lastActivity: '2026-04-17T12:30:00.000Z',
    });
    mockJsonResponse(Array.from({ length: 100 }, (_, index) => ({
      id: `msg-${101 - index}`,
      channelId: 'forum-1',
      content: `Message ${101 - index}`,
      createdAt: `2026-04-17T12:${String(index).padStart(2, '0')}:00.000Z`,
    })));
    mockJsonResponse([
      {
        id: 'msg-1',
        channelId: 'forum-1',
        content: 'Original post',
        createdAt: '2026-04-17T11:59:00.000Z',
        attachments: [
          {
            id: 'file-99',
            url: 'https://cdn.test/file-99.png',
            filename: 'op.png',
            size: 2048,
            mimeType: 'image/png',
          },
        ],
      },
    ]);

    const post = await forum.getPost('thread-99');

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.gratonite.chat/api/v1/threads/thread-99/messages?limit=100',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://api.gratonite.chat/api/v1/threads/thread-99/messages?before=msg-2&limit=100',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(post).toEqual(expect.objectContaining({
      id: 'thread-99',
      title: 'Long-running thread',
      content: 'Original post',
      replyCount: 100,
      attachments: [expect.objectContaining({ id: 'file-99', contentType: 'image/png' })],
      opAttachment: expect.objectContaining({ id: 'file-99', contentType: 'image/png' }),
    }));
  });

  it('returns all replies for long forum threads instead of dropping the oldest page', async () => {
    mockJsonResponse(Array.from({ length: 100 }, (_, index) => ({
      id: `msg-${101 - index}`,
      channelId: 'forum-1',
      content: `Message ${101 - index}`,
      createdAt: `2026-04-17T12:${String(index).padStart(2, '0')}:00.000Z`,
    })));
    mockJsonResponse([
      { id: 'msg-1', channelId: 'forum-1', content: 'Original post', createdAt: '2026-04-17T11:59:00.000Z' },
    ]);

    const replies = await forum.getReplies('thread-99');

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://api.gratonite.chat/api/v1/threads/thread-99/messages?limit=100',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://api.gratonite.chat/api/v1/threads/thread-99/messages?before=msg-2&limit=100',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(replies).toHaveLength(100);
    expect(replies[0]).toEqual(expect.objectContaining({ id: 'msg-2', content: 'Message 2' }));
    expect(replies[99]).toEqual(expect.objectContaining({ id: 'msg-101', content: 'Message 101' }));
  });

  it('edits forum replies with attachment snapshots through the shared message endpoint', async () => {
    mockJsonResponse({
      id: 'reply-1',
      channelId: 'forum-1',
      content: 'Updated reply',
      attachments: [
        {
          id: 'file-9',
          url: 'https://cdn.test/file-9.png',
          filename: 'updated.png',
          size: 4096,
          mimeType: 'image/png',
        },
      ],
      createdAt: '2026-04-17T12:05:00.000Z',
    });

    const reply = await messages.edit('forum-1', 'reply-1', {
      content: 'Updated reply',
      attachmentIds: ['file-9'],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.gratonite.chat/api/v1/channels/forum-1/messages/reply-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ content: 'Updated reply', attachmentIds: ['file-9'] }),
      }),
    );
    expect(reply).toEqual(expect.objectContaining({
      id: 'reply-1',
      content: 'Updated reply',
      attachments: [expect.objectContaining({ id: 'file-9' })],
    }));
  });
});
