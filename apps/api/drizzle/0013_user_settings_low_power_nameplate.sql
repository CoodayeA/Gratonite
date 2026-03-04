-- Add low_power column to user_settings
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "low_power" boolean NOT NULL DEFAULT false;

-- Add nameplate_style column to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nameplate_style" text DEFAULT 'none';
