import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userNotes = pgTable('user_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('user_notes_author_target_key').on(t.authorId, t.targetId),
]);

export type UserNote = typeof userNotes.$inferSelect;
export type NewUserNote = typeof userNotes.$inferInsert;
