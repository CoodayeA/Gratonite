-- User devices for login alert tracking
CREATE TABLE IF NOT EXISTS "user_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ip" varchar(45) NOT NULL,
  "user_agent_hash" varchar(64) NOT NULL,
  "device_label" varchar(255) NOT NULL DEFAULT 'Unknown Device',
  "first_seen_at" timestamptz NOT NULL DEFAULT now(),
  "last_seen_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_devices_user_id_idx" ON "user_devices"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_user_ip_ua_idx" ON "user_devices"("user_id", "ip", "user_agent_hash");
