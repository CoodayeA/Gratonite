-- Migration: Batch 6 — Stage Channels + Voice Text Channels
-- Adds linked_text_channel_id to channels, and creates stage_sessions/stage_speakers tables.

ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "linked_text_channel_id" uuid REFERENCES "channels"("id") ON DELETE set null;

CREATE TABLE IF NOT EXISTS "stage_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE cascade,
  "host_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "topic" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "stage_speakers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "stage_sessions"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "invited_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "stage_speakers_session_user_key" UNIQUE("session_id", "user_id")
);
