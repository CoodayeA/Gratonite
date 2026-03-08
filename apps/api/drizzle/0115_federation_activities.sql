CREATE TABLE IF NOT EXISTS "federation_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "direction" varchar(10) NOT NULL,
  "activity_type" varchar(100) NOT NULL,
  "instance_id" uuid REFERENCES "federated_instances"("id") ON DELETE SET NULL,
  "payload" jsonb NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "next_attempt_at" timestamp with time zone,
  "idempotency_key" varchar(255) NOT NULL UNIQUE,
  "error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "federation_activities_status_next_attempt_idx"
  ON "federation_activities" ("status", "next_attempt_at");
