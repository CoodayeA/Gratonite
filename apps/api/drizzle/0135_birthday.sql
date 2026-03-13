-- Add birthday column to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS birthday jsonb;
