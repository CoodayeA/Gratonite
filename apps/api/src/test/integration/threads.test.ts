import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { testDb, cleanupDatabase } from '../setup';
import { createTestUser, createTestGuild, createTestChannel } from '../helpers';
import { channels } from '../../db/schema/channels';
import { files } from '../../db/schema/files';
import { messages } from '../../db/schema/messages';
import { threads } from '../../db/schema/threads';
import { createForumThread, listForumThreads } from '../../services/thread.service';

vi.mock('../../lib/redis', () => ({
  redis: {
    ttl: vi.fn().mockResolvedValue(-1),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('../../lib/socket-io', () => ({
  getIO: () => ({
    to: () => ({ emit: vi.fn() }),
  }),
}));

async function createUploadedFile(uploaderId: string, overrides: Partial<{
  filename: string;
  mimeType: string;
  size: number;
}> = {}) {
  const filename = overrides.filename ?? 'forum-image.png';
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '.bin';
  const id = crypto.randomUUID();
  const [file] = await testDb.insert(files).values({
    id,
    uploaderId,
    filename,
    mimeType: overrides.mimeType ?? 'image/png',
    size: overrides.size ?? 1234,
    storageKey: `${id}${ext}`,
    url: `https://cdn.test/files/${id}`,
  }).returning();
  return file;
}

async function createForumChannel(ownerId: string) {
  const guild = await createTestGuild(ownerId);
  const channel = await createTestChannel(guild.id, { type: 'GUILD_FORUM', name: 'showcase' });
  await testDb.update(channels)
    .set({
      forumTags: [
        { id: 'help', name: 'Help', color: '#22c55e' },
        { id: 'showcase', name: 'Showcase', color: '#3b82f6' },
      ],
    })
    .where(eq(channels.id, channel.id));
  return channel;
}

describe('Forum threads', () => {
  beforeEach(async () => { await cleanupDatabase(); });

  it('creates an attachment-only forum post and snapshots the attachment on the OP message', async () => {
    const { user } = await createTestUser();
    const channel = await createForumChannel(user.id);
    const image = await createUploadedFile(user.id);

    const thread = await createForumThread({
      channelId: channel.id,
      authorId: user.id,
      name: 'Look at this granite',
      body: null,
      attachmentIds: [image.id],
      tags: ['showcase'],
    });

    expect(thread.name).toBe('Look at this granite');
    expect(thread.forumTagIds).toEqual(['showcase']);

    const [op] = await testDb.select().from(messages).where(eq(messages.threadId, thread.id));
    expect(op.content).toBeNull();
    expect(op.attachments).toEqual([
      {
        id: image.id,
        url: image.url,
        filename: image.filename,
        size: image.size,
        mimeType: image.mimeType,
      },
    ]);
  });

  it('rolls back the thread when an attachment cannot be attached', async () => {
    const { user } = await createTestUser();
    const { user: otherUser } = await createTestUser();
    const channel = await createForumChannel(user.id);
    const otherImage = await createUploadedFile(otherUser.id);

    await expect(createForumThread({
      channelId: channel.id,
      authorId: user.id,
      name: 'Should not survive',
      body: 'This should roll back.',
      attachmentIds: [otherImage.id],
    })).rejects.toThrow(/uploaded/i);

    const rows = await testDb.select().from(threads).where(eq(threads.channelId, channel.id));
    expect(rows).toHaveLength(0);
  });

  it('persists valid forum tag IDs and rejects unknown tags without orphaning a thread', async () => {
    const { user } = await createTestUser();
    const channel = await createForumChannel(user.id);

    const thread = await createForumThread({
      channelId: channel.id,
      authorId: user.id,
      name: 'Need help',
      body: 'A tagged post',
      tags: ['help'],
    });

    expect(thread.forumTagIds).toEqual(['help']);

    await expect(createForumThread({
      channelId: channel.id,
      authorId: user.id,
      name: 'Bad tag',
      body: 'Invalid tag',
      tags: ['missing'],
    })).rejects.toThrow(/tag/i);

    const rows = await testDb.select().from(threads).where(and(eq(threads.channelId, channel.id), eq(threads.name, 'Bad tag')));
    expect(rows).toHaveLength(0);
  });

  it('lists forum threads with activity, tags, message count, and OP attachment preview', async () => {
    const { user } = await createTestUser();
    const channel = await createForumChannel(user.id);
    const image = await createUploadedFile(user.id);

    const thread = await createForumThread({
      channelId: channel.id,
      authorId: user.id,
      name: 'Preview me',
      body: 'Post body',
      attachmentIds: [image.id],
      tags: ['showcase'],
    });

    await testDb.insert(messages).values({
      channelId: channel.id,
      authorId: user.id,
      content: 'A reply',
      threadId: thread.id,
    });

    const result = await listForumThreads(channel.id, user.id);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: thread.id,
      tags: ['showcase'],
      forumTagIds: ['showcase'],
      messageCount: 2,
      opPreview: 'Post body',
      opAttachment: {
        id: image.id,
        url: image.url,
        filename: image.filename,
        size: image.size,
        mimeType: image.mimeType,
      },
    });
    expect(result[0].lastActivity).toBeTruthy();
  });
});
