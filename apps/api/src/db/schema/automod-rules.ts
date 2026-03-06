import { pgTable, uuid, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';

/**
 * automod_rules — Auto-moderation rules for guilds.
 */
export const automodRules = pgTable('automod_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  triggerType: text('trigger_type').notNull(),
  triggerMetadata: jsonb('trigger_metadata').notNull().default({}),
  actions: jsonb('actions').notNull().default([]),
  exemptRoles: text('exempt_roles').array().notNull().default([]),
  exemptChannels: text('exempt_channels').array().notNull().default([]),
});

export type AutomodRule = typeof automodRules.$inferSelect;
export type NewAutomodRule = typeof automodRules.$inferInsert;
