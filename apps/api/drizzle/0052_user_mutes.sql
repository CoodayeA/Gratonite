CREATE TABLE user_mutes (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, muted_user_id)
);
