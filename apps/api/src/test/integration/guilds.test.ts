import { describe, it, expect, beforeEach } from 'vitest';
import { testDb } from '../setup';
import { createTestUser, createTestGuild } from '../helpers';
import { cleanupDatabase } from '../setup';
import { guildMembers } from '../../db/schema/guilds';
import { eq } from 'drizzle-orm';

describe('Guilds', () => {
  beforeEach(async () => { await cleanupDatabase(); });

  it('should create a guild with owner as first member', async () => {
    const { user } = await createTestUser();
    const guild = await createTestGuild(user.id, { name: 'My Server' });
    expect(guild.name).toBe('My Server');
    expect(guild.ownerId).toBe(user.id);

    const members = await testDb.select().from(guildMembers).where(eq(guildMembers.guildId, guild.id));
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(user.id);
  });

  it('should allow multiple guilds per user', async () => {
    const { user } = await createTestUser();
    const guild1 = await createTestGuild(user.id, { name: 'Server 1' });
    const guild2 = await createTestGuild(user.id, { name: 'Server 2' });
    expect(guild1.id).not.toBe(guild2.id);
  });
});
