-- Phase D: E2E encryption toggle per channel
ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN NOT NULL DEFAULT false;

-- Phase E: File attachments toggle per channel
ALTER TABLE channels ADD COLUMN IF NOT EXISTS attachments_enabled BOOLEAN NOT NULL DEFAULT true;

-- Phase F: Permission sync with parent category
ALTER TABLE channels ADD COLUMN IF NOT EXISTS permission_synced BOOLEAN NOT NULL DEFAULT true;
