CREATE TABLE guild_member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  display_name VARCHAR(64),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX guild_member_profiles_user_guild_key ON guild_member_profiles(user_id, guild_id);
CREATE INDEX guild_member_profiles_guild_id_idx ON guild_member_profiles(guild_id);
