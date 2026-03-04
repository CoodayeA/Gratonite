import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

/**
 * audit_log — Tracks moderation and administrative actions within a guild.
 */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 50 }).notNull(),
  targetId: uuid('target_id'),
  targetType: varchar('target_type', { length: 30 }),
  changes: jsonb('changes'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
