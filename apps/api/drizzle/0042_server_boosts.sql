CREATE TABLE server_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  active bool NOT NULL DEFAULT true
);
ALTER TABLE guilds ADD COLUMN boost_count int NOT NULL DEFAULT 0;
ALTER TABLE guilds ADD COLUMN boost_tier int NOT NULL DEFAULT 0;
