ALTER TABLE guilds ADD COLUMN IF NOT EXISTS rules_text text;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS require_rules_agreement bool NOT NULL DEFAULT false;
ALTER TABLE guild_members ADD COLUMN IF NOT EXISTS agreed_rules_at timestamptz;
