import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const statusPresets = pgTable('status_presets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  customText: text('custom_text'),
  emoji: text('emoji'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('status_presets_user_idx').on(table.userId),
}));

export type StatusPreset = typeof statusPresets.$inferSelect;
export type NewStatusPreset = typeof statusPresets.$inferInsert;
