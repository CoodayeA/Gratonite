CREATE TABLE user_voice_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active_effect TEXT,
  effect_volume INTEGER NOT NULL DEFAULT 100
);
