/**
 * cosmetics.ts — Drizzle ORM schemas for cosmetics and user_cosmetics tables.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// cosmetics
// ---------------------------------------------------------------------------

export const cosmetics = pgTable('cosmetics', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(), // avatar_frame | banner | profile_effect | nameplate | theme
  description: text('description'),
  price: integer('price').notNull().default(0),
  previewImageUrl: varchar('preview_image_url', { length: 512 }),
  assetUrl: varchar('asset_url', { length: 512 }),
  rarity: varchar('rarity', { length: 32 }).notNull().default('common'),
  creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'set null' }),
  isPublished: boolean('is_published').notNull().default(false),
  assetConfig: jsonb('asset_config'), // config-based editor output (null for uploaded assets)
  status: varchar('status', { length: 32 }).notNull().default('draft'), // 'draft' | 'pending_review' | 'approved' | 'rejected'
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Cosmetic = typeof cosmetics.$inferSelect;
export type NewCosmetic = typeof cosmetics.$inferInsert;

// ---------------------------------------------------------------------------
// user_cosmetics
// ---------------------------------------------------------------------------

export const userCosmetics = pgTable('user_cosmetics', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cosmeticId: uuid('cosmetic_id').notNull().references(() => cosmetics.id, { onDelete: 'cascade' }),
  equipped: boolean('equipped').notNull().default(false),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserCosmetic = typeof userCosmetics.$inferSelect;
export type NewUserCosmetic = typeof userCosmetics.$inferInsert;
