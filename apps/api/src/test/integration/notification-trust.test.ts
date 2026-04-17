import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { cleanupDatabase, testDb } from '../setup';
import { createTestChannel, createTestGuild, createTestUser } from '../helpers';
import { guildMembers } from '../../db/schema/guilds';
import { channelNotificationPrefs } from '../../db/schema/channel-notification-prefs';
import { notifications } from '../../db/schema/notifications';
import { threadMembers } from '../../db/schema/threads';
import { userSettings } from '../../db/schema/settings';

const { redisGet, redisSet, redisTtl, socketEmit } = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  redisTtl: vi.fn(),
  socketEmit: vi.fn(),
}));

vi.mock('../../lib/redis', () => ({
  redis: {
    get: redisGet,
    set: redisSet,
    ttl: redisTtl,
  },
}));

vi.mock('../../lib/socket-io', () => ({
  getIO: () => ({
    to: () => ({ emit: socketEmit }),
  }),
}));

import { createNotification } from '../../lib/notifications';
import { createForumThread } from '../../services/thread.service';
import { messageService } from '../../services/message.service';

describe('Notification trust matrix', () => {
  beforeEach(async () => {
    await cleanupDatabase();
    redisGet.mockReset().mockResolvedValue(null);
    redisSet.mockReset().mockResolvedValue('OK');
    redisTtl.mockReset().mockResolvedValue(-1);
    socketEmit.mockReset();
  });

  it('lets a channel override block mentions even when the server override allows them', async () => {
    const { user: recipient } = await createTestUser();
    const { user: sender } = await createTestUser();
    const guild = await createTestGuild(sender.id);
    const channel = await createTestChannel(guild.id);

    await testDb.insert(guildMembers).values({ guildId: guild.id, userId: recipient.id });
    await testDb.insert(channelNotificationPrefs).values({
      userId: recipient.id,
      channelId: channel.id,
      level: 'none',
      mutedUntil: null,
    });

    redisGet.mockImplementation(async (key: string) => {
      if (key === `user-notif:${recipient.id}:notif:guild:${guild.id}`) {
        return JSON.stringify({ level: 'mentions', mutedUntil: null });
      }
      return null;
    });

    await createNotification({
      userId: recipient.id,
      type: 'mention',
      title: 'Blocked mention',
      body: 'This should not be stored',
      data: {
        senderId: sender.id,
        senderName: sender.username,
        channelId: channel.id,
        guildId: guild.id,
      },
    });

    const rows = await testDb.select().from(notifications).where(eq(notifications.userId, recipient.id));
    expect(rows).toHaveLength(0);
    expect(socketEmit).not.toHaveBeenCalled();
  });

  it('keeps allowed notifications in the inbox while quiet hours suppress real-time delivery', async () => {
    const { user: recipient } = await createTestUser();
    const { user: sender } = await createTestUser();
    const guild = await createTestGuild(sender.id);
    const channel = await createTestChannel(guild.id);
    const now = new Date();
    const quietStart = new Date(now.getTime() - 60_000);
    const quietEnd = new Date(now.getTime() + 60_000);
    const toUtcHm = (value: Date) => `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;

    await testDb.insert(userSettings).values({
      userId: recipient.id,
      notificationQuietHours: {
        enabled: true,
        startTime: toUtcHm(quietStart),
        endTime: toUtcHm(quietEnd),
        timezone: 'UTC',
        days: [0, 1, 2, 3, 4, 5, 6],
      },
    });

    await createNotification({
      userId: recipient.id,
      type: 'mention',
      title: 'Quiet hours mention',
      body: 'Stored, not pushed',
      data: {
        senderId: sender.id,
        senderName: sender.username,
        channelId: channel.id,
        guildId: guild.id,
      },
    });

    const [stored] = await testDb.select().from(notifications).where(eq(notifications.userId, recipient.id));
    expect(stored).toBeTruthy();
    const trust = (stored.data as Record<string, any>).notificationTrust;
    expect(trust.delivery).toBe('inbox_only');
    expect(trust.quietHoursActive).toBe(true);
    expect(socketEmit).not.toHaveBeenCalled();
  });

  it('creates explainable forum reply notifications for thread participants', async () => {
    const { user: owner } = await createTestUser();
    const { user: replier } = await createTestUser();
    const guild = await createTestGuild(owner.id);
    const channel = await createTestChannel(guild.id, { type: 'GUILD_FORUM', name: 'stone-talk' });

    await testDb.insert(guildMembers).values({ guildId: guild.id, userId: replier.id });

    const thread = await createForumThread({
      channelId: channel.id,
      authorId: owner.id,
      name: 'Quartz veins',
      body: 'Opening post',
    });

    await messageService.createMessage(channel.id, replier.id, {
      content: 'A forum reply',
      threadId: thread.id,
    });

    const participantRows = await testDb.select().from(threadMembers)
      .where(and(eq(threadMembers.threadId, thread.id), eq(threadMembers.userId, replier.id)));
    expect(participantRows).toHaveLength(1);

    const replyNotifications = await testDb.select().from(notifications)
      .where(and(eq(notifications.userId, owner.id), eq(notifications.type, 'forum_reply')));

    expect(replyNotifications).toHaveLength(1);
    const trust = (replyNotifications[0].data as Record<string, any>).notificationTrust;
    expect(trust.requiredLevel).toBe('mentions');
    expect(trust.summary).toContain('forum reply');
    expect(trust.sourceLabel).toBeTruthy();
  });

  it('respects active channel mutes for forum reply notifications', async () => {
    const { user: owner } = await createTestUser();
    const { user: replier } = await createTestUser();
    const guild = await createTestGuild(owner.id);
    const channel = await createTestChannel(guild.id, { type: 'GUILD_FORUM', name: 'quiet-stones' });

    await testDb.insert(guildMembers).values({ guildId: guild.id, userId: replier.id });
    await testDb.insert(channelNotificationPrefs).values({
      userId: owner.id,
      channelId: channel.id,
      level: 'all',
      mutedUntil: new Date(Date.now() + 60 * 60 * 1000),
    });

    const thread = await createForumThread({
      channelId: channel.id,
      authorId: owner.id,
      name: 'Muted thread',
      body: 'Please stay quiet',
    });

    await messageService.createMessage(channel.id, replier.id, {
      content: 'This should stay quiet',
      threadId: thread.id,
    });

    const replyNotifications = await testDb.select().from(notifications)
      .where(and(eq(notifications.userId, owner.id), eq(notifications.type, 'forum_reply')));
    expect(replyNotifications).toHaveLength(0);
  });
});
