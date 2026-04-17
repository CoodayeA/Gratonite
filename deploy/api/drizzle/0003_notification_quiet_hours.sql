-- Per-user notification quiet hours (suppress real-time notification delivery + digest email during window).
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "notification_quiet_hours" jsonb;
