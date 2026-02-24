DO $$ BEGIN
 CREATE TYPE "public"."community_item_type" AS ENUM('display_name_style_pack', 'profile_widget_pack', 'server_tag_badge', 'avatar_decoration', 'profile_effect', 'nameplate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."community_item_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'published', 'unpublished');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."community_item_scope" AS ENUM('global', 'guild');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."community_report_status" AS ENUM('open', 'resolved', 'dismissed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_items" (
	"id" bigint PRIMARY KEY NOT NULL,
	"item_type" "community_item_type" NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(255),
	"uploader_id" bigint NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload_schema_version" integer DEFAULT 1 NOT NULL,
	"asset_hash" varchar(64),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "community_item_status" DEFAULT 'draft' NOT NULL,
	"moderation_notes" text,
	"rejection_code" varchar(64),
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_item_installs" (
	"user_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"scope" "community_item_scope" DEFAULT 'global' NOT NULL,
	"scope_id" bigint,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_item_installs_pk" PRIMARY KEY("user_id","item_id","scope","scope_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_item_reports" (
	"id" bigint PRIMARY KEY NOT NULL,
	"item_id" bigint NOT NULL,
	"reporter_id" bigint NOT NULL,
	"reason" varchar(64) NOT NULL,
	"details" varchar(500),
	"status" "community_report_status" DEFAULT 'open' NOT NULL,
	"reviewed_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_items" ADD CONSTRAINT "community_items_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_item_installs" ADD CONSTRAINT "community_item_installs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_item_installs" ADD CONSTRAINT "community_item_installs_item_id_community_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."community_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_item_reports" ADD CONSTRAINT "community_item_reports_item_id_community_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."community_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_item_reports" ADD CONSTRAINT "community_item_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_item_reports" ADD CONSTRAINT "community_item_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_items_status_idx" ON "community_items" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_items_item_type_idx" ON "community_items" USING btree ("item_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_items_uploader_id_idx" ON "community_items" USING btree ("uploader_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_item_installs_item_id_idx" ON "community_item_installs" USING btree ("item_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_item_reports_item_id_idx" ON "community_item_reports" USING btree ("item_id");
