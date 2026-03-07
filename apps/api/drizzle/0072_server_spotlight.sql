ALTER TABLE guilds ADD COLUMN IF NOT EXISTS spotlight_channel_id uuid REFERENCES channels(id) ON DELETE SET NULL;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS spotlight_message text;
