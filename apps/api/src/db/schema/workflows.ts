/**
 * workflows.ts — Drizzle ORM schemas for workflow/automation tables.
 *
 * Three tables:
 *   workflows         — top-level workflow records owned by a guild
 *   workflow_triggers — trigger definitions attached to a workflow
 *   workflow_actions  — ordered action steps attached to a workflow
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

// ---------------------------------------------------------------------------
// workflows
// ---------------------------------------------------------------------------

export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// workflow_triggers
// ---------------------------------------------------------------------------

export const workflowTriggers = pgTable('workflow_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id')
    .notNull()
    .references(() => workflows.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  config: jsonb('config').notNull().default({}),
});

// ---------------------------------------------------------------------------
// workflow_actions
// ---------------------------------------------------------------------------

export const workflowActions = pgTable('workflow_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id')
    .notNull()
    .references(() => workflows.id, { onDelete: 'cascade' }),
  // 'order' is a reserved SQL keyword; use the JS name 'orderIndex'
  orderIndex: integer('order').notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  config: jsonb('config').notNull().default({}),
});
