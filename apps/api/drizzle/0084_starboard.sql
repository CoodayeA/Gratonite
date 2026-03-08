CREATE TABLE IF NOT EXISTS "starboard_config" (
  "guild_id" uuid PRIMARY KEY REFERENCES "guilds"("id") ON DELETE CASCADE,
  "target_channel_id" uuid REFERENCES "channels"("id") ON DELETE SET NULL,
  "emoji" text NOT NULL DEFAULT '⭐',
  "threshold" integer NOT NULL DEFAULT 5,
  "enabled" boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "starboard_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "original_message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "starboard_message_id" uuid REFERENCES "messages"("id") ON DELETE SET NULL,
  "star_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "starboard_entries_original_msg_idx" ON "starboard_entries" ("original_message_id");
