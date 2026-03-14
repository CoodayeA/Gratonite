-- Migration 0139: Bot guild permissions table
-- Tracks what permissions each bot has in each guild.
-- Default permissions granted on install: SEND_MESSAGES | VIEW_CHANNEL (384).

CREATE TABLE IF NOT EXISTS "bot_guild_permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bot_application_id" uuid NOT NULL REFERENCES "bot_applications"("id") ON DELETE CASCADE,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "permissions" bigint NOT NULL DEFAULT 384,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "bot_guild_permissions_bot_guild_key" UNIQUE ("bot_application_id", "guild_id")
);
