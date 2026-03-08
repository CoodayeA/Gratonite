CREATE TABLE IF NOT EXISTS "reaction_role_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "guild_id" uuid NOT NULL REFERENCES "guilds"("id") ON DELETE CASCADE,
  "mode" text NOT NULL DEFAULT 'multi',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "reaction_role_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reaction_role_message_id" uuid NOT NULL REFERENCES "reaction_role_messages"("id") ON DELETE CASCADE,
  "emoji" text NOT NULL,
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
