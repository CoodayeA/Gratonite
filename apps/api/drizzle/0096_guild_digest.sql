-- 0096_guild_digest.sql — Guild weekly digest/newspaper

CREATE TABLE IF NOT EXISTS guild_digest_config (
  guild_id UUID PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  target_channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  sections JSONB NOT NULL DEFAULT '["top_messages","new_members","message_count","active_channels","active_members"]',
  day_of_week INTEGER NOT NULL DEFAULT 1,
  last_sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS guild_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  week_start TIMESTAMPTZ NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guild_digests_guild ON guild_digests(guild_id, created_at DESC);
