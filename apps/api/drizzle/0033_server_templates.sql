CREATE TABLE guild_templates (
  code text PRIMARY KEY,
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  description text,
  usage_count int NOT NULL DEFAULT 0,
  serialized_guild jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
