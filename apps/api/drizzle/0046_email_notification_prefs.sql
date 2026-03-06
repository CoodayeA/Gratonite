ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_notifications jsonb NOT NULL DEFAULT '{"mentions": true, "dms": true}';
