import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * notifications — User notifications (friend requests, mentions, etc.).
 */
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body'),
  data: jsonb('data'),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
