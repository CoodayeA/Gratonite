ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "category" varchar(30);
CREATE TABLE IF NOT EXISTS "guild_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE cascade,
  "tag" varchar(32) NOT NULL
);
