import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from '../setup';
import { createTestUser } from '../helpers';
import { cleanupDatabase } from '../setup';
import { botApplications } from '../../db/schema/bot-applications';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef';

describe('Bot Webhooks', () => {
  beforeEach(async () => { await cleanupDatabase(); });

  it('should create a bot application', async () => {
    const { user } = await createTestUser();
    const webhookSecret = crypto.randomBytes(32).toString('hex');
    const webhookSecretHash = await argon2.hash(webhookSecret);
    const apiToken = jwt.sign({ botId: crypto.randomUUID() }, JWT_SECRET, { expiresIn: '365d' });

    const [bot] = await testDb.insert(botApplications).values({
      ownerId: user.id,
      name: 'Test Bot',
      webhookUrl: 'https://example.com/webhook',
      webhookSecretHash,
      webhookSecretKey: crypto.randomBytes(32).toString('hex'),
      apiToken,
    }).returning();

    expect(bot.name).toBe('Test Bot');
    expect(bot.ownerId).toBe(user.id);
    expect(bot.isActive).toBe(true);
  });
});
