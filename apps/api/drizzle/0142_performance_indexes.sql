-- Phase 9, Item 154: Database query optimization — add missing indexes
-- These indexes target the most common query patterns to reduce sequential scans.

-- Messages: frequently queried by channel + creation time (pagination)
CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON messages (channel_id, created_at DESC);

-- Messages: lookup by author (user profile, moderation)
CREATE INDEX IF NOT EXISTS idx_messages_author
  ON messages (author_id, created_at DESC);

-- Guild members: frequently joined with users table
CREATE INDEX IF NOT EXISTS idx_guild_members_user
  ON guild_members (user_id);

-- Guild members: lookup by guild (member list, counts)
CREATE INDEX IF NOT EXISTS idx_guild_members_guild
  ON guild_members (guild_id);

-- Channels: lookup by guild (channel list sidebar)
CREATE INDEX IF NOT EXISTS idx_channels_guild
  ON channels (guild_id, position);

-- Reactions: lookup by message (reaction counts per message)
CREATE INDEX IF NOT EXISTS idx_reactions_message
  ON reactions (message_id);

-- Notifications: per-user unread feed
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- Notifications: unread count
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read) WHERE read = false;

-- Read states: per-user channel lookup
CREATE INDEX IF NOT EXISTS idx_read_states_user_channel
  ON read_states (user_id, channel_id);

-- Invites: lookup by code (join flow)
CREATE INDEX IF NOT EXISTS idx_invites_code
  ON invites (code);

-- Invites: lookup by guild (guild settings)
CREATE INDEX IF NOT EXISTS idx_invites_guild
  ON invites (guild_id);

-- Relationships (friends): lookup by user
CREATE INDEX IF NOT EXISTS idx_relationships_user
  ON relationships (user_id, status);

CREATE INDEX IF NOT EXISTS idx_relationships_target
  ON relationships (target_id, status);

-- Audit log: per-guild lookups
CREATE INDEX IF NOT EXISTS idx_audit_log_guild
  ON audit_log (guild_id, created_at DESC);

-- Bans: per-guild lookup
CREATE INDEX IF NOT EXISTS idx_guild_bans_guild
  ON guild_bans (guild_id);

-- Message bookmarks: per-user
CREATE INDEX IF NOT EXISTS idx_message_bookmarks_user
  ON message_bookmarks (user_id, created_at DESC);

-- Threads: parent channel lookup
CREATE INDEX IF NOT EXISTS idx_threads_channel
  ON threads (channel_id) WHERE archived = false;

-- Pins: per-channel lookup
CREATE INDEX IF NOT EXISTS idx_pins_channel
  ON pins (channel_id);

-- Attachments: per-message lookup
CREATE INDEX IF NOT EXISTS idx_attachments_message
  ON attachments (message_id);

-- User settings: one-to-one with users
CREATE INDEX IF NOT EXISTS idx_user_settings_user
  ON user_settings (user_id);

-- Role assignments: per-member lookup for permission checks
CREATE INDEX IF NOT EXISTS idx_guild_member_roles_member
  ON guild_member_roles (guild_member_id);

-- Scheduled messages: job picks up unsent messages by scheduled time
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending
  ON scheduled_messages (scheduled_at) WHERE sent_at IS NULL;

-- Stickers: per-guild lookup
CREATE INDEX IF NOT EXISTS idx_stickers_guild
  ON stickers (guild_id);

-- Starboard: per-guild, ordered by star count for leaderboard
CREATE INDEX IF NOT EXISTS idx_starboard_guild
  ON starboard_entries (guild_id, star_count DESC);

-- Push subscriptions: per-user for notification dispatch
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id);
