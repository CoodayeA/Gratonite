import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

export const referrals = pgTable('referrals', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerId: text('referrer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  referredId: text('referred_id').references(() => users.id, { onDelete: 'cascade' }).unique(),
  code: text('code').notNull().unique(),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
  rewardGranted: boolean('reward_granted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Referral = typeof referrals.$inferSelect;
export type NewReferral = typeof referrals.$inferInsert;
