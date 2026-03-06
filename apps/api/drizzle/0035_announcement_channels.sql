ALTER TABLE channels ADD COLUMN is_announcement bool NOT NULL DEFAULT false;
CREATE TABLE channel_followers (
  source_channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  target_channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  PRIMARY KEY (source_channel_id, target_channel_id)
);
