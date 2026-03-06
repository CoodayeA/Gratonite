/**
 * dm-read-state.ts — Drizzle ORM schema for `dm_read_state`.
 *
 * Tracks the last-read position for each participant in a DM or GROUP_DM
 * channel. Used to implement read receipts (double-checkmark UX).
 *
 * One row per (channelId, userId) pair. Upserted on the read endpoint;
 * never deleted independently (cascades when the channel or user is removed).
 */

import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

export const dmReadState = pgTable(
  'dm_read_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** The DM or GROUP_DM channel this read state belongs to. */
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),

    /** The user whose read position this row tracks. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Timestamp when this user last read the channel. */
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),

    /** ID of the last message the user has read. Null until the first read. */
    lastReadMessageId: uuid('last_read_message_id'),
  },
  (table) => [
    unique('dm_read_state_channel_user_key').on(table.channelId, table.userId),
  ],
);

export type DmReadState = typeof dmReadState.$inferSelect;
export type NewDmReadState = typeof dmReadState.$inferInsert;
