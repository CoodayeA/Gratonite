CREATE TYPE "public"."guild_scheduled_event_entity_type" AS ENUM('stage_instance', 'voice', 'external');--> statement-breakpoint
CREATE TYPE "public"."guild_scheduled_event_status" AS ENUM('scheduled', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "guild_scheduled_event_users" (
	"event_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"interested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guild_scheduled_events" (
	"id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"channel_id" bigint,
	"creator_id" bigint NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(1000),
	"scheduled_start_time" timestamp with time zone NOT NULL,
	"scheduled_end_time" timestamp with time zone,
	"entity_type" "guild_scheduled_event_entity_type" NOT NULL,
	"entity_metadata" jsonb,
	"status" "guild_scheduled_event_status" DEFAULT 'scheduled' NOT NULL,
	"image_hash" varchar(64),
	"interested_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_answer_meta" (
	"message_id" bigint PRIMARY KEY NOT NULL,
	"thread_id" bigint NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"is_accepted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_questions" (
	"thread_id" bigint PRIMARY KEY NOT NULL,
	"guild_id" bigint NOT NULL,
	"channel_id" bigint NOT NULL,
	"author_id" bigint NOT NULL,
	"accepted_answer_id" bigint,
	"resolved" boolean DEFAULT false NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"answer_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qa_votes" (
	"target_id" bigint NOT NULL,
	"target_type" varchar(10) NOT NULL,
	"user_id" bigint NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_page_revisions" (
	"id" bigint PRIMARY KEY NOT NULL,
	"page_id" bigint NOT NULL,
	"content" text NOT NULL,
	"title" varchar(200) NOT NULL,
	"editor_id" bigint NOT NULL,
	"edit_message" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wiki_pages" (
	"id" bigint PRIMARY KEY NOT NULL,
	"channel_id" bigint NOT NULL,
	"guild_id" bigint NOT NULL,
	"title" varchar(200) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"author_id" bigint NOT NULL,
	"last_editor_id" bigint,
	"pinned" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"parent_page_id" bigint,
	"position" integer DEFAULT 0 NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guild_scheduled_event_users" ADD CONSTRAINT "guild_scheduled_event_users_event_id_guild_scheduled_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."guild_scheduled_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_scheduled_event_users" ADD CONSTRAINT "guild_scheduled_event_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_scheduled_events" ADD CONSTRAINT "guild_scheduled_events_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guild_scheduled_events" ADD CONSTRAINT "guild_scheduled_events_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_answer_meta" ADD CONSTRAINT "qa_answer_meta_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_questions" ADD CONSTRAINT "qa_questions_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_questions" ADD CONSTRAINT "qa_questions_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_questions" ADD CONSTRAINT "qa_questions_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_questions" ADD CONSTRAINT "qa_questions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_votes" ADD CONSTRAINT "qa_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_page_revisions" ADD CONSTRAINT "wiki_page_revisions_page_id_wiki_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."wiki_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_page_revisions" ADD CONSTRAINT "wiki_page_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_guild_id_guilds_id_fk" FOREIGN KEY ("guild_id") REFERENCES "public"."guilds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wiki_pages" ADD CONSTRAINT "wiki_pages_last_editor_id_users_id_fk" FOREIGN KEY ("last_editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE messages ADD COLUMN IF NOT EXISTS search_vector tsvector;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_messages_search_vector ON messages USING GIN (search_vector);--> statement-breakpoint
CREATE OR REPLACE FUNCTION messages_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS trig_messages_search_vector ON messages;--> statement-breakpoint
CREATE TRIGGER trig_messages_search_vector
  BEFORE INSERT OR UPDATE OF content ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_search_vector_update();--> statement-breakpoint
UPDATE messages SET search_vector = to_tsvector('english', COALESCE(content, '')) WHERE search_vector IS NULL;