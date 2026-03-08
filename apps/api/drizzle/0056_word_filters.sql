CREATE TABLE IF NOT EXISTS guild_word_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  words text[] NOT NULL DEFAULT '{}',
  action text NOT NULL DEFAULT 'block',
  exempt_roles uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guild_id)
);
