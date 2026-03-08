CREATE TABLE IF NOT EXISTS "message_reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "guild_id" uuid REFERENCES "guilds"("id") ON DELETE CASCADE,
  "remind_at" timestamp with time zone NOT NULL,
  "note" text,
  "fired" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "message_reminders_due_idx" ON "message_reminders" ("remind_at") WHERE "fired" = false;
