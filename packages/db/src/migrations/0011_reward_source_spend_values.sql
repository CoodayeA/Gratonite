ALTER TYPE "public"."reward_source" ADD VALUE IF NOT EXISTS 'shop_purchase';
--> statement-breakpoint
ALTER TYPE "public"."reward_source" ADD VALUE IF NOT EXISTS 'creator_item_purchase';
