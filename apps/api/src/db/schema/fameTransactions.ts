import {
  pgTable,
  uuid,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { messages } from './messages';
import { guilds } from './guilds';

export const fameTransactions = pgTable(
  'fame_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    giverId: uuid('giver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    receiverId: uuid('receiver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    messageId: uuid('message_id')
      .references(() => messages.id, { onDelete: 'set null' }),

    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('fame_transactions_receiver_id_idx').on(table.receiverId),
    index('fame_transactions_giver_id_idx').on(table.giverId),
  ],
);

export type FameTransaction = typeof fameTransactions.$inferSelect;
export type NewFameTransaction = typeof fameTransactions.$inferInsert;
