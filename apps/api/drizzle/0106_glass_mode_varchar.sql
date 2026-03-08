-- Convert glass_mode from boolean to varchar(10) enum: 'off' | 'subtle' | 'full'
ALTER TABLE user_settings
  ALTER COLUMN glass_mode TYPE varchar(10)
  USING CASE WHEN glass_mode THEN 'full' ELSE 'off' END;

ALTER TABLE user_settings
  ALTER COLUMN glass_mode SET DEFAULT 'full';
