CREATE TABLE "user_soundboard" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_soundboard_user_item_key" UNIQUE("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "auction_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"bidder_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cosmetic_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"starting_price" integer NOT NULL,
	"reserve_price" integer,
	"current_bid" integer,
	"current_bidder_id" uuid,
	"ends_at" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" text,
	"avatar_hash" varchar(255),
	"webhook_url" varchar(512) NOT NULL,
	"webhook_secret_hash" varchar(255) NOT NULL,
	"webhook_secret_key" varchar(255) NOT NULL,
	"api_token" varchar(512) NOT NULL,
	"listing_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_items" ADD COLUMN "type" varchar(32);--> statement-breakpoint
ALTER TABLE "shop_items" ADD COLUMN "asset_url" varchar(512);--> statement-breakpoint
ALTER TABLE "shop_items" ADD COLUMN "asset_config" jsonb;--> statement-breakpoint
ALTER TABLE "shop_items" ADD COLUMN "duration" integer;--> statement-breakpoint
ALTER TABLE "shop_items" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "cosmetics" ADD COLUMN "asset_config" jsonb;--> statement-breakpoint
ALTER TABLE "cosmetics" ADD COLUMN "status" varchar(32) DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "cosmetics" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "user_soundboard" ADD CONSTRAINT "user_soundboard_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_soundboard" ADD CONSTRAINT "user_soundboard_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_bidder_id_users_id_fk" FOREIGN KEY ("bidder_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_cosmetic_id_cosmetics_id_fk" FOREIGN KEY ("cosmetic_id") REFERENCES "public"."cosmetics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_current_bidder_id_users_id_fk" FOREIGN KEY ("current_bidder_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_applications" ADD CONSTRAINT "bot_applications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_applications" ADD CONSTRAINT "bot_applications_listing_id_bot_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."bot_listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_bids_auction_amount_idx" ON "auction_bids" USING btree ("auction_id","amount");