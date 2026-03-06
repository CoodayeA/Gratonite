CREATE TABLE automod_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name text NOT NULL,
  enabled bool NOT NULL DEFAULT true,
  trigger_type text NOT NULL,
  trigger_metadata jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '[]',
  exempt_roles text[] NOT NULL DEFAULT '{}',
  exempt_channels text[] NOT NULL DEFAULT '{}'
);
