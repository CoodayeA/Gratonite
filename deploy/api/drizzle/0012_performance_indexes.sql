-- Performance indexes for frequently-queried fields (Item 90)

-- Messages: speed up channel message loading (ordered by time)
CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON messages (channel_id, created_at DESC);

-- Guild members: speed up member lookups
CREATE INDEX IF NOT EXISTS idx_guild_members_guild_user
  ON guild_members (guild_id, user_id);

-- Reactions: speed up loading reactions per message
CREATE INDEX IF NOT EXISTS idx_reactions_message
  ON reactions (message_id);

-- Channel read state: speed up unread count queries
CREATE INDEX IF NOT EXISTS idx_channel_read_state_user_channel
  ON channel_read_state (user_id, channel_id);

-- Notifications: speed up per-user notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- Message bookmarks: speed up bookmark lookups
CREATE INDEX IF NOT EXISTS idx_message_bookmarks_user
  ON message_bookmarks (user_id);
