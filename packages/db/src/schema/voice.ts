import {
  pgTable,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  real,
  index,
} from 'drizzle-orm/pg-core';
import { bigintString } from './helpers';
import { users } from './users';
import { guilds } from './guilds';
import { channels } from './channels';

// ============================================================================
// Voice States — who is in which voice channel
// ============================================================================

// userId is PK because a user can only be in one voice channel at a time.
// Joining a new channel upserts the row; leaving deletes it.
export const voiceStates = pgTable(
  'voice_states',
  {
    userId: bigintString('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    channelId: bigintString('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    guildId: bigintString('guild_id').references(() => guilds.id, {
      onDelete: 'cascade',
    }),
    sessionId: varchar('session_id', { length: 255 }).notNull(),
    deaf: boolean('deaf').notNull().default(false),
    mute: boolean('mute').notNull().default(false),
    selfDeaf: boolean('self_deaf').notNull().default(false),
    selfMute: boolean('self_mute').notNull().default(false),
    selfStream: boolean('self_stream').notNull().default(false),
    selfVideo: boolean('self_video').notNull().default(false),
    suppress: boolean('suppress').notNull().default(false),
    requestToSpeakTimestamp: timestamp('request_to_speak_timestamp', {
      withTimezone: true,
    }),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_voice_states_channel_id').on(table.channelId),
    index('idx_voice_states_guild_id').on(table.guildId),
  ],
);

// ============================================================================
// Stage Instances — active stage channel sessions
// ============================================================================

export const stagePrivacyLevelEnum = pgEnum('stage_privacy_level', [
  'public',
  'guild_only',
]);

export const stageInstances = pgTable('stage_instances', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: bigintString('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  topic: varchar('topic', { length: 120 }).notNull(),
  privacyLevel: stagePrivacyLevelEnum('privacy_level')
    .notNull()
    .default('guild_only'),
  scheduledEventId: bigintString('scheduled_event_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ============================================================================
// Soundboard Sounds — custom sounds playable in voice channels
// ============================================================================

export const soundboardSounds = pgTable('soundboard_sounds', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 32 }).notNull(),
  soundHash: varchar('sound_hash', { length: 64 }).notNull(),
  volume: real('volume').notNull().default(1.0),
  emojiId: bigintString('emoji_id'),
  emojiName: varchar('emoji_name', { length: 64 }),
  uploaderId: bigintString('uploader_id')
    .notNull()
    .references(() => users.id),
  available: boolean('available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
