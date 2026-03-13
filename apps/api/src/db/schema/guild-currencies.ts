import { pgTable, uuid, varchar, integer, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

/**
 * guild_currencies — Server-specific currency configuration.
 * Each guild can create one custom currency with earning rules.
 */
export const guildCurrencies = pgTable('guild_currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }).unique(),
  name: varchar('name', { length: 50 }).notNull(),
  emoji: varchar('emoji', { length: 20 }).notNull().default('💰'),
  earnPerMessage: integer('earn_per_message').notNull().default(1),
  earnPerReaction: integer('earn_per_reaction').notNull().default(1),
  earnPerVoiceMinute: integer('earn_per_voice_minute').notNull().default(2),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildCurrency = typeof guildCurrencies.$inferSelect;
export type NewGuildCurrency = typeof guildCurrencies.$inferInsert;

/**
 * guild_currency_balances — Per-user balance of a guild's custom currency.
 */
export const guildCurrencyBalances = pgTable('guild_currency_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  lifetimeEarned: integer('lifetime_earned').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('guild_currency_balances_guild_user_key').on(table.guildId, table.userId),
  index('guild_currency_balances_guild_balance_idx').on(table.guildId, table.balance),
]);

export type GuildCurrencyBalance = typeof guildCurrencyBalances.$inferSelect;
export type NewGuildCurrencyBalance = typeof guildCurrencyBalances.$inferInsert;
