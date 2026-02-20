CREATE TABLE "guild_emojis" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"name" varchar(32) NOT NULL,
	"hash" varchar(64) NOT NULL,
	"animated" boolean DEFAULT false NOT NULL,
	"creator_id" bigint NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_stickers" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"name" varchar(30) NOT NULL,
	"description" varchar(100),
	"hash" varchar(64) NOT NULL,
	"format_type" varchar(10) NOT NULL,
	"tags" varchar(200),
	"available" boolean DEFAULT true NOT NULL,
	"creator_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guild_emojis" ADD CONSTRAINT "guild_emojis_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_emojis" ADD CONSTRAINT "guild_emojis_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_stickers" ADD CONSTRAINT "guild_stickers_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_stickers" ADD CONSTRAINT "guild_stickers_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;