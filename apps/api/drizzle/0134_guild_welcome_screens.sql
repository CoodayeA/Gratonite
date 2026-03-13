-- Guild welcome screens for new member onboarding
CREATE TABLE IF NOT EXISTS "guild_welcome_screens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "guild_id" uuid NOT NULL UNIQUE REFERENCES "guilds"("id") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "description" text,
  "blocks" jsonb NOT NULL DEFAULT '[]',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
