ALTER TABLE guild_bans ADD COLUMN IF NOT EXISTS appeal_status text;
ALTER TABLE guild_bans ADD COLUMN IF NOT EXISTS appeal_text text;
ALTER TABLE guild_bans ADD COLUMN IF NOT EXISTS appeal_submitted_at timestamptz;
ALTER TABLE guild_bans ADD COLUMN IF NOT EXISTS appeal_reviewed_by text REFERENCES users(id);
ALTER TABLE guild_bans ADD COLUMN IF NOT EXISTS appeal_reviewed_at timestamptz;
