-- Emoji categories for organizing custom server emojis
CREATE TABLE IF NOT EXISTS "emoji_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "name" varchar(32) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "emoji_categories_guild_id_idx" ON "emoji_categories"("guild_id");

-- Add category_id column to guild_emojis
ALTER TABLE "guild_emojis" ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "emoji_categories"("id") ON DELETE SET NULL;
