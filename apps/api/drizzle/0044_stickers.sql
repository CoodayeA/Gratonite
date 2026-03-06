CREATE TABLE stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text REFERENCES guilds(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  asset_url text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  creator_id text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON stickers(guild_id);
