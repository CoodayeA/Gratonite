CREATE TABLE application_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id text NOT NULL,
  guild_id uuid,
  name text NOT NULL,
  description text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  type int NOT NULL DEFAULT 1,
  UNIQUE (application_id, guild_id, name, type)
);
