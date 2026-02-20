CREATE TYPE "public"."theme_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TABLE "avatar_decorations" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(255),
	"asset_hash" varchar(64) NOT NULL,
	"animated" boolean DEFAULT false NOT NULL,
	"category" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_effects" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(255),
	"asset_hash" varchar(64) NOT NULL,
	"animated" boolean DEFAULT false NOT NULL,
	"category" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_custom_css" (
	"guild_id" bigint PRIMARY KEY NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" bigint
);
--> statement-breakpoint
CREATE TABLE "theme_installs" (
	"user_id" bigint NOT NULL,
	"theme_id" bigint NOT NULL,
	"scope" varchar(20) DEFAULT 'personal' NOT NULL,
	"scope_id" varchar(64),
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "theme_presets" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"description" varchar(500),
	"author_id" bigint,
	"tokens" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL,
	"visibility" "theme_visibility" DEFAULT 'private' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preview_colors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"install_count" integer DEFAULT 0 NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_presets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "guild_custom_css" ADD CONSTRAINT "guild_custom_css_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_custom_css" ADD CONSTRAINT "guild_custom_css_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_installs" ADD CONSTRAINT "theme_installs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_installs" ADD CONSTRAINT "theme_installs_theme_id_theme_presets_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."theme_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_presets" ADD CONSTRAINT "theme_presets_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_installs" ADD CONSTRAINT "theme_installs_user_theme_pk" PRIMARY KEY ("user_id", "theme_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_theme_presets_visibility_popular" ON "theme_presets" ("visibility", "install_count" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_theme_presets_author" ON "theme_presets" ("author_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_theme_installs_theme" ON "theme_installs" ("theme_id");