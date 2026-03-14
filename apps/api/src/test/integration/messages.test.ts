import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from '../setup';
import { createTestUser, createTestGuild, createTestChannel } from '../helpers';
import { cleanupDatabase } from '../setup';
import { messages } from '../../db/schema/messages';
import { channels } from '../../db/schema/channels';
import { eq } from 'drizzle-orm';

describe('Messages', () => {
  beforeEach(async () => { await cleanupDatabase(); });

  it('should insert and retrieve a message', async () => {
    const { user } = await createTestUser();
    const guild = await createTestGuild(user.id);
    const channel = await createTestChannel(guild.id);

    const [msg] = await testDb.insert(messages).values({
      channelId: channel.id,
      authorId: user.id,
      content: 'Hello, world!',
    }).returning();

    expect(msg.content).toBe('Hello, world!');
    expect(msg.authorId).toBe(user.id);
    expect(msg.channelId).toBe(channel.id);
    expect(msg.edited).toBe(false);
  });

  it('should cascade delete messages when channel is deleted', async () => {
    const { user } = await createTestUser();
    const guild = await createTestGuild(user.id);
    const channel = await createTestChannel(guild.id);

    await testDb.insert(messages).values({
      channelId: channel.id,
      authorId: user.id,
      content: 'Will be deleted',
    });

    await testDb.delete(channels).where(eq(channels.id, channel.id));

    const remaining = await testDb.select().from(messages).where(eq(messages.channelId, channel.id));
    expect(remaining).toHaveLength(0);
  });
});
