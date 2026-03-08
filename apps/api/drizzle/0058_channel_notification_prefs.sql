CREATE TABLE IF NOT EXISTS channel_notification_prefs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'default',
  muted_until timestamptz,
  PRIMARY KEY (user_id, channel_id)
);
