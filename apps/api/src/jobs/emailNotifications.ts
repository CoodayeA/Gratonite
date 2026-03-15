import { db } from '../db/index';
import { logger } from '../lib/logger';
import { notifications } from '../db/schema/notifications';
import { users } from '../db/schema/users';
import { userSettings } from '../db/schema/settings';
import { sendMail } from '../lib/mailer';
import { redis } from '../lib/redis';
import { eq, and, sql } from 'drizzle-orm';

/** Core processor — used by both the legacy setInterval and BullMQ worker. */
export async function processEmailNotifications(): Promise<void> {
  return runEmailNotifications();
}

/** @deprecated Legacy setInterval starter — kept for fallback. Use BullMQ worker instead. */
export function startEmailNotificationJob(): void {
  setInterval(async () => {
    try {
      await runEmailNotifications();
    } catch (err) {
      logger.error('[email-notif] error:', err);
    }
  }, 15 * 60 * 1000);
}

async function runEmailNotifications(): Promise<void> {
  // Find unread notifications from the last 24 hours grouped by user
  const unread = await db
    .select({
      userId: notifications.userId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(notifications)
    .where(and(eq(notifications.read, false), sql`${notifications.createdAt} > now() - interval '24 hours'`))
    .groupBy(notifications.userId);

  for (const row of unread) {
    const redisKey = `email_notif:${row.userId}`;
    const sent = await redis.get(redisKey);
    if (sent) continue;

    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, row.userId)).limit(1);
    if (!user?.email) continue;

    const [settings] = await db.select({ emailNotifications: userSettings.emailNotifications }).from(userSettings).where(eq(userSettings.userId, row.userId)).limit(1);
    const prefs = (settings?.emailNotifications as any) || { mentions: false, dms: false, frequency: 'never' };

    // Respect frequency setting — skip entirely if 'never'
    if (prefs.frequency === 'never') continue;

    // Check if user wants mention or DM notifications
    if (!prefs.mentions && !prefs.dms) continue;

    await sendMail({
      to: user.email,
      subject: `You have ${row.count} unread notification${row.count > 1 ? 's' : ''} on Gratonite`,
      html: `<p>You have <strong>${row.count}</strong> unread notification${row.count > 1 ? 's' : ''} on Gratonite.</p><p><a href="https://gratonite.chat/app">Click here to view them</a></p>`,
    });

    // Use appropriate Redis expiry based on frequency
    const expiry = prefs.frequency === 'daily' ? 24 * 3600 : 4 * 3600;
    await redis.set(redisKey, '1', 'EX', expiry);
  }
}
