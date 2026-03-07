ALTER TABLE user_settings ALTER COLUMN email_notifications SET DEFAULT '{"mentions": false, "dms": false, "frequency": "never"}'::jsonb;
