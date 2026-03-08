-- 0095_guild_log_config.sql — Server activity log configuration

CREATE TABLE IF NOT EXISTS guild_log_config (
  guild_id UUID PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  events JSONB NOT NULL DEFAULT '["member_join","member_leave","ban","unban","role_change","channel_create","channel_delete","message_delete"]'
);
