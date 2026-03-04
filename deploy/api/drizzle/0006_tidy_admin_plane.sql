CREATE TABLE IF NOT EXISTS "admin_team_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL,
  "role" varchar(20) NOT NULL DEFAULT 'support',
  "token" varchar(128) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "invited_by" uuid,
  "invited_user_id" uuid,
  "accepted_by" uuid,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "admin_team_invites_token_unique" UNIQUE("token")
);

CREATE TABLE IF NOT EXISTS "admin_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" uuid NOT NULL,
  "action" varchar(80) NOT NULL,
  "target_type" varchar(40),
  "target_id" varchar(255),
  "description" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "admin_team_invites"
    ADD CONSTRAINT "admin_team_invites_invited_by_users_id_fk"
      FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "admin_team_invites"
    ADD CONSTRAINT "admin_team_invites_invited_user_id_users_id_fk"
      FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "admin_team_invites"
    ADD CONSTRAINT "admin_team_invites_accepted_by_users_id_fk"
      FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "admin_audit_log"
    ADD CONSTRAINT "admin_audit_log_actor_id_users_id_fk"
      FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
