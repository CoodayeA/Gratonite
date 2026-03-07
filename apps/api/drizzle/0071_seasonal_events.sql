CREATE TABLE IF NOT EXISTS seasonal_events (
  id text PRIMARY KEY,
  name text NOT NULL,
  theme_override text,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  banner_color text,
  emoji text
);

CREATE TABLE IF NOT EXISTS user_event_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES seasonal_events(id),
  points int NOT NULL DEFAULT 0,
  claimed_rewards jsonb NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, event_id)
);
