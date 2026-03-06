CREATE TABLE IF NOT EXISTS "channel_read_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE cascade,
  "last_read_message_id" uuid,
  "last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
  "mention_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "channel_read_state_channel_user_key" UNIQUE("channel_id","user_id")
);
