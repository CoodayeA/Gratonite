-- Opt-in email policy: defaults include securityAlerts; existing rows get the key without wiping prefs.
ALTER TABLE "user_settings" ALTER COLUMN "email_notifications" SET DEFAULT '{"mentions":false,"dms":false,"frequency":"never","securityAlerts":false}'::jsonb;

UPDATE "user_settings"
SET "email_notifications" = COALESCE("email_notifications", '{}'::jsonb) || '{"securityAlerts":false}'::jsonb
WHERE NOT ("email_notifications" ? 'securityAlerts');
