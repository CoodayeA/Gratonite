import { pgTable, uuid, varchar, text, jsonb, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * admin_team_invites — Pending invitations for platform team access.
 */
export const adminTeamInvites = pgTable('admin_team_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('support'),
  token: varchar('token', { length: 128 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  invitedUserId: uuid('invited_user_id').references(() => users.id, { onDelete: 'set null' }),
  acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * admin_audit_log — Global audit trail for platform-level admin actions.
 */
export const adminAuditLog = pgTable('admin_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 80 }).notNull(),
  targetType: varchar('target_type', { length: 40 }),
  targetId: varchar('target_id', { length: 255 }),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * admin_user_scopes — Scope-based admin authorizations.
 *
 * Each row grants one explicit admin scope to a user. Platform access checks
 * should use this table together with `users.isAdmin` for backward
 * compatibility and governance hardening.
 */
export const adminUserScopes = pgTable(
  'admin_user_scopes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    scope: varchar('scope', { length: 80 }).notNull(),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userScopeUnique: uniqueIndex('admin_user_scopes_user_scope_unique').on(table.userId, table.scope),
    userIdIdx: index('admin_user_scopes_user_id_idx').on(table.userId),
    scopeIdx: index('admin_user_scopes_scope_idx').on(table.scope),
  }),
);

export type AdminTeamInvite = typeof adminTeamInvites.$inferSelect;
export type NewAdminTeamInvite = typeof adminTeamInvites.$inferInsert;
export type AdminAuditLogEntry = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLogEntry = typeof adminAuditLog.$inferInsert;
export type AdminUserScope = typeof adminUserScopes.$inferSelect;
export type NewAdminUserScope = typeof adminUserScopes.$inferInsert;
