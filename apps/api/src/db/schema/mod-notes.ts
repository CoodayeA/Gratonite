import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';

export const modNotes = pgTable('mod_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('mod_notes_guild_target_author_key').on(t.guildId, t.targetId, t.authorId),
]);

export type ModNote = typeof modNotes.$inferSelect;
export type NewModNote = typeof modNotes.$inferInsert;
