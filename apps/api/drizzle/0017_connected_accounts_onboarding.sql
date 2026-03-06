CREATE TABLE IF NOT EXISTS "connected_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "provider" varchar(30) NOT NULL,
  "provider_username" varchar(100) NOT NULL,
  "profile_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "connected_accounts_user_provider_key" UNIQUE("user_id", "provider")
);
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "welcome_message" text;
ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "rules_channel_id" uuid REFERENCES "channels"("id") ON DELETE set null;
CREATE TABLE IF NOT EXISTS "guild_member_onboarding" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE cascade,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "completed_at" timestamp with time zone,
  CONSTRAINT "guild_member_onboarding_guild_user_key" UNIQUE("guild_id", "user_id")
);
