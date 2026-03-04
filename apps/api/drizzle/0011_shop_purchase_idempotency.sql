CREATE TABLE IF NOT EXISTS "shop_purchase_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "idempotency_key" varchar(128) NOT NULL,
  "item_id" uuid NOT NULL,
  "response_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_purchase_requests_user_key" UNIQUE("user_id","idempotency_key")
);

DO $$ BEGIN
 ALTER TABLE "shop_purchase_requests" ADD CONSTRAINT "shop_purchase_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "shop_purchase_requests" ADD CONSTRAINT "shop_purchase_requests_item_id_shop_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shop_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
