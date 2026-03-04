# Feature Matrix (25)

Status legend:
- `implemented`: shipped in codebase.
- `partial`: baseline exists, parity gaps remain.
- `planned`: defined, not yet implemented.

| # | Feature | Status | Domain Kill Switch | Owner | API/UI/Test Notes |
|---|---|---|---|---|---|
| 1 | Thread subscriptions + inbox | partial | `threads_v1` | Chat | Thread routes exist; inbox parity pending |
| 2 | Message bookmarks + folders/notes | planned | `bookmarks_v1` | Chat | Requires bookmark tables + UI |
| 3 | Scheduled messages + recurring | planned | `messages_schedule_v1` | Chat | Requires scheduler + recurrence model |
| 4 | Edit history + diff viewer | partial | `message_history_v1` | Chat | Revision support exists in part; diff UI pending |
| 5 | Search v2 filters | partial | `search_v2` | Search | Basic search exists; advanced filters pending |
| 6 | Jump-to-date scrubber | planned | `search_timeline_v1` | Search | Requires indexed timestamp navigation |
| 7 | Message reminders | planned | `reminders_v1` | Productivity | Requires jobs + reminder model |
| 8 | Reactions analytics | planned | `reactions_analytics_v1` | Insights | Requires aggregation endpoints |
| 9 | AutoMod v2 | planned | `automod_v2` | Trust & Safety | Requires rule engine + escalation |
| 10 | Onboarding flows + self roles | partial | `onboarding_v1` | Guild | Basic onboarding exists; self-role UX pending |
| 11 | Verification levels/gating | planned | `verification_v1` | Guild | Requires policy + join gates |
| 12 | Permission simulator | partial | `permissions_debugger_v1` | Guild | Permission routes exist; simulator UI pending |
| 13 | Server templates/clone | planned | `server_templates_v1` | Guild | Requires template persistence |
| 14 | Forum upgrades | planned | `forum_v2` | Forum | Requires required-tags/solved queue |
| 15 | Announcement + cross-post | partial | `announcements_v1` | Guild | Channel features exist; cross-post pending |
| 16 | Voice quality controls | partial | `voice_quality_v2` | Voice | Voice routes exist; quality policy UI pending |
| 17 | Stage channels v2 | partial | `voice_stage_v2` | Voice | Stage controls partially present |
| 18 | Stream quality presets | planned | `stream_quality_v1` | Voice | Requires transport policy controls |
| 19 | Presence conflict resolution | planned | `presence_v2` | Realtime | Requires multi-session arbitration |
| 20 | Notification matrix + quiet hours | planned | `notifications_matrix_v1` | Notifications | Requires per-scope prefs and scheduler |
| 21 | Unread sync v2 | planned | `unread_sync_v2` | Realtime | Requires deterministic read-state service |
| 22 | Audit log v2 + export | planned | `audit_log_v2` | Admin | Requires diff model + export pipeline |
| 23 | Reports pipeline v2 | planned | `reports_v2` | Trust & Safety | Requires triage workflow + SLA fields |
| 24 | Safety center + appeals | planned | `safety_center_v1` | Trust & Safety | Requires appeals + timeout history |
| 25 | Bot platform parity | partial | `bot_platform_v2` | Platform | Bot routes exist; permissions/install parity pending |

## Launch Default
- All kill switches default `ON` at launch.
- Rollback order: kill switch -> targeted rollback -> full rollback.

## Reliability Overlay (Launch-Critical)
- Guild navigation/render stability is treated as a launch gate independent of feature count.
- Hotfix applied on 2026-03-03:
  - Stabilized `useGuildSession` callback identity in `App.tsx`.
  - Made empty-channel reset idempotent in `useGuildSession.ts`.
- This does not change feature scope/status above; it is a release reliability correction.
