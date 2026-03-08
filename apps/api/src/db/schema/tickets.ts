import { pgTable, uuid, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { channels } from './channels';
import { users } from './users';

export const ticketConfig = pgTable('ticket_config', {
  guildId: uuid('guild_id').primaryKey().references(() => guilds.id, { onDelete: 'cascade' }),
  categoryChannelId: uuid('category_channel_id'),
  supportRoleId: uuid('support_role_id'),
  autoCloseHours: integer('auto_close_hours').default(48),
  greeting: text('greeting').default('A staff member will be with you shortly.'),
});

export type TicketConfig = typeof ticketConfig.$inferSelect;
export type NewTicketConfig = typeof ticketConfig.$inferInsert;

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'set null' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('open'),
  subject: text('subject').notNull(),
  priority: text('priority').notNull().default('medium'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  transcript: jsonb('transcript'),
});

export type Ticket = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
