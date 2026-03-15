CREATE INDEX IF NOT EXISTS bot_installs_guild_id_idx ON bot_installs (guild_id);
CREATE INDEX IF NOT EXISTS bot_guild_permissions_app_guild_idx ON bot_guild_permissions (bot_application_id, guild_id);
