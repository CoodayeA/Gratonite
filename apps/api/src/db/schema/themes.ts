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
  unique,
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
  version: integer('version').notNull().default(1),
  reportCount: integer('report_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;

// ---------------------------------------------------------------------------
// theme_reports — one report per user per theme
// ---------------------------------------------------------------------------

export const themeReports = pgTable(
  'theme_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => themes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('theme_reports_theme_id_user_id_key').on(table.themeId, table.userId),
  ],
);

export type ThemeReport = typeof themeReports.$inferSelect;
export type NewThemeReport = typeof themeReports.$inferInsert;

// ---------------------------------------------------------------------------
// theme_ratings — one rating per user per theme
// ---------------------------------------------------------------------------

export const themeRatings = pgTable(
  'theme_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    themeId: uuid('theme_id')
      .notNull()
      .references(() => themes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('theme_ratings_theme_id_user_id_key').on(table.themeId, table.userId),
  ],
);

export type ThemeRating = typeof themeRatings.$inferSelect;
export type NewThemeRating = typeof themeRatings.$inferInsert;
