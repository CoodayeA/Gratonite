/**
 * collaborative-documents.ts — Drizzle ORM schema for real-time collaborative documents (CRDT).
 *
 * Each GUILD_DOCUMENT channel has one collaborative document that supports
 * real-time multi-user editing via Yjs CRDT. The `content` column stores the
 * serialized Yjs document state as a base64-encoded string for offline sync
 * and persistence.
 */
import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

export const collaborativeDocuments = pgTable('collaborative_documents', {
  /** Primary key. */
  id: uuid('id').primaryKey().defaultRandom(),

  /** The document channel this belongs to. One document per channel. */
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),

  /** Document title, editable inline. */
  title: varchar('title', { length: 200 }).notNull().default('Untitled'),

  /** Serialized Yjs document state as base64. */
  content: text('content').notNull().default(''),

  /** Monotonically increasing version counter for conflict detection. */
  version: integer('version').notNull().default(0),

  /** The user who created this document. */
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

  /** Timestamp of document creation. */
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  /** Block-based content as JSON array. */
  blocks: jsonb('blocks').notNull().default([]),

  /** Schema version for the blocks format. */
  blocksSchemaVersion: integer('blocks_schema_version').notNull().default(1),

  /** Optional cover image URL. */
  coverImage: text('cover_image'),

  /** Optional document icon (emoji or identifier). */
  icon: varchar('icon', { length: 50 }),

  /** Whether legacy content has been migrated to blocks. */
  contentMigrated: boolean('content_migrated').notNull().default(false),

  /** Timestamp of the last content update. */
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('collaborative_documents_channel_id_idx').on(table.channelId),
]);

export type CollaborativeDocument = typeof collaborativeDocuments.$inferSelect;
export type NewCollaborativeDocument = typeof collaborativeDocuments.$inferInsert;
