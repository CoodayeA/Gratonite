-- Phase 6: Theme enhancements (Items 78, 82, 85)
-- Adds version and report_count to themes table
-- Adds custom_theme_id and theme_preferences to user_settings

ALTER TABLE "themes" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
ALTER TABLE "themes" ADD COLUMN IF NOT EXISTS "report_count" integer NOT NULL DEFAULT 0;

ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "custom_theme_id" uuid;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "theme_preferences" jsonb;
