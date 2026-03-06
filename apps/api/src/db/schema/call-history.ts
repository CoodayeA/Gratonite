import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

/**
 * call_history — Tracks voice/video call records.
 */
export const callHistory = pgTable('call_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  initiatedBy: uuid('initiated_by').notNull().references(() => users.id),
  participants: text('participants').array().notNull().default([]),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  missed: boolean('missed').notNull().default(false),
});

export type CallHistoryEntry = typeof callHistory.$inferSelect;
export type NewCallHistoryEntry = typeof callHistory.$inferInsert;
