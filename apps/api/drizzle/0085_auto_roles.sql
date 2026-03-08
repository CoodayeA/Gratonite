CREATE TABLE IF NOT EXISTS "auto_role_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "trigger_type" text NOT NULL,
  "trigger_value" integer NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
