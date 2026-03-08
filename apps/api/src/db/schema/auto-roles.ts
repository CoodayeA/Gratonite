import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { roles } from './roles';

export const autoRoleRules = pgTable('auto_role_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  triggerType: text('trigger_type').notNull(),
  triggerValue: integer('trigger_value').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AutoRoleRule = typeof autoRoleRules.$inferSelect;
export type NewAutoRoleRule = typeof autoRoleRules.$inferInsert;
