CREATE TABLE clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  guild_id UUID NOT NULL REFERENCES guilds(id),
  channel_id UUID REFERENCES channels(id),
  title VARCHAR(200) NOT NULL,
  file_id UUID REFERENCES files(id),
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_clips_guild ON clips(guild_id);
CREATE INDEX idx_clips_user ON clips(user_id);
