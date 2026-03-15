-- Migration: 0144_relay_network
-- Adds relay node directory, active connections, and cached instance keys
-- for the federation relay network.

CREATE TABLE IF NOT EXISTS relay_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  websocket_url VARCHAR(500) NOT NULL,
  public_key_pem TEXT,
  reputation_score INTEGER NOT NULL DEFAULT 50,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  connected_instances INTEGER NOT NULL DEFAULT 0,
  uptime_percent INTEGER NOT NULL DEFAULT 100,
  latency_ms INTEGER NOT NULL DEFAULT 500,
  mesh_peers INTEGER NOT NULL DEFAULT 0,
  turn_supported BOOLEAN NOT NULL DEFAULT false,
  software_version VARCHAR(50),
  last_health_check TIMESTAMPTZ,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relay_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_node_id UUID NOT NULL REFERENCES relay_nodes(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'connected',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relay_instance_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_domain VARCHAR(255) NOT NULL UNIQUE,
  public_key_pem TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_relay_nodes_status ON relay_nodes(status);
CREATE INDEX IF NOT EXISTS idx_relay_nodes_reputation ON relay_nodes(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_relay_connections_relay ON relay_connections(relay_node_id);
