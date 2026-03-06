/**
 * schema/stage.ts — Drizzle ORM schemas for stage channel tables.
 *
 * Two tables:
 *   stage_sessions  — One active (or past) session per stage channel.
 *   stage_speakers  — Which users have been granted speaker status in a session.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

// ---------------------------------------------------------------------------
// stage_sessions
// ---------------------------------------------------------------------------

export const stageSessions = pgTable('stage_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),

  /** The GUILD_STAGE channel this session belongs to. */
  channelId: uuid('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),

  /** The user who started (and hosts) this stage session. */
  hostId: uuid('host_id').references(() => users.id, { onDelete: 'set null' }),

  /** Optional topic displayed in the stage header. */
  topic: text('topic'),

  /** When the stage session was started. */
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),

  /** When the stage session was ended. Null = still active. */
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export type StageSession = typeof stageSessions.$inferSelect;
export type NewStageSession = typeof stageSessions.$inferInsert;

// ---------------------------------------------------------------------------
// stage_speakers
// ---------------------------------------------------------------------------

export const stageSpeakers = pgTable(
  'stage_speakers',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** The stage session this speaker record belongs to. */
    sessionId: uuid('session_id')
      .notNull()
      .references(() => stageSessions.id, { onDelete: 'cascade' }),

    /** The user who has been granted speaker status. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Who invited this user to speak (null = host themselves). */
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),

    /** When the speaker joined the stage. */
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('stage_speakers_session_user_key').on(table.sessionId, table.userId),
  ],
);

export type StageSpeaker = typeof stageSpeakers.$inferSelect;
export type NewStageSpeaker = typeof stageSpeakers.$inferInsert;
