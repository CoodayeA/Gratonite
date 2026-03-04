/**
 * polls.ts — Drizzle ORM schemas for polls, options, and votes.
 *
 * Tables:
 *   1. `polls`        — A poll question attached to a channel.
 *   2. `poll_options`  — Individual answer options within a poll.
 *   3. `poll_votes`    — Records which user voted for which option.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

// ---------------------------------------------------------------------------
// polls
// ---------------------------------------------------------------------------

export const polls = pgTable('polls', {
  id: uuid('id').primaryKey().defaultRandom(),

  channelId: uuid('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),

  question: text('question').notNull(),

  multipleChoice: boolean('multiple_choice').notNull().default(false),

  expiresAt: timestamp('expires_at', { withTimezone: true }),

  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Poll = typeof polls.$inferSelect;
export type NewPoll = typeof polls.$inferInsert;

// ---------------------------------------------------------------------------
// poll_options
// ---------------------------------------------------------------------------

export const pollOptions = pgTable('poll_options', {
  id: uuid('id').primaryKey().defaultRandom(),

  pollId: uuid('poll_id')
    .notNull()
    .references(() => polls.id, { onDelete: 'cascade' }),

  text: varchar('text', { length: 255 }).notNull(),

  position: integer('position').notNull().default(0),
});

export type PollOption = typeof pollOptions.$inferSelect;
export type NewPollOption = typeof pollOptions.$inferInsert;

// ---------------------------------------------------------------------------
// poll_votes
// ---------------------------------------------------------------------------

export const pollVotes = pgTable(
  'poll_votes',
  {
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),

    optionId: uuid('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // For multiple-choice polls: one vote per (poll, option, user).
    // For single-choice polls: application logic enforces one vote per (poll, user).
    unique('poll_votes_poll_option_user_key').on(table.pollId, table.optionId, table.userId),
  ],
);

export type PollVote = typeof pollVotes.$inferSelect;
