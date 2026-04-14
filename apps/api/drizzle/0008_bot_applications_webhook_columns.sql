-- Add subscribed_events and bot_user_id columns to bot_applications.
-- These columns exist in the schema but were never applied to production
-- because the descriptive-name migration lineage was seeded without execution.
ALTER TABLE "bot_applications"
  ADD COLUMN IF NOT EXISTS "subscribed_events" jsonb DEFAULT '["message_create"]'::jsonb,
  ADD COLUMN IF NOT EXISTS "bot_user_id" uuid;
