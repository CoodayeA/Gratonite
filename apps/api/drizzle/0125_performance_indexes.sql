-- Performance indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_channel_created ON messages (channel_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guild_members_guild ON guild_members (guild_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guild_members_user ON guild_members (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reactions_message ON reactions (message_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_read_state_user_channel ON channel_read_state (user_id, channel_id);
