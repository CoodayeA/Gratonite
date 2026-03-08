-- Rollback: Remove federation columns from relationships table
ALTER TABLE "relationships" DROP COLUMN IF EXISTS "remote_addressee_id";
ALTER TABLE "relationships" DROP COLUMN IF EXISTS "remote_requester_id";
