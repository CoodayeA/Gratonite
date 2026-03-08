import { pgTable, uuid, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

export const profileShowcaseItems = pgTable('profile_showcase_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  slot: integer('slot').notNull(),
  itemType: text('item_type').notNull(),
  referenceId: text('reference_id').notNull(),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.slot)]);

export type ProfileShowcaseItem = typeof profileShowcaseItems.$inferSelect;
export type NewProfileShowcaseItem = typeof profileShowcaseItems.$inferInsert;
