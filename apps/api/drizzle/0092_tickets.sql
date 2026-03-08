-- 0092_tickets.sql — Ticket system tables

CREATE TABLE IF NOT EXISTS ticket_config (
  guild_id UUID PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
  category_channel_id UUID,
  support_role_id UUID,
  auto_close_hours INTEGER DEFAULT 48,
  greeting TEXT DEFAULT 'A staff member will be with you shortly.'
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  subject TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  transcript JSONB
);

CREATE INDEX idx_tickets_guild_status ON tickets(guild_id, status);
