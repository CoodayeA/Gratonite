ALTER TABLE guilds ADD COLUMN afk_channel_id UUID REFERENCES channels(id);
ALTER TABLE guilds ADD COLUMN afk_timeout INTEGER DEFAULT 300;
