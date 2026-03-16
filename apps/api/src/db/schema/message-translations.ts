import { pgTable, uuid, varchar, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { messages } from './messages';

export const messageTranslations = pgTable('message_translations', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  targetLang: varchar('target_lang', { length: 5 }).notNull(),
  translatedContent: text('translated_content').notNull(),
  sourceLang: varchar('source_lang', { length: 5 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.messageId, table.targetLang),
]);

export type MessageTranslation = typeof messageTranslations.$inferSelect;
export type NewMessageTranslation = typeof messageTranslations.$inferInsert;
