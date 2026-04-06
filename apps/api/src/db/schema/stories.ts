import { pgTable, uuid, varchar, text, boolean, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * stories — Ephemeral 24-hour moments (text or image).
 */
export const stories = pgTable('stories', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  type: varchar('type', { length: 10 }).notNull().default('text'),
  imageUrl: text('image_url'),
  backgroundColor: varchar('background_color', { length: 30 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_stories_user').on(table.userId),
  index('idx_stories_expires').on(table.expiresAt),
]);

export const storyViews = pgTable('story_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  storyId: uuid('story_id').notNull().references(() => stories.id, { onDelete: 'cascade' }),
  viewerId: uuid('viewer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_story_views_story').on(table.storyId),
]);

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type StoryView = typeof storyViews.$inferSelect;
