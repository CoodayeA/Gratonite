-- Add shop_purchase to reward_source enum
ALTER TYPE "public"."reward_source" ADD VALUE IF NOT EXISTS 'shop_purchase';
--> statement-breakpoint

-- Create shop_items table for catalog
CREATE TABLE "shop_items" (
	"id" bigint PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL, -- 'avatar_decoration', 'profile_effect', 'nameplate', etc.
	"category" varchar(50) NOT NULL, -- 'featured', 'avatar_decorations', 'profile_effects', etc.
	"price" integer NOT NULL,
	"asset_hash" varchar(64), -- For decorations/effects
	"metadata" jsonb DEFAULT '{}'::jsonb, -- Additional data (colors, animations, etc.)
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create index for active items
CREATE INDEX "shop_items_active_idx" ON "shop_items" ("is_active") WHERE "is_active" = true;
--> statement-breakpoint
CREATE INDEX "shop_items_category_idx" ON "shop_items" ("category");
--> statement-breakpoint
CREATE INDEX "shop_items_featured_idx" ON "shop_items" ("is_featured") WHERE "is_featured" = true;

--> statement-breakpoint
-- Create user_inventory table for purchased items
CREATE TABLE "user_inventory" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_equipped" boolean DEFAULT false NOT NULL,
	"equipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_inventory" ADD CONSTRAINT "user_inventory_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_inventory_user_item_unique" ON "user_inventory" ("user_id", "item_id");
--> statement-breakpoint
CREATE INDEX "user_inventory_user_id_idx" ON "user_inventory" ("user_id");
--> statement-breakpoint
CREATE INDEX "user_inventory_equipped_idx" ON "user_inventory" ("user_id", "is_equipped") WHERE "is_equipped" = true;

--> statement-breakpoint
-- Create shop_purchases table for transaction history
CREATE TABLE "shop_purchases" (
	"id" bigint PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"item_id" bigint NOT NULL,
	"price" integer NOT NULL,
	"currency" varchar(20) DEFAULT 'gratonites' NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shop_purchases" ADD CONSTRAINT "shop_purchases_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "shop_purchases_user_id_idx" ON "shop_purchases" ("user_id");
--> statement-breakpoint
CREATE INDEX "shop_purchases_created_at_idx" ON "shop_purchases" ("purchased_at");
