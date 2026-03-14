import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from '../setup';
import { createTestUser } from '../helpers';
import { cleanupDatabase } from '../setup';
import { users } from '../../db/schema/users';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';

describe('Auth', () => {
  beforeEach(async () => { await cleanupDatabase(); });

  it('should create a user with hashed password', async () => {
    const { user, password } = await createTestUser({ username: 'alice' });
    expect(user.username).toBe('alice');
    expect(user.passwordHash).not.toBe(password);
    expect(await argon2.verify(user.passwordHash, password)).toBe(true);
  });

  it('should mark bot users correctly', async () => {
    const { user } = await createTestUser({ isBot: true, username: 'botuser' });
    expect(user.isBot).toBe(true);
  });

  it('should enforce unique usernames', async () => {
    await createTestUser({ username: 'unique_user' });
    await expect(createTestUser({ username: 'unique_user' })).rejects.toThrow();
  });

  it('should enforce unique emails', async () => {
    await createTestUser({ email: 'same@test.local' });
    await expect(createTestUser({ email: 'same@test.local' })).rejects.toThrow();
  });
});
