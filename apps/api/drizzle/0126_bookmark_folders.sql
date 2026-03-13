-- Bookmark folders for organizing saved messages
CREATE TABLE IF NOT EXISTS "bookmark_folders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(64) NOT NULL,
  "color" varchar(7) NOT NULL DEFAULT '#6366f1',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "bookmark_folders_user_id_created_at_idx" ON "bookmark_folders" ("user_id", "created_at");

-- Add folder_id column to message_bookmarks
ALTER TABLE "message_bookmarks" ADD COLUMN IF NOT EXISTS "folder_id" uuid REFERENCES "bookmark_folders"("id") ON DELETE SET NULL;
