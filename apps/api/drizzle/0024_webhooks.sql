CREATE TABLE IF NOT EXISTS "webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE cascade,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE cascade,
  "creator_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "name" varchar(80) NOT NULL,
  "avatar_url" text,
  "token" uuid NOT NULL DEFAULT gen_random_uuid(),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
