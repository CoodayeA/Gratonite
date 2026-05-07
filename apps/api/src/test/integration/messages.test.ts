import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from '../setup';
import { createTestUser, createTestGuild, createTestChannel } from '../helpers';
import { cleanupDatabase } from '../setup';
import { messages } from '../../db/schema/messages';
import { channels } from '../../db/schema/channels';
import { textReactions } from '../../db/schema/text-reactions';
import { messageService } from '../../services/message.service';
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

  it('returns grouped text reactions with fetched messages', async () => {
    const { user } = await createTestUser({ username: 'reader', displayName: 'Reader' });
    const { user: reactor } = await createTestUser({ username: 'reactor', displayName: 'Reactor' });
    const guild = await createTestGuild(user.id);
    const channel = await createTestChannel(guild.id);

    const [msg] = await testDb.insert(messages).values({
      channelId: channel.id,
      authorId: user.id,
      content: 'React to this',
    }).returning();

    await testDb.insert(textReactions).values({
      messageId: msg.id,
      userId: reactor.id,
      textContent: 'same',
    });

    const result = await messageService.getMessages(channel.id, user.id, undefined, testDb);

    expect(result).toHaveLength(1);
    expect(result[0].textReactions).toEqual([
      {
        text: 'same',
        count: 1,
        users: [{ id: reactor.id, username: 'reactor', displayName: 'Reactor' }],
      },
    ]);
  });
});
