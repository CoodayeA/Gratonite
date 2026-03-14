-- Migration 0137: Add subscribed_events JSONB column to bot_applications
-- Allows bots to subscribe to specific event types instead of receiving all events.
-- Default: ['message_create'] (backward-compatible with existing bots).

ALTER TABLE "bot_applications"
ADD COLUMN IF NOT EXISTS "subscribed_events" jsonb DEFAULT '["message_create"]'::jsonb;
