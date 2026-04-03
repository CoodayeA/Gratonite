import { redis } from './redis';

const LEVELS = new Set(['all', 'mentions', 'nothing']);

/**
 * When a user joins a guild, seed their per-guild Redis notification prefs from
 * `guilds.default_member_notification_level` only if they have no stored value yet.
 */
export async function seedDefaultGuildNotificationIfUnset(
  userId: string,
  guildId: string,
  level: string | null | undefined,
): Promise<void> {
  if (!level || !LEVELS.has(level)) return;
  const redisKey = `user-notif:${userId}:notif:guild:${guildId}`;
  try {
    const existing = await redis.get(redisKey);
    if (existing) return;
    await redis.set(redisKey, JSON.stringify({ level, mutedUntil: null }));
  } catch {
    /* non-fatal */
  }
}
