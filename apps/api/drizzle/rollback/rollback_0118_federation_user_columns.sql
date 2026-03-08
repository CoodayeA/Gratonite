-- Rollback: Remove federation columns from users table
ALTER TABLE "users" DROP COLUMN IF EXISTS "federation_public_key_pem";
ALTER TABLE "users" DROP COLUMN IF EXISTS "is_federated";
ALTER TABLE "users" DROP COLUMN IF EXISTS "home_instance_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "federation_address";
