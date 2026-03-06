CREATE TABLE IF NOT EXISTS "user_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "author_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "target_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "content" text NOT NULL DEFAULT '',
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_notes_author_target_key" UNIQUE("author_id","target_id")
);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "badges" text[] DEFAULT '{}';
