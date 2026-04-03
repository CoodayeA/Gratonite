-- Default notification level applied to new members' Redis prefs (notif:guild:<id>) when unset.
ALTER TABLE guilds
  ADD COLUMN IF NOT EXISTS default_member_notification_level varchar(20);

ALTER TABLE guilds
  DROP CONSTRAINT IF EXISTS guilds_default_member_notification_level_chk;

ALTER TABLE guilds
  ADD CONSTRAINT guilds_default_member_notification_level_chk
  CHECK (
    default_member_notification_level IS NULL
    OR default_member_notification_level IN ('all', 'mentions', 'nothing')
  );
