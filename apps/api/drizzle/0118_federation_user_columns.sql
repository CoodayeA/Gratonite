ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "federation_address" varchar(255) UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "home_instance_id" uuid REFERENCES "federated_instances"("id") ON DELETE SET NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_federated" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "federation_public_key_pem" text;
