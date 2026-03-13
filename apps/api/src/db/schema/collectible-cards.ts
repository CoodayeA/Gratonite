import { pgTable, uuid, varchar, text, integer, boolean, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/** collectible_cards — Card definitions with rarity and series. */
export const collectibleCards = pgTable('collectible_cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  image: varchar('image', { length: 500 }).notNull(),
  rarity: varchar('rarity', { length: 20 }).notNull().default('common'),
  series: varchar('series', { length: 100 }).notNull().default('default'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** card_packs — Pack definitions purchasable in the shop. */
export const cardPacks = pgTable('card_packs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  price: integer('price').notNull().default(100),
  cardsCount: integer('cards_count').notNull().default(3),
  image: varchar('image', { length: 500 }),
  series: varchar('series', { length: 100 }),
  rarityWeights: jsonb('rarity_weights').notNull().default({ common: 0.40, uncommon: 0.30, rare: 0.20, epic: 0.08, legendary: 0.02 }),
  guaranteedRarity: varchar('guaranteed_rarity', { length: 20 }),
  available: boolean('available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** user_cards — Individual card instances owned by users. */
export const userCards = pgTable('user_cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => collectibleCards.id, { onDelete: 'cascade' }),
  obtainedAt: timestamp('obtained_at', { withTimezone: true }).notNull().defaultNow(),
  obtainedVia: varchar('obtained_via', { length: 30 }).notNull().default('pack'),
}, (table) => [
  index('user_cards_user_id_idx').on(table.userId),
  index('user_cards_card_id_idx').on(table.cardId),
]);

/** card_trades — Trade proposals between users. */
export const cardTrades = pgTable('card_trades', {
  id: uuid('id').defaultRandom().primaryKey(),
  fromUserId: uuid('from_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  toUserId: uuid('to_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (table) => [
  index('card_trades_from_user_idx').on(table.fromUserId),
  index('card_trades_to_user_idx').on(table.toUserId),
]);

/** card_trade_items — Cards offered/requested in a trade. */
export const cardTradeItems = pgTable('card_trade_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tradeId: uuid('trade_id').notNull().references(() => cardTrades.id, { onDelete: 'cascade' }),
  userCardId: uuid('user_card_id').notNull().references(() => userCards.id, { onDelete: 'cascade' }),
  direction: varchar('direction', { length: 10 }).notNull(), // 'offer' or 'request'
});

export type CollectibleCard = typeof collectibleCards.$inferSelect;
export type CardPack = typeof cardPacks.$inferSelect;
export type UserCard = typeof userCards.$inferSelect;
export type CardTrade = typeof cardTrades.$inferSelect;
export type CardTradeItem = typeof cardTradeItems.$inferSelect;
