import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';
import { channels } from './channels';

export const guildForms = pgTable('guild_forms', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  fields: jsonb('fields').notNull().default([]),
  responseChannelId: uuid('response_channel_id').references(() => channels.id, { onDelete: 'set null' }),
  roleOnApproval: uuid('role_on_approval'),
  status: text('status').notNull().default('open'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const guildFormResponses = pgTable('guild_form_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  formId: uuid('form_id').notNull().references(() => guildForms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').notNull().default({}),
  status: text('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildForm = typeof guildForms.$inferSelect;
export type NewGuildForm = typeof guildForms.$inferInsert;
export type GuildFormResponse = typeof guildFormResponses.$inferSelect;
export type NewGuildFormResponse = typeof guildFormResponses.$inferInsert;
