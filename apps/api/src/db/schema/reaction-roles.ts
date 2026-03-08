import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { messages } from './messages';
import { channels } from './channels';
import { guilds } from './guilds';
import { roles } from './roles';

export const reactionRoleMessages = pgTable('reaction_role_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull().default('multi'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reactionRoleMappings = pgTable('reaction_role_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  reactionRoleMessageId: uuid('reaction_role_message_id').notNull().references(() => reactionRoleMessages.id, { onDelete: 'cascade' }),
  emoji: text('emoji').notNull(),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ReactionRoleMessage = typeof reactionRoleMessages.$inferSelect;
export type NewReactionRoleMessage = typeof reactionRoleMessages.$inferInsert;
export type ReactionRoleMapping = typeof reactionRoleMappings.$inferSelect;
export type NewReactionRoleMapping = typeof reactionRoleMappings.$inferInsert;
