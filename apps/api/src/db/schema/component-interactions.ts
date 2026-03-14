/**
 * component-interactions.ts — Audit table for message component interactions.
 */

import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { messages } from './messages';
import { users } from './users';
import { botApplications } from './bot-applications';

export const componentInteractions = pgTable('component_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  customId: text('custom_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  botApplicationId: uuid('bot_application_id').notNull().references(() => botApplications.id, { onDelete: 'cascade' }),
  interactionType: text('interaction_type').notNull().default('button'),
  values: jsonb('values').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ComponentInteraction = typeof componentInteractions.$inferSelect;
export type NewComponentInteraction = typeof componentInteractions.$inferInsert;
