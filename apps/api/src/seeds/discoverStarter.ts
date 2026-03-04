import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '../db/index';
import { botListings } from '../db/schema/bot-store';
import { guildMembers, guilds } from '../db/schema/guilds';
import { shopItems } from '../db/schema/shop';
import { themes } from '../db/schema/themes';
import { users } from '../db/schema/users';

type SeedAction = 'inserted' | 'updated' | 'skipped';

type SeedSummary = {
  guilds: Array<{ name: string; action: SeedAction }>;
  bots: Array<{ name: string; action: SeedAction }>;
  themes: Array<{ name: string; action: SeedAction }>;
};

const starterGuilds = [
  { name: 'Gratonite Lounge', description: 'Official Gratonite hangout for announcements and community events. #official #welcome' },
  { name: 'Creator Hub', description: 'Share your cosmetics, bots, and themes with other creators. #creators #build' },
  { name: 'Gaming Central', description: 'Find squads, run tournaments, and drop your clips. #gaming #lfg' },
  { name: 'Study & Focus', description: 'Co-work sessions, accountability threads, and resource sharing. #study #focus' },
  { name: 'Music Producers', description: 'Collab on tracks, mix feedback, and showcase your sound. #music #production' },
] as const;

const starterBots = [
  { name: 'Mod Sentinel', category: 'moderation', shortDescription: 'Auto moderation and safety workflows.', tags: ['mod', 'safety', 'auto'] },
  { name: 'Raid Shield', category: 'moderation', shortDescription: 'Anti-raid protections with one-click lockdown.', tags: ['security', 'raid', 'defense'] },
  { name: 'Welcome Wizard', category: 'engagement', shortDescription: 'Custom welcome funnels and onboarding flows.', tags: ['welcome', 'onboarding'] },
  { name: 'Event Planner', category: 'productivity', shortDescription: 'Schedule events, reminders, and RSVP check-ins.', tags: ['events', 'calendar'] },
  { name: 'Poll Master', category: 'engagement', shortDescription: 'Advanced polls with live analytics.', tags: ['polls', 'community'] },
  { name: 'Clip Vault', category: 'media', shortDescription: 'Save and organize gameplay clips automatically.', tags: ['clips', 'media'] },
  { name: 'Music Queue Pro', category: 'music', shortDescription: 'Reliable music queue with room-level controls.', tags: ['music', 'queue'] },
  { name: 'Ticket Desk', category: 'support', shortDescription: 'Support tickets with escalation routing.', tags: ['support', 'tickets'] },
] as const;

const starterThemes = [
  { name: 'Aurora Pulse', description: 'Cool cyan gradients with sharp contrast.', tags: ['modern', 'cool'], accent: '#38bdf8', bg: '#0b1220' },
  { name: 'Solar Ember', description: 'Warm amber tones with high readability.', tags: ['warm', 'bold'], accent: '#f59e0b', bg: '#16110a' },
  { name: 'Forest Grid', description: 'Deep greens tuned for long chat sessions.', tags: ['nature', 'calm'], accent: '#22c55e', bg: '#0a1510' },
  { name: 'Midnight Neon', description: 'Dark canvas with electric highlights.', tags: ['dark', 'neon'], accent: '#8b5cf6', bg: '#0b0b16' },
  { name: 'Rose Quartz', description: 'Soft pink palette with subtle glass depth.', tags: ['soft', 'glass'], accent: '#f472b6', bg: '#160f14' },
] as const;

async function resolveSeedCreatorId(): Promise<string> {
  const [creator] = await db
    .select({ id: users.id })
    .from(users)
    .orderBy(desc(users.isAdmin), users.createdAt)
    .limit(1);

  if (!creator?.id) {
    throw new Error('Cannot seed discover starter data: no users exist. Create at least one user first.');
  }
  return creator.id;
}

async function upsertGuild(ownerId: string, seed: (typeof starterGuilds)[number]) {
  const [existing] = await db
    .select({ id: guilds.id, memberCount: guilds.memberCount })
    .from(guilds)
    .where(sql`lower(${guilds.name}) = ${seed.name.toLowerCase()}`)
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(guilds)
      .values({
        name: seed.name,
        description: seed.description,
        ownerId,
        isDiscoverable: true,
        // Seed with the minimum real value; exact count is synchronized below.
        memberCount: 1,
      })
      .returning({ id: guilds.id });

    await db.insert(guildMembers).values({ guildId: created.id, userId: ownerId });
    await db
      .update(guilds)
      .set({
        memberCount: sql`(
          select count(*)
          from guild_members gm
          where gm.guild_id = ${created.id}
        )`,
        updatedAt: new Date(),
      })
      .where(eq(guilds.id, created.id));
    return 'inserted' as const;
  }

  await db
    .update(guilds)
    .set({
      description: seed.description,
      isDiscoverable: true,
      updatedAt: new Date(),
    })
    .where(eq(guilds.id, existing.id));

  const [member] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, existing.id), eq(guildMembers.userId, ownerId)))
    .limit(1);

  if (!member) {
    await db.insert(guildMembers).values({ guildId: existing.id, userId: ownerId });
  }

  // Keep discover counts based on actual memberships, never seed constants.
  await db
    .update(guilds)
    .set({
      memberCount: sql`(
        select count(*)
        from guild_members gm
        where gm.guild_id = ${existing.id}
      )`,
      updatedAt: new Date(),
    })
    .where(eq(guilds.id, existing.id));

  return 'updated' as const;
}

async function upsertBotListing(creatorId: string, seed: (typeof starterBots)[number]) {
  const [existing] = await db
    .select({ id: botListings.id })
    .from(botListings)
    .where(sql`lower(${botListings.name}) = ${seed.name.toLowerCase()}`)
    .limit(1);

  if (!existing) {
    await db.insert(botListings).values({
      creatorId,
      name: seed.name,
      shortDescription: seed.shortDescription,
      description: `${seed.shortDescription} Starter listing.`,
      category: seed.category,
      tags: [...seed.tags],
      listed: true,
      verified: true,
    });
    return 'inserted' as const;
  }

  await db
    .update(botListings)
    .set({
      shortDescription: seed.shortDescription,
      description: `${seed.shortDescription} Starter listing.`,
      category: seed.category,
      tags: [...seed.tags],
      listed: true,
      verified: true,
      updatedAt: new Date(),
    })
    .where(eq(botListings.id, existing.id));

  return 'updated' as const;
}

async function upsertTheme(creatorId: string, seed: (typeof starterThemes)[number]) {
  const [existing] = await db
    .select({ id: themes.id })
    .from(themes)
    .where(sql`lower(${themes.name}) = ${seed.name.toLowerCase()}`)
    .limit(1);

  const variables = {
    '--bg-app': seed.bg,
    '--bg-primary': seed.bg,
    '--accent-primary': seed.accent,
    '--text-primary': '#f8fafc',
    '--text-secondary': '#cbd5e1',
  } as const;

  if (!existing) {
    await db.insert(themes).values({
      creatorId,
      name: seed.name,
      description: seed.description,
      tags: [...seed.tags],
      variables,
      published: true,
      downloads: 10,
      previewImageUrl: `linear-gradient(135deg, ${seed.bg}, ${seed.accent})`,
    });
    return 'inserted' as const;
  }

  await db
    .update(themes)
    .set({
      description: seed.description,
      tags: [...seed.tags],
      variables,
      published: true,
      previewImageUrl: `linear-gradient(135deg, ${seed.bg}, ${seed.accent})`,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, existing.id));

  return 'updated' as const;
}

export async function seedDiscoverStarter(): Promise<SeedSummary> {
  const creatorId = await resolveSeedCreatorId();
  const summary: SeedSummary = { guilds: [], bots: [], themes: [] };

  for (const guildSeed of starterGuilds) {
    const action = await upsertGuild(creatorId, guildSeed);
    summary.guilds.push({ name: guildSeed.name, action });
  }

  for (const botSeed of starterBots) {
    const action = await upsertBotListing(creatorId, botSeed);
    summary.bots.push({ name: botSeed.name, action });
  }

  for (const themeSeed of starterThemes) {
    const action = await upsertTheme(creatorId, themeSeed);
    summary.themes.push({ name: themeSeed.name, action });
  }

  return summary;
}

export async function getCoreDataCounts() {
  const [guildTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(guilds);
  const [discoverableGuildRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(guilds)
    .where(eq(guilds.isDiscoverable, true));

  const [botTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(botListings);
  const [listedBotRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(botListings)
    .where(eq(botListings.listed, true));

  const [themeTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(themes);
  const [publishedThemeRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(themes)
    .where(eq(themes.published, true));

  const [shopTotalRow] = await db.select({ count: sql<number>`count(*)` }).from(shopItems);
  const [availableShopRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(shopItems)
    .where(eq(shopItems.available, true));

  const categories = ['avatar_frame', 'decoration', 'profile_effect', 'nameplate', 'soundboard'] as const;
  const availableByCategory: Record<string, number> = {};
  for (const type of categories) {
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shopItems)
      .where(type === 'nameplate'
        ? sql`${shopItems.available} = true and ${shopItems.type} in ('nameplate','name_plate')`
        : sql`${shopItems.available} = true and ${shopItems.type} = ${type}`);
    availableByCategory[type] = Number(row?.count ?? 0);
  }

  return {
    guildsTotal: Number(guildTotalRow?.count ?? 0),
    guildsDiscoverable: Number(discoverableGuildRow?.count ?? 0),
    botListingsTotal: Number(botTotalRow?.count ?? 0),
    botListingsListed: Number(listedBotRow?.count ?? 0),
    themesTotal: Number(themeTotalRow?.count ?? 0),
    themesPublished: Number(publishedThemeRow?.count ?? 0),
    shopItemsTotal: Number(shopTotalRow?.count ?? 0),
    shopItemsAvailable: Number(availableShopRow?.count ?? 0),
    availableByCategory,
  };
}
