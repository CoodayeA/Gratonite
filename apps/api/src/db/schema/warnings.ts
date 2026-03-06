import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

/**
 * member_warnings — Tracks moderation warnings issued to guild members.
 */
export const memberWarnings = pgTable('member_warnings', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  moderatorId: uuid('moderator_id').notNull().references(() => users.id),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('member_warnings_guild_user_idx').on(table.guildId, table.userId),
]);

export type MemberWarning = typeof memberWarnings.$inferSelect;
export type NewMemberWarning = typeof memberWarnings.$inferInsert;
