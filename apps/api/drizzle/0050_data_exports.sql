CREATE TABLE data_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  download_url text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
