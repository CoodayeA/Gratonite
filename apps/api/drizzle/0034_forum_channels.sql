ALTER TABLE channels ADD COLUMN forum_tags jsonb;
ALTER TABLE threads ADD COLUMN forum_tag_ids text[];
ALTER TABLE threads ADD COLUMN pinned bool NOT NULL DEFAULT false;
ALTER TABLE threads ADD COLUMN message_count int NOT NULL DEFAULT 0;
