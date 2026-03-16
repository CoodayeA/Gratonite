import { pgTable, uuid, varchar, real, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';

export const notificationSounds = pgTable('notification_sounds', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  fileHash: varchar('file_hash', { length: 255 }).notNull(),
  duration: real('duration'),
  isBuiltIn: boolean('is_built_in').notNull().default(false),
  uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  guildId: uuid('guild_id').references(() => guilds.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationSoundPrefs = pgTable('notification_sound_prefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').references(() => guilds.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 30 }).notNull(),
  soundId: uuid('sound_id').references(() => notificationSounds.id, { onDelete: 'set null' }),
}, (table) => [
  unique().on(table.userId, table.guildId, table.eventType),
]);

export type NotificationSound = typeof notificationSounds.$inferSelect;
export type NewNotificationSound = typeof notificationSounds.$inferInsert;
export type NotificationSoundPref = typeof notificationSoundPrefs.$inferSelect;
export type NewNotificationSoundPref = typeof notificationSoundPrefs.$inferInsert;
