import { testDb } from './setup';
import { users } from '../db/schema/users';
import { guilds, guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef';

export async function createTestUser(overrides: Partial<{
  username: string;
  email: string;
  password: string;
  displayName: string;
  isAdmin: boolean;
  isBot: boolean;
}> = {}) {
  const id = crypto.randomUUID();
  const username = overrides.username || `testuser_${id.slice(0, 8)}`;
  const email = overrides.email || `${username}@test.local`;
  const password = overrides.password || 'TestPassword123!';
  const passwordHash = await argon2.hash(password);

  const [user] = await testDb.insert(users).values({
    id,
    username,
    email,
    passwordHash,
    displayName: overrides.displayName || username,
    isAdmin: overrides.isAdmin || false,
    isBot: overrides.isBot || false,
  }).returning();

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

  return { user, token, password };
}

export async function createTestGuild(ownerId: string, overrides: Partial<{
  name: string;
  description: string;
}> = {}) {
  const [guild] = await testDb.insert(guilds).values({
    name: overrides.name || `Test Guild ${crypto.randomUUID().slice(0, 8)}`,
    description: overrides.description || 'A test guild',
    ownerId,
  }).returning();

  // Add owner as member
  await testDb.insert(guildMembers).values({
    guildId: guild.id,
    userId: ownerId,
  });

  return guild;
}

export async function createTestChannel(guildId: string, overrides: Partial<{
  name: string;
  type: string;
}> = {}) {
  const [channel] = await testDb.insert(channels).values({
    guildId,
    name: overrides.name || `test-channel-${crypto.randomUUID().slice(0, 8)}`,
    type: overrides.type || 'GUILD_TEXT',
  }).returning();

  return channel;
}

/** Build an Authorization header for a test user */
export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
