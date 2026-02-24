import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
} from 'drizzle-orm/pg-core';
import { bigintString } from './helpers';

// ============================================================================
// Gratonites System Tables
// ============================================================================

// User streaks for daily login tracking
export const userStreaks = pgTable('user_streaks', {
  userId: bigintString('user_id')
    .primaryKey()
    .references(() => require('./users').users.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  totalLogins: integer('total_logins').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// User Gratonites currency balances
export const gratonitesBalances = pgTable('gratonites_balances', {
  userId: bigintString('user_id')
    .primaryKey()
    .references(() => require('./users').users.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  lifetimeEarned: integer('lifetime_earned').notNull().default(0),
  lifetimeSpent: integer('lifetime_spent').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Gratonites transaction history
export const gratonitesTransactions = pgTable('gratonites_transactions', {
  id: bigintString('id').primaryKey(),
  userId: bigintString('user_id')
    .notNull()
    .references(() => require('./users').users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'earn' or 'spend'
  source: varchar('source', { length: 50 }).notNull(), // 'daily_login', 'message_milestone', etc.
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
