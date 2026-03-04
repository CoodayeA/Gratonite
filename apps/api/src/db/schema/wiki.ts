/**
 * wiki.ts — Drizzle ORM schemas for wiki_pages and wiki_revisions tables.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

// ---------------------------------------------------------------------------
// wiki_pages
// ---------------------------------------------------------------------------

export const wikiPages = pgTable('wiki_pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull().default(''),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WikiPage = typeof wikiPages.$inferSelect;
export type NewWikiPage = typeof wikiPages.$inferInsert;

// ---------------------------------------------------------------------------
// wiki_revisions
// ---------------------------------------------------------------------------

export const wikiRevisions = pgTable('wiki_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id').notNull().references(() => wikiPages.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  editedBy: uuid('edited_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WikiRevision = typeof wikiRevisions.$inferSelect;
export type NewWikiRevision = typeof wikiRevisions.$inferInsert;
