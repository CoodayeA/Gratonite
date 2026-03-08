ALTER TABLE "relationships" ADD COLUMN IF NOT EXISTS "remote_requester_id" uuid REFERENCES "remote_users"("id") ON DELETE SET NULL;
ALTER TABLE "relationships" ADD COLUMN IF NOT EXISTS "remote_addressee_id" uuid REFERENCES "remote_users"("id") ON DELETE SET NULL;
