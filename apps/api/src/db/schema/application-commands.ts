import { pgTable, uuid, text, integer, jsonb, unique } from 'drizzle-orm/pg-core';

/**
 * application_commands — Registered slash commands for bot applications.
 */
export const applicationCommands = pgTable('application_commands', {
  id: uuid('id').defaultRandom().primaryKey(),
  applicationId: text('application_id').notNull(),
  guildId: uuid('guild_id'),
  name: text('name').notNull(),
  description: text('description').notNull(),
  options: jsonb('options').notNull().default([]),
  type: integer('type').notNull().default(1),
}, (table) => [
  unique('application_commands_app_guild_name_type_key').on(table.applicationId, table.guildId, table.name, table.type),
]);

export type ApplicationCommand = typeof applicationCommands.$inferSelect;
export type NewApplicationCommand = typeof applicationCommands.$inferInsert;
