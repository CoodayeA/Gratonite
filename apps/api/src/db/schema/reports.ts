import { pgTable, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * bug_reports — User-submitted bug reports.
 */
export const bugReports = pgTable('bug_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  attachments: jsonb('attachments'),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  pageUrl: varchar('page_url', { length: 500 }),
  viewport: varchar('viewport', { length: 50 }),
  userAgent: varchar('user_agent', { length: 500 }),
  clientTimestamp: varchar('client_timestamp', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BugReport = typeof bugReports.$inferSelect;

/**
 * reports — Content/user reports for moderation.
 */
export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  reporterId: uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull(),
  targetType: varchar('target_type', { length: 20 }).notNull(), // user, message, guild
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Report = typeof reports.$inferSelect;

/**
 * feedback — General user feedback / feature requests.
 */
export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 50 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  body: text('body').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Feedback = typeof feedback.$inferSelect;
