CREATE TABLE IF NOT EXISTS "admin_user_scopes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "scope" varchar(80) NOT NULL,
  "granted_by" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_scopes_user_scope_unique"
  ON "admin_user_scopes" ("user_id", "scope");
CREATE INDEX IF NOT EXISTS "admin_user_scopes_user_id_idx"
  ON "admin_user_scopes" ("user_id");
CREATE INDEX IF NOT EXISTS "admin_user_scopes_scope_idx"
  ON "admin_user_scopes" ("scope");

DO $$ BEGIN
  ALTER TABLE "admin_user_scopes"
    ADD CONSTRAINT "admin_user_scopes_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "admin_user_scopes"
    ADD CONSTRAINT "admin_user_scopes_granted_by_users_id_fk"
      FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "admin_user_scopes" ("user_id", "scope", "granted_by")
SELECT
  u."id" AS "user_id",
  s."scope" AS "scope",
  u."id" AS "granted_by"
FROM "users" u
CROSS JOIN (
  VALUES
    ('admin.team.manage'),
    ('admin.audit.read'),
    ('admin.bot.moderate'),
    ('admin.shop.manage'),
    ('admin.reports.manage'),
    ('admin.feedback.manage'),
    ('admin.bug-reports.manage'),
    ('admin.cosmetics.moderate')
) AS s("scope")
WHERE u."is_admin" = true
ON CONFLICT ("user_id", "scope") DO NOTHING;
