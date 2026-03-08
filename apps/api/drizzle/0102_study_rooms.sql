CREATE TABLE study_room_settings (
  channel_id UUID PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  pomodoro_work INTEGER NOT NULL DEFAULT 25,
  pomodoro_break INTEGER NOT NULL DEFAULT 5,
  ambient_sound TEXT
);

CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration INTEGER NOT NULL DEFAULT 0,
  session_type TEXT NOT NULL DEFAULT 'pomodoro'
);

CREATE INDEX idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX idx_study_sessions_guild ON study_sessions(guild_id);
CREATE INDEX idx_study_sessions_channel ON study_sessions(channel_id);
