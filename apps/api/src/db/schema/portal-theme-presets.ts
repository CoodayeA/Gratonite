/**
 * portal-theme-presets.ts — Drizzle schema for named Portal theme presets.
 *
 * Each guild can save multiple named theme configurations that members or
 * the owner can quickly apply. Owner-managed.
 */

import { pgTable, uuid, varchar, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const portalThemePresets = pgTable(
  'portal_theme_presets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    theme: jsonb('theme').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('portal_theme_presets_guild_id_name_key').on(table.guildId, table.name)],
);

export type PortalThemePreset = typeof portalThemePresets.$inferSelect;
export type NewPortalThemePreset = typeof portalThemePresets.$inferInsert;
