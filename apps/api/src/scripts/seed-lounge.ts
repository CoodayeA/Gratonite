/**
 * seed-lounge.ts — Ensures the "Gratonite Lounge" official server exists,
 * is owned by the first admin user (ferdinand), and has a #general text
 * channel and a Voice Lounge channel.
 *
 * Run:  npx tsx src/scripts/seed-lounge.ts
 */

import 'dotenv/config';
import { desc, eq, sql, and } from 'drizzle-orm';
import { db } from '../db/index';
import { guilds, guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';

async function main() {
  // 1. Find the first admin user (ferdinand / coodaye@gmail.com)
  const [owner] = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .orderBy(desc(users.isAdmin), users.createdAt)
    .limit(1);

  if (!owner?.id) {
    throw new Error('No users found. Create at least one user first.');
  }

  console.log(`Using owner: ${owner.email ?? owner.username} (${owner.id})`);

  // 2. Upsert the Gratonite Lounge guild
  const [existing] = await db
    .select({ id: guilds.id })
    .from(guilds)
    .where(sql`lower(${guilds.name}) = 'gratonite lounge'`)
    .limit(1);

  let guildId: string;

  if (existing) {
    guildId = existing.id;
    console.log(`Gratonite Lounge already exists: ${guildId}`);

    // Ensure it's discoverable and pinned
    await db
      .update(guilds)
      .set({ isDiscoverable: true, isPinned: true, ownerId: owner.id, updatedAt: new Date() })
      .where(eq(guilds.id, guildId));
  } else {
    const [created] = await db
      .insert(guilds)
      .values({
        name: 'Gratonite Lounge',
        description: 'Official Gratonite hangout for announcements and community events. #official #welcome',
        ownerId: owner.id,
        isDiscoverable: true,
        isPinned: true,
        memberCount: 1,
      })
      .returning({ id: guilds.id });

    guildId = created.id;
    console.log(`Created Gratonite Lounge: ${guildId}`);
  }

  // 3. Ensure the owner is a member
  const [membership] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, owner.id)))
    .limit(1);

  if (!membership) {
    await db.insert(guildMembers).values({ guildId, userId: owner.id });
    console.log('Added owner as member');
  }

  // Sync member count
  await db
    .update(guilds)
    .set({
      memberCount: sql`(select count(*) from guild_members gm where gm.guild_id = ${guildId})`,
      updatedAt: new Date(),
    })
    .where(eq(guilds.id, guildId));

  // 4. Ensure default channels exist
  const existingChannels = await db
    .select({ name: channels.name, type: channels.type })
    .from(channels)
    .where(eq(channels.guildId, guildId));

  const hasGeneral = existingChannels.some(c => c.name === 'general' && c.type === 'GUILD_TEXT');
  const hasVoice = existingChannels.some(c => c.type === 'GUILD_VOICE');

  if (!hasGeneral) {
    await db.insert(channels).values({
      guildId,
      name: 'general',
      type: 'GUILD_TEXT',
      position: 0,
    });
    console.log('Created #general channel');
  } else {
    console.log('#general already exists');
  }

  if (!hasVoice) {
    await db.insert(channels).values({
      guildId,
      name: 'Voice Lounge',
      type: 'GUILD_VOICE',
      position: 1,
    });
    console.log('Created Voice Lounge channel');
  } else {
    console.log('Voice channel already exists');
  }

  console.log(`\nDone! Gratonite Lounge guild ID: ${guildId}`);
  console.log(`Set GRATONITE_LOUNGE_GUILD_ID=${guildId} in your .env to configure the Join Lounge button.`);
  process.exit(0);
}

main().catch(err => {
  console.error('[seed-lounge] failed:', err);
  process.exit(1);
});
