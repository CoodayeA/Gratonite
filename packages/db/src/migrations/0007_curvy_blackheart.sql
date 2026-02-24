CREATE INDEX "idx_guild_members_guild_user" ON "guild_members" USING btree ("guild_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_guild_members_user_guild" ON "guild_members" USING btree ("user_id","guild_id");--> statement-breakpoint
CREATE INDEX "idx_messages_guild_channel_id" ON "messages" USING btree ("guild_id","channel_id","id");