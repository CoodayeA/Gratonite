CREATE TABLE IF NOT EXISTS status_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL,
  custom_text text,
  emoji text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS status_presets_user_idx ON status_presets(user_id);
