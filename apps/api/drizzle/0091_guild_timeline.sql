CREATE TABLE guild_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reference_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_guild_timeline_guild ON guild_timeline_events(guild_id, created_at DESC);
