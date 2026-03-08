CREATE TABLE IF NOT EXISTS "instance_blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instance_id" uuid REFERENCES "federated_instances"("id") ON DELETE CASCADE,
  "blocked_domain" text NOT NULL,
  "blocked_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reason" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
