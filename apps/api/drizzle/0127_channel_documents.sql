-- Shared notes/documents pinned to channels
CREATE TABLE IF NOT EXISTS "channel_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE CASCADE,
  "title" varchar(200) NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "last_editor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "channel_documents_channel_updated_idx" ON "channel_documents" ("channel_id", "updated_at" DESC);
