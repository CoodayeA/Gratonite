CREATE TABLE IF NOT EXISTS "kanban_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL REFERENCES "channels"("id") ON DELETE cascade,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" varchar(20) DEFAULT 'todo' NOT NULL,
	"assignee_id" uuid REFERENCES "users"("id") ON DELETE set null,
	"due_date" text,
	"created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kanban_tasks_channel_status_position_idx" ON "kanban_tasks" USING btree ("channel_id","status","position");
