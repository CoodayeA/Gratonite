# Enterprise Batch 1 Integration Notes

These are the changes needed in shared files that this agent does not own.

## 1. apps/api/src/routes/index.ts

Add these imports:
```typescript
import { draftsRouter } from './drafts';
import { bookmarksRouter } from './bookmarks';
```

Add these router registrations (after existing routes):
```typescript
router.use('/', draftsRouter);
router.use('/', bookmarksRouter);
```

Note: The scheduled messages endpoints (GET /scheduled, DELETE /scheduled/:id) are already mounted inside messagesRouter, so they inherit the existing mount at `/channels/:channelId/messages`.

## 2. apps/api/src/db/schema/index.ts

Add these exports:
```typescript
export * from './message-drafts';
export * from './scheduled-messages';
export * from './message-bookmarks';
```

## 3. apps/api/src/index.ts

Add import:
```typescript
import { startScheduledMessagesJob } from './jobs/scheduledMessages';
```

After server starts (after `server.listen(...)` or after Socket.io init):
```typescript
startScheduledMessagesJob();
```

## 4. apps/web/src/lib/api.ts

Add these API methods:
```typescript
drafts: {
  get: (channelId: string) => fetchJson(`/channels/${channelId}/draft`),
  save: (channelId: string, content: string) => fetchJson(`/channels/${channelId}/draft`, { method: 'PUT', body: JSON.stringify({ content }) }),
  clear: (channelId: string) => fetchJson(`/channels/${channelId}/draft`, { method: 'DELETE' }),
},
scheduledMessages: {
  list: (channelId: string) => fetchJson(`/channels/${channelId}/messages/scheduled`),
  cancel: (channelId: string, id: string) => fetchJson(`/channels/${channelId}/messages/scheduled/${id}`, { method: 'DELETE' }),
},
bookmarks: {
  list: (before?: string) => fetchJson(`/users/@me/bookmarks${before ? `?before=${before}` : ''}`),
  add: (messageId: string, note?: string) => fetchJson(`/users/@me/bookmarks`, { method: 'POST', body: JSON.stringify({ messageId, note }) }),
  remove: (messageId: string) => fetchJson(`/users/@me/bookmarks/${messageId}`, { method: 'DELETE' }),
},
reactions: {
  ...existingReactionsApi,
  getUsers: (channelId: string, messageId: string, emoji: string) => fetchJson(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),
},
```

Note: The ChannelChat.tsx frontend currently uses raw fetch() calls for drafts, bookmarks, scheduled, and who-reacted, so the api.ts wrapper methods are optional but recommended for consistency.

## 5. Note for reactions.ts (for agent-search / other agent)

Need endpoint:
```
GET /channels/:channelId/messages/:messageId/reactions/:emoji
```
Returns users who reacted with that emoji (limit 25), joined with users table for:
- id, username, displayName, avatarHash

This endpoint is called by the who-reacted hover/click feature in ChannelChat.tsx.

## 6. apps/web/src/pages/app/SavedMessages.tsx

New page created. Needs to be added to the router (e.g., `<Route path="/saved" element={<SavedMessages />} />`).

## SQL Migrations

Three new migration files in `apps/api/drizzle/`:
- `0050_message_drafts.sql`
- `0051_scheduled_messages.sql`
- `0052_message_bookmarks.sql`

Must be run on production: `node dist/db/migrate.js`
