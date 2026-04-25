-- Portal Theme System
-- Adds owner-default theme on guilds, member override on guild_members,
-- and named presets per guild.

ALTER TABLE "guilds"
  ADD COLUMN IF NOT EXISTS "portal_theme" jsonb;

ALTER TABLE "guild_members"
  ADD COLUMN IF NOT EXISTS "portal_theme_override" jsonb;

CREATE TABLE IF NOT EXISTS "portal_theme_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "name" varchar(80) NOT NULL,
  "theme" jsonb NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "portal_theme_presets_guild_id_name_key" UNIQUE ("guild_id", "name")
);

CREATE INDEX IF NOT EXISTS "portal_theme_presets_guild_id_idx"
  ON "portal_theme_presets" ("guild_id");
