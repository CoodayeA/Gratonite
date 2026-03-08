import { pgTable, uuid, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { channels } from './channels';
import { users } from './users';

export const giveaways = pgTable('giveaways', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  prize: text('prize').notNull(),
  description: text('description'),
  winnersCount: integer('winners_count').notNull().default(1),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  hostId: uuid('host_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  requiredRoleId: uuid('required_role_id'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Giveaway = typeof giveaways.$inferSelect;
export type NewGiveaway = typeof giveaways.$inferInsert;

export const giveawayEntries = pgTable('giveaway_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  giveawayId: uuid('giveaway_id').notNull().references(() => giveaways.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('giveaway_entries_giveaway_user_key').on(table.giveawayId, table.userId),
]);

export type GiveawayEntry = typeof giveawayEntries.$inferSelect;
export type NewGiveawayEntry = typeof giveawayEntries.$inferInsert;

export const giveawayWinners = pgTable('giveaway_winners', {
  id: uuid('id').primaryKey().defaultRandom(),
  giveawayId: uuid('giveaway_id').notNull().references(() => giveaways.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
});

export type GiveawayWinner = typeof giveawayWinners.$inferSelect;
export type NewGiveawayWinner = typeof giveawayWinners.$inferInsert;
