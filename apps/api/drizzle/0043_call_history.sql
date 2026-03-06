CREATE TABLE call_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  initiated_by uuid NOT NULL REFERENCES users(id),
  participants text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  missed bool NOT NULL DEFAULT false
);
