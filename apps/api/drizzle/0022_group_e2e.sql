CREATE TABLE IF NOT EXISTS "group_encryption_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "key_data" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
