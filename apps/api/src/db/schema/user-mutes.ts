import { pgTable, uuid, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userMutes = pgTable('user_mutes', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mutedUserId: uuid('muted_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.mutedUserId] }),
]);

export type UserMute = typeof userMutes.$inferSelect;
export type NewUserMute = typeof userMutes.$inferInsert;
