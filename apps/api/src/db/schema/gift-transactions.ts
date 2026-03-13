import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * gift_transactions — Tracks gift subscriptions (boosts, premium) between users.
 * A gift is created by the sender, optionally with a message.
 * It stays in "pending" until redeemed by the recipient.
 */
export const giftTransactions = pgTable('gift_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  giftType: text('gift_type').notNull(), // 'server_boost' | 'premium_month' | 'premium_year' | 'coins'
  guildId: uuid('guild_id'), // only for server_boost type
  quantity: integer('quantity').notNull().default(1),
  message: text('message'), // optional personal message
  redeemCode: text('redeem_code').notNull().unique(),
  status: text('status').notNull().default('pending'), // 'pending' | 'redeemed' | 'expired' | 'refunded'
  coinsCost: integer('coins_cost').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export type GiftTransaction = typeof giftTransactions.$inferSelect;
export type NewGiftTransaction = typeof giftTransactions.$inferInsert;
