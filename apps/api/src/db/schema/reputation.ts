import { pgTable, uuid, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const messageUpvotes = pgTable('message_upvotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  value: integer('value').notNull().default(1), // +1 upvote, -1 downvote
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MessageUpvote = typeof messageUpvotes.$inferSelect;
