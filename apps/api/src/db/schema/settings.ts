import { pgTable, uuid, varchar, boolean, integer, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * user_settings — Stores per-user UI/UX preferences.
 * One row per user. Created on first settings save.
 */
export const userSettings = pgTable('user_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  theme: varchar('theme', { length: 50 }).notNull().default('midnight'),
  colorMode: varchar('color_mode', { length: 20 }).notNull().default('dark'),
  fontFamily: varchar('font_family', { length: 50 }).notNull().default('Inter'),
  fontSize: varchar('font_size', { length: 20 }).notNull().default('medium'),
  glassMode: varchar('glass_mode', { length: 10 }).notNull().default('full'),
  buttonShape: varchar('button_shape', { length: 20 }).notNull().default('rounded'),
  soundMuted: boolean('sound_muted').notNull().default(false),
  soundVolume: integer('sound_volume').notNull().default(50),
  soundPack: varchar('sound_pack', { length: 50 }).notNull().default('default'),
  reducedMotion: boolean('reduced_motion').notNull().default(false),
  lowPower: boolean('low_power').notNull().default(false),
  highContrast: boolean('high_contrast').notNull().default(false),
  compactMode: boolean('compact_mode').notNull().default(false),
  accentColor: varchar('accent_color', { length: 20 }),
  screenReaderMode: boolean('screen_reader_mode').notNull().default(false),
  linkUnderlines: boolean('link_underlines').notNull().default(false),
  focusIndicatorSize: varchar('focus_indicator_size', { length: 20 }).notNull().default('normal'),
  colorBlindMode: varchar('color_blind_mode', { length: 20 }).notNull().default('none'),
  customThemeId: uuid('custom_theme_id'),
  themePreferences: jsonb('theme_preferences'),
  birthday: jsonb('birthday'),
  emailNotifications: jsonb('email_notifications').notNull().default({
    mentions: false,
    dms: false,
    frequency: 'never',
    securityAlerts: false,
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

/**
 * user_sessions — Tracks active refresh token sessions with device info.
 */
export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  deviceName: varchar('device_name', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;
