import { pgTable, uuid, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const greetingCardTemplates = pgTable('greeting_card_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  bgColor: text('bg_color').notNull(),
  bgImage: text('bg_image'),
  fontFamily: text('font_family').notNull().default('serif'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const greetingCards = pgTable('greeting_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').notNull().references(() => greetingCardTemplates.id),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  stickers: jsonb('stickers').notNull().default([]),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
});

export type GreetingCardTemplate = typeof greetingCardTemplates.$inferSelect;
export type GreetingCard = typeof greetingCards.$inferSelect;
export type NewGreetingCard = typeof greetingCards.$inferInsert;
