import { pgTable, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';

export const profileViews = pgTable(
  'profile_views',
  {
    id: text('id').primaryKey().$defaultFn(() => `pv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    viewerId: text('viewer_id').notNull(),
    profileId: text('profile_id').notNull(),
    viewerName: text('viewer_name').notNull().default('User'),
    viewerAvatarHash: text('viewer_avatar_hash'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_profile_views_profile_id').on(table.profileId),
    index('idx_profile_views_created_at').on(table.createdAt),
  ],
);

export const trades = pgTable(
  'trades',
  {
    id: text('id').primaryKey().$defaultFn(() => `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    proposerId: text('proposer_id').notNull(),
    recipientId: text('recipient_id').notNull(),
    status: text('status').notNull().default('pending'),
    proposerItems: jsonb('proposer_items').notNull().default([]),
    recipientItems: jsonb('recipient_items').notNull().default([]),
    proposerGratonites: text('proposer_gratonites').notNull().default('0'),
    recipientGratonites: text('recipient_gratonites').notNull().default('0'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_trades_proposer_id').on(table.proposerId),
    index('idx_trades_recipient_id').on(table.recipientId),
    index('idx_trades_status').on(table.status),
  ],
);
