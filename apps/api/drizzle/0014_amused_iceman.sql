CREATE TABLE "guild_member_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"guild_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guild_member_group_members_group_user_key" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "guild_member_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guild_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"color" varchar(16) DEFAULT '#99aab5' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_purchase_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"item_id" uuid NOT NULL,
	"response_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_purchase_requests_user_key" UNIQUE("user_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "fame_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"giver_id" uuid NOT NULL,
	"receiver_id" uuid NOT NULL,
	"message_id" uuid,
	"guild_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fame_daily_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "fame_daily_limits_user_id_date_key" UNIQUE("user_id","date")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nameplate_style" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guilds" ADD COLUMN "discover_rank" integer DEFAULT 9999 NOT NULL;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "background_url" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "background_type" varchar(10);--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "low_power" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guild_member_group_members" ADD CONSTRAINT "guild_member_group_members_group_id_guild_member_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."guild_member_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_member_group_members" ADD CONSTRAINT "guild_member_group_members_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_member_group_members" ADD CONSTRAINT "guild_member_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_member_groups" ADD CONSTRAINT "guild_member_groups_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_member_groups" ADD CONSTRAINT "guild_member_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_purchase_requests" ADD CONSTRAINT "shop_purchase_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_purchase_requests" ADD CONSTRAINT "shop_purchase_requests_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fame_transactions" ADD CONSTRAINT "fame_transactions_giver_id_users_id_fk" FOREIGN KEY ("giver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fame_transactions" ADD CONSTRAINT "fame_transactions_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fame_transactions" ADD CONSTRAINT "fame_transactions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fame_transactions" ADD CONSTRAINT "fame_transactions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fame_daily_limits" ADD CONSTRAINT "fame_daily_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fame_transactions_receiver_id_idx" ON "fame_transactions" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "fame_transactions_giver_id_idx" ON "fame_transactions" USING btree ("giver_id");