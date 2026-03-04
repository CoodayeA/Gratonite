/**
 * themes.ts — Drizzle ORM schema for the themes table.
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
  numeric,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// themes
// ---------------------------------------------------------------------------

export const themes = pgTable('themes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  variables: jsonb('variables').notNull().default({}),
  tags: jsonb('tags').notNull().default([]),
  published: boolean('published').notNull().default(false),
  downloads: integer('downloads').notNull().default(0),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('0'),
  reviewCount: integer('review_count').notNull().default(0),
  previewImageUrl: varchar('preview_image_url', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
