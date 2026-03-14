-- Migration 0140: Message components (buttons, select menus) and interaction audit
-- Bots can attach interactive components to messages. User clicks trigger
-- component_interaction events dispatched to the bot's webhook.

ALTER TABLE "messages"
ADD COLUMN IF NOT EXISTS "components" jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS "component_interactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "custom_id" text NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "bot_application_id" uuid NOT NULL REFERENCES "bot_applications"("id") ON DELETE CASCADE,
  "interaction_type" text NOT NULL DEFAULT 'button',
  "values" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
