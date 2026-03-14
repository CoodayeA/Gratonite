-- Migration 0138: Add bot_user_id to bot_applications, is_bot to users
-- Bots now have virtual user accounts so they appear in member lists and
-- their messages have proper author attribution.

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "is_bot" boolean NOT NULL DEFAULT false;

ALTER TABLE "bot_applications"
ADD COLUMN IF NOT EXISTS "bot_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
