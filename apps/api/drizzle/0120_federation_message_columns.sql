ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "origin_instance_id" uuid REFERENCES "federated_instances"("id") ON DELETE SET NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "remote_message_id" uuid;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "remote_author_id" uuid REFERENCES "remote_users"("id") ON DELETE SET NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "federation_signature" text;
