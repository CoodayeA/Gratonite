import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userVoiceSettings = pgTable('user_voice_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  activeEffect: text('active_effect'),
  effectVolume: integer('effect_volume').notNull().default(100),
});

export type UserVoiceSettings = typeof userVoiceSettings.$inferSelect;
export type NewUserVoiceSettings = typeof userVoiceSettings.$inferInsert;
