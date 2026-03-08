CREATE TABLE IF NOT EXISTS "account_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_instance_id" uuid REFERENCES "federated_instances"("id") ON DELETE SET NULL,
  "source_federation_address" varchar(255) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "imported_data" jsonb DEFAULT '{}',
  "verification_proof" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
