/**
 * economy.ts — Drizzle ORM schemas for user_wallets and economy_ledger tables.
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// user_wallets
// ---------------------------------------------------------------------------

export const userWallets = pgTable('user_wallets', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  lifetimeEarned: integer('lifetime_earned').notNull().default(0),
  lifetimeSpent: integer('lifetime_spent').notNull().default(0),
  lastDailyClaimAt: timestamp('last_daily_claim_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserWallet = typeof userWallets.$inferSelect;
export type NewUserWallet = typeof userWallets.$inferInsert;

// ---------------------------------------------------------------------------
// economy_ledger
// ---------------------------------------------------------------------------

export const economyLedger = pgTable('economy_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  direction: varchar('direction', { length: 10 }).notNull(), // 'earn' | 'spend'
  amount: integer('amount').notNull(),
  source: varchar('source', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }),
  contextKey: varchar('context_key', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type EconomyLedgerEntry = typeof economyLedger.$inferSelect;
export type NewEconomyLedgerEntry = typeof economyLedger.$inferInsert;
