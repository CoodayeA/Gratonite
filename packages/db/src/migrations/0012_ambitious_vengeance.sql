CREATE TYPE "public"."beta_bug_report_status" AS ENUM('open', 'triaged', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "beta_bug_reports" (
	"id" bigint PRIMARY KEY NOT NULL,
	"reporter_id" bigint NOT NULL,
	"title" varchar(120) NOT NULL,
	"summary" text NOT NULL,
	"steps" text,
	"expected" text,
	"actual" text,
	"route" varchar(255),
	"page_url" text,
	"channel_label" varchar(120),
	"viewport" varchar(64),
	"user_agent" text,
	"client_timestamp" timestamp with time zone,
	"submission_source" varchar(32) DEFAULT 'web' NOT NULL,
	"status" "beta_bug_report_status" DEFAULT 'open' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "beta_bug_reports" ADD CONSTRAINT "beta_bug_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
