CREATE TABLE guild_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text,
  color text,
  position int NOT NULL DEFAULT 0,
  guild_ids text[] NOT NULL DEFAULT '{}'
);
