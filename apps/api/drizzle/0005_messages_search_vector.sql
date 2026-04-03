-- Full-text search: generated tsvector + GIN index for GET /search/messages.
-- The route matches on "messages"."search_vector" @@ plainto_tsquery(...).

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("content", ''))) STORED;

CREATE INDEX IF NOT EXISTS "messages_search_vector_gin_idx" ON "messages" USING GIN ("search_vector");
