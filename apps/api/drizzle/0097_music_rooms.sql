CREATE TABLE music_room_settings (
  channel_id UUID PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'freeQueue',
  current_dj_id UUID REFERENCES users(id) ON DELETE SET NULL,
  volume INTEGER NOT NULL DEFAULT 80
);

CREATE TABLE music_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  played_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_music_queue_channel ON music_queue(channel_id, position);
