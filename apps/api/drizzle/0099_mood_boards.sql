CREATE TABLE mood_board_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  content TEXT NOT NULL,
  position JSONB NOT NULL DEFAULT '{"x":0,"y":0,"w":200,"h":200}',
  added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mood_board_items_channel ON mood_board_items(channel_id);
