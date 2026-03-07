CREATE TABLE IF NOT EXISTS channel_featured_messages (
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  featured_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, message_id)
);
