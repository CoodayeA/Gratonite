ALTER TABLE "channels" ADD COLUMN "is_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "group_name" varchar(100);--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "group_icon" varchar(255);--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;