CREATE TABLE IF NOT EXISTS "sticky_messages" (
  "channel_id" uuid PRIMARY KEY REFERENCES "channels"("id") ON DELETE CASCADE,
  "message_id" uuid REFERENCES "messages"("id") ON DELETE SET NULL,
  "content" text NOT NULL,
  "set_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "set_at" timestamp with time zone NOT NULL DEFAULT now()
);
