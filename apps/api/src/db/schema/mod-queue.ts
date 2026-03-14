import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const modQueue = pgTable('mod_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(),
  targetId: uuid('target_id'),
  content: text('content'),
  reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('mod_queue_guild_status_idx').on(table.guildId, table.status),
]);

export type ModQueueEntry = typeof modQueue.$inferSelect;
