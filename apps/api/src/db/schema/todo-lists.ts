import { pgTable, uuid, varchar, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const todoLists = pgTable('todo_lists', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const todoItems = pgTable('todo_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  listId: uuid('list_id').notNull().references(() => todoLists.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  completed: boolean('completed').notNull().default(false),
  assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
  position: integer('position').notNull().default(0),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TodoList = typeof todoLists.$inferSelect;
export type TodoItem = typeof todoItems.$inferSelect;
