-- Auto-archive inactive channels
ALTER TABLE channels ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS auto_archive_days integer;
