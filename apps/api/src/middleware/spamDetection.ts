/**
 * Spam detection middleware (item 93)
 * Rule-based spam detection: repeated messages, link spam, mention spam, rapid posting.
 * No AI — pure heuristics.
 */
import { Request, Response, NextFunction } from 'express';
import { redis } from '../lib/redis';
import { db } from '../db/index';
import { eq } from 'drizzle-orm';
import { guildSpamConfig } from '../db/schema/guild-spam-config';
import { modQueue } from '../db/schema/mod-queue';

// Cache config for 60 seconds
const configCache = new Map<string, { config: any; expires: number }>();

async function getConfig(guildId: string) {
  const cached = configCache.get(guildId);
  if (cached && cached.expires > Date.now()) return cached.config;

  const [config] = await db.select().from(guildSpamConfig)
    .where(eq(guildSpamConfig.guildId, guildId)).limit(1);

  const result = config || null;
  configCache.set(guildId, { config: result, expires: Date.now() + 60_000 });
  return result;
}

export async function checkSpam(
  userId: string,
  guildId: string | null,
  content: string,
): Promise<{ blocked: boolean; reason?: string }> {
  if (!guildId || !content) return { blocked: false };

  const config = await getConfig(guildId);
  if (!config || !config.enabled) return { blocked: false };

  const reasons: string[] = [];

  // 1. Check for excessive links
  const linkCount = (content.match(/https?:\/\//gi) || []).length;
  if (linkCount > config.maxLinksPerMessage) {
    reasons.push(`Too many links (${linkCount}/${config.maxLinksPerMessage})`);
  }

  // 2. Check for excessive mentions
  const mentionCount = (content.match(/<@[!&]?\w+>/g) || []).length +
    (content.match(/@everyone|@here/g) || []).length;
  if (mentionCount > config.maxMentionsPerMessage) {
    reasons.push(`Too many mentions (${mentionCount}/${config.maxMentionsPerMessage})`);
  }

  // 3. Check for duplicate messages (via Redis)
  const contentHash = Buffer.from(content.slice(0, 200)).toString('base64');
  const dupeKey = `spam:dupe:${guildId}:${userId}:${contentHash}`;
  const dupeCount = await redis.incr(dupeKey);
  await redis.expire(dupeKey, config.duplicateWindowSeconds);
  if (dupeCount > config.maxDuplicateMessages) {
    reasons.push(`Repeated message (${dupeCount} times)`);
  }

  // 4. Check rapid posting
  const rateKey = `spam:rate:${guildId}:${userId}`;
  const rateCount = await redis.incr(rateKey);
  await redis.expire(rateKey, 5); // 5-second window
  if (rateCount > 10) {
    reasons.push('Rapid message posting');
  }

  if (reasons.length === 0) return { blocked: false };

  // Flag in mod queue
  try {
    await db.insert(modQueue).values({
      guildId,
      type: 'spam',
      targetId: userId,
      content: `Spam detected: ${reasons.join('; ')} — Message: ${content.slice(0, 500)}`,
      reporterId: null,
    });
  } catch { /* best effort */ }

  // If action is 'flag', don't block — just log
  if (config.action === 'flag') return { blocked: false };

  return { blocked: true, reason: reasons.join('; ') };
}
