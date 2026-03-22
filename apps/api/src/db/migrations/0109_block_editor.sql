-- Block editor: add block-based content to collaborative documents
ALTER TABLE collaborative_documents ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]';
ALTER TABLE collaborative_documents ADD COLUMN IF NOT EXISTS blocks_schema_version integer NOT NULL DEFAULT 1;
ALTER TABLE collaborative_documents ADD COLUMN IF NOT EXISTS cover_image text;
ALTER TABLE collaborative_documents ADD COLUMN IF NOT EXISTS icon varchar(50);
ALTER TABLE collaborative_documents ADD COLUMN IF NOT EXISTS content_migrated boolean NOT NULL DEFAULT false;

-- Document templates
CREATE TABLE IF NOT EXISTS document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description text,
  icon varchar(50),
  blocks jsonb NOT NULL DEFAULT '[]',
  is_builtin boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_templates_guild_id_idx ON document_templates(guild_id);
