-- GIN trigram index for fast ILIKE message search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_content_trgm ON messages USING GIN (content gin_trgm_ops);
