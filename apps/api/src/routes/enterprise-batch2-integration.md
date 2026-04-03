# Enterprise Batch 2 — Integration Notes

These are the exact lines that need to be added to **shared files** maintained outside this integration note.

## 1. apps/api/src/routes/index.ts

Add import:
```typescript
import { mutesRouter } from './mutes';
```

Add route mount (after usersRouter mount):
```typescript
router.use('/users', mutesRouter);
```

## 2. apps/api/src/db/schema/index.ts

Add these exports:
```typescript
export * from './data-exports';
export * from './user-mutes';
```

## 3. apps/api/src/index.ts

Add import:
```typescript
import { startAccountDeletionJob } from './jobs/accountDeletion';
```

After server starts, add:
```typescript
startAccountDeletionJob();
```

## 4. apps/web/src/lib/api.ts — New API methods to add

```typescript
// Auth
auth.getSessions(): GET /auth/sessions
auth.revokeSession(id): DELETE /auth/sessions/{id}
auth.revokeAllSessions(): DELETE /auth/sessions/others

// Users
users.requestDataExport(): POST /users/@me/data-export
users.getDataExport(): GET /users/@me/data-export
users.requestDeletion(password): POST /users/@me/delete
users.cancelDeletion(): DELETE /users/@me/delete

// Mutes
mutes.list(): GET /users/@me/mutes
mutes.add(userId): PUT /users/@me/mutes/{userId}
mutes.remove(userId): DELETE /users/@me/mutes/{userId}
```

## 5. SQL Migrations to Run

Run on production server in order:
```
0050_data_exports.sql
0051_account_deletion.sql
0052_user_mutes.sql
```

## Files Created

- `apps/api/src/db/schema/data-exports.ts` — DataExports schema
- `apps/api/src/db/schema/user-mutes.ts` — UserMutes schema
- `apps/api/src/jobs/dataExport.ts` — Async data export job
- `apps/api/src/jobs/accountDeletion.ts` — Daily account deletion cron
- `apps/api/src/routes/mutes.ts` — Mutes router (GET/PUT/DELETE)
- `apps/api/drizzle/0050_data_exports.sql` — Migration
- `apps/api/drizzle/0051_account_deletion.sql` — Migration
- `apps/api/drizzle/0052_user_mutes.sql` — Migration

## Files Modified

- `apps/api/src/routes/auth.ts` — Added GET /sessions, DELETE /sessions/:id, DELETE /sessions/others
- `apps/api/src/routes/users.ts` — Added POST /@me/delete, DELETE /@me/delete, POST /@me/data-export, GET /@me/data-export, GET /@me/data-export/:id/download
- `apps/api/src/lib/notifications.ts` — Added senderId param + mute check before creating notifications
- `apps/web/src/components/modals/SettingsModal.tsx` — Sessions tab (real sessions from API), Privacy tab (muted users + GDPR export), Account tab (30-day deletion with password)
