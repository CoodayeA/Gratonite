ALTER TABLE guilds ADD COLUMN IF NOT EXISTS raid_protection_enabled bool NOT NULL DEFAULT false;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS locked_at timestamptz;
