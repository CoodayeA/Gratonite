-- Feature 10: Google Calendar Sync — calendar_integrations table
CREATE TABLE IF NOT EXISTS "calendar_integrations" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "guild_id" uuid REFERENCES "guilds"("id") ON DELETE CASCADE,
  "provider" varchar(20) NOT NULL DEFAULT 'google',
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expires_at" timestamp with time zone NOT NULL,
  "calendar_id" varchar(200) NOT NULL DEFAULT 'primary',
  "sync_enabled" boolean NOT NULL DEFAULT true,
  "last_sync_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE("user_id", "guild_id", "provider")
);

CREATE INDEX IF NOT EXISTS "calendar_integrations_user_idx" ON "calendar_integrations" ("user_id");

-- Feature 22: Inline Message Translation — message_translations cache table
CREATE TABLE IF NOT EXISTS "message_translations" (
  "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "target_lang" varchar(5) NOT NULL,
  "translated_content" text NOT NULL,
  "source_lang" varchar(5),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE("message_id", "target_lang")
);

CREATE INDEX IF NOT EXISTS "message_translations_message_idx" ON "message_translations" ("message_id");
