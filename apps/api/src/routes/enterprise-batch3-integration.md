# Enterprise Batch 3 Integration Notes

These are changes needed in shared files that this agent cannot edit directly.

## 1. routes/index.ts - Add new router imports and mounts

```typescript
import { wordFilterRouter } from './word-filter';
import { channelNotifPrefsRouter } from './channel-notification-prefs';
// ...
router.use('/guilds/:guildId/word-filter', wordFilterRouter);
router.use('/channels/:channelId', channelNotifPrefsRouter);
```

## 2. schema/index.ts - Export new schemas

```typescript
export * from './guild-word-filters';
export * from './channel-notification-prefs';
```

## 3. messages.ts POST handler - Word filter check

Add after auth and channel access check, before message insert.
Only applies to guild channels (channel.guildId must be non-null).

```typescript
// Word filter check
if (channel.guildId && body.content) {
  const [wordFilter] = await db.select().from(guildWordFilters)
    .where(eq(guildWordFilters.guildId, channel.guildId))
    .limit(1);
  if (wordFilter && wordFilter.words && wordFilter.words.length > 0) {
    const contentLower = body.content.toLowerCase();
    const matched = wordFilter.words.some((w: string) => contentLower.includes(w.toLowerCase()));
    if (matched && wordFilter.action === 'block') {
      res.status(400).json({ code: 'BLOCKED_CONTENT', message: 'Your message contains blocked words' }); return;
    }
    // For 'delete' and 'warn' actions: allow send, handle post-send
  }
}
// Need to add import: import { guildWordFilters } from '../db/schema/guild-word-filters';
```

## 4. notifications.ts createNotification - Per-channel pref check

Add optional channelId to CreateNotificationParams interface.
Before inserting notification:

```typescript
if (params.channelId) {
  const [pref] = await db.select().from(channelNotificationPrefs)
    .where(and(
      eq(channelNotificationPrefs.userId, params.userId),
      eq(channelNotificationPrefs.channelId, params.channelId)
    )).limit(1);

  if (pref) {
    if (pref.level === 'none') return;
    if (pref.mutedUntil && pref.mutedUntil > new Date()) return;
    if (pref.level === 'mentions' && !params.isMention) return;
  }
}
// Add optional fields to CreateNotificationParams:
// channelId?: string
// isMention?: boolean
// Import: import { channelNotificationPrefs } from '../db/schema/channel-notification-prefs';
```

## 5. api.ts (frontend) - New API methods

```
wordFilter.get(guildId): GET /guilds/{guildId}/word-filter
wordFilter.save(guildId, {words, action, exemptRoles}): PUT /guilds/{guildId}/word-filter
moderation.bulkKick(guildId, {userIds, reason}): POST /guilds/{guildId}/members/bulk-kick
moderation.bulkBan(guildId, {userIds, reason}): POST /guilds/{guildId}/members/bulk-ban
moderation.bulkRole(guildId, {userIds, addRoles, removeRoles}): POST /guilds/{guildId}/members/bulk-role
guilds.lock(guildId): POST /guilds/{guildId}/lock
guilds.unlock(guildId): DELETE /guilds/{guildId}/lock
channels.getNotifPrefs(channelId): GET /channels/{channelId}/notification-prefs
channels.setNotifPrefs(channelId, {level, mutedUntil}): PUT /channels/{channelId}/notification-prefs
```

Note: The GuildSettingsModal currently uses `api.get()`, `api.put()`, `api.post()`, `api.delete()` generic methods for the new endpoints, so these named methods are optional convenience wrappers.

## 6. Channel context menu - Per-channel notification preferences

Add to channel right-click context menu (likely in ChannelChat.tsx or channel sidebar):
- "Notification Preferences" option that opens a small popover
- Popover contains a level selector: All messages / Mentions only / None / Default
- Optional: mute until duration picker
- Calls PUT /channels/:channelId/notification-prefs

## 7. SQL Migrations to run on production

Three new migration files created:
- `apps/api/drizzle/0056_word_filters.sql` - guild_word_filters table
- `apps/api/drizzle/0057_raid_protection.sql` - raid_protection_enabled + locked_at columns on guilds
- `apps/api/drizzle/0058_channel_notification_prefs.sql` - channel_notification_prefs table
