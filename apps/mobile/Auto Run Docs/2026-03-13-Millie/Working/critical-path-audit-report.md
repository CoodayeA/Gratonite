---
type: report
title: Critical Path Screen Audit Report
created: 2026-03-13
tags:
  - mobile
  - bug-audit
  - critical-path
---

# Critical Path Screen Audit Report

## Bugs Found And Fixed

- `ChannelChatScreen` now uses optimistic message sending so a newly sent message appears immediately and rolls back cleanly on failure. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ChannelChatScreen.tsx:624`
- `ChannelChatScreen` older-message pagination now surfaces failures instead of silently failing, which prevents the chat from feeling stuck during history loads. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ChannelChatScreen.tsx:675`
- `ChannelChatScreen` draft handling now clears saved drafts when the composer is emptied instead of leaving stale draft text behind. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ChannelChatScreen.tsx:734`
- `ChannelChatScreen` reply taps can now jump to the referenced message when it is present in the loaded history. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ChannelChatScreen.tsx:582`
- `DirectMessageScreen` now uses optimistic send behavior for DM messages, including encrypted-message sends, with rollback and input restore on failure. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/DirectMessageScreen.tsx:460`
- `DirectMessageScreen` older-message pagination now reports load failures instead of silently swallowing them. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/DirectMessageScreen.tsx:517`
- `DirectMessageScreen` draft cleanup now deletes empty drafts instead of preserving stale content. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/DirectMessageScreen.tsx:576`
- `DirectMessageScreen` reply taps can now jump back to the original replied-to message when it exists in the current list. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/DirectMessageScreen.tsx:418`
- `DMListScreen` now sorts conversations by most recent activity instead of relying on backend ordering. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/DMListScreen.tsx:255`
- `DMListScreen` now renders a real last-message preview, including `[Attachment]` for media-only conversations. Files: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/DMListScreen.tsx:65`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/lib/api.ts:635`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/types/index.ts:120`
- `DMSearchScreen` search input is now debounced to avoid firing a network request on every keystroke. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/DMSearchScreen.tsx:32`
- `GuildChannelsScreen` now shows channel unread badges directly in the channel list. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GuildChannelsScreen.tsx:40`
- `GuildChannelsScreen` now supports collapsible category headers instead of rendering every category as always-open. Files: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GuildChannelsScreen.tsx:91`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GuildChannelsScreen.tsx:129`
- `GuildChannelsScreen` now routes announcement, forum, stage, voice, and text channels to the correct destination screen instead of treating most non-voice channels the same. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GuildChannelsScreen.tsx:159`
- `GuildListScreen` now defaults unknown presence display to offline instead of online and refreshes online counts against freshly loaded guild data. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/GuildListScreen.tsx:319`
- `NotificationInboxScreen` now refreshes badge counts after mark-read, dismiss, mark-all-read, clear-all, and clear-read actions so tab-state stays in sync. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/NotificationInboxScreen.tsx:46`
- `NotificationInboxScreen` now listens for real-time notification create events and refreshes the inbox without requiring a manual pull-to-refresh. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/NotificationInboxScreen.tsx:72`
- `NotificationInboxScreen` tap actions now navigate to the most relevant destination available from notification metadata instead of acting as read-only rows. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/NotificationInboxScreen.tsx:365`
- `ThemePickerScreen` now previews the selected theme immediately when the user picks a style or toggles dark/light, instead of waiting until completion. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/onboarding/ThemePickerScreen.tsx:218`
- `CreateGuildScreen` now refreshes guild/app state after successful creation before navigating into the newly created portal. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/CreateGuildScreen.tsx:31`
- `InviteAcceptScreen` now guarantees loading-state cleanup, improves invalid/incomplete join handling, and shows a proper loading spinner inside the accept action. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/InviteAcceptScreen.tsx:42`
- Supporting presence fix: friend presence refresh now pessimistically marks requested users offline before overlaying API results, which prevents stale “everyone is online” dots from sticking around when a user disconnects. Files: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/contexts/AppStateContext.tsx:60`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/FriendsScreen.tsx:46`

## Issues Requiring API Changes Or Deeper Investigation

- `ChannelChatScreen` file/image sending still has to send an uploaded URL as plain text because the current message-send API does not accept attachment IDs or structured attachment metadata yet. Marked in code: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ChannelChatScreen.tsx:710`
- `DirectMessageScreen` has the same attachment limitation as guild chat and needs backend support for proper attachment payloads. Marked in code: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/DirectMessageScreen.tsx:552`
- `CreateGuildScreen` cannot complete icon upload during guild creation because the current backend/mobile API only supports name/description at create time. Marked in code: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/CreateGuildScreen.tsx:39`

## Screens Audited With No New Issues Found

- `OnboardingScreen` itself was functionally clean during this pass after earlier onboarding fixes; the only first-run issue found in this audit was immediate theme preview/persistence behavior in `ThemePickerScreen`.

## Phase 03 Findings

### Bugs Found And Fixed

- `SettingsAccountScreen` no longer claims password changes succeeded when no backend password-change endpoint is available; it now reports the limitation honestly and avoids fake success. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/SettingsAccountScreen.tsx`
- `SettingsAccountScreen` no longer pretends account deletion was scheduled; it now reports the missing mobile deletion flow instead of showing a false confirmation path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/SettingsAccountScreen.tsx`
- `SettingsAccountScreen` now resyncs profile field inputs when the authenticated user object changes, which prevents stale account-edit values after profile refreshes. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/SettingsAccountScreen.tsx`
- `SettingsNotificationsScreen` now persists granular notification toggles locally instead of losing them immediately after leaving the screen. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/SettingsNotificationsScreen.tsx`
- `SettingsAppLockScreen` now shows a proper loading state and uses the full screen container instead of flashing a blank screen while biometric state initializes. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/SettingsAppLockScreen.tsx`
- Maestro coverage was expanded with new flows for register, forgot-password, navigation tabs, guild browse, settings, friend list, profile view, and a composed regression run. Files: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/flows/register.yaml`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/flows/forgot-password.yaml`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/flows/navigation-tabs.yaml`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/flows/guild-browse.yaml`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/flows/settings.yaml`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/flows/friend-list.yaml`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/flows/profile-view.yaml`, `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/flows/full-regression.yaml`
- `GuildSettingsScreen` now hides the mobile admin tool stack from non-owners instead of exposing a long list of moderation/configuration routes to members who cannot safely use them. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GuildSettingsScreen.tsx:264`
- `RoleListScreen` no longer turns a failed API load into a misleading “No roles” state; it now shows a proper retryable error state when the initial fetch fails. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/RoleListScreen.tsx:30`
- `RoleEditScreen` now keeps edit-mode users on a recoverable retry screen when the role load fails, instead of dropping them into a half-empty edit form with stale state. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/RoleEditScreen.tsx:42`
- `ChannelCreateScreen` now actually sends the visible `NSFW` and `Slow Mode` settings to the channel-create API instead of silently discarding them at submit time. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ChannelCreateScreen.tsx:83`
- `ChannelEditScreen` now uses the dedicated disappearing-message timer endpoint during save, so channel timer edits persist instead of depending on the generic channel PATCH payload. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ChannelEditScreen.tsx:76`
- `ChannelEditScreen` now surfaces a retryable full-screen error when the initial channel fetch fails, rather than immediately kicking the user back out of the screen. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ChannelEditScreen.tsx:242`
- `GuildMemberListScreen` no longer collapses member-load failures into a false empty state; it now shows the load error and lets the user retry. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GuildMemberListScreen.tsx:163`
- `InviteListScreen` no longer collapses invite-load failures into a false empty state; it now shows the load error and lets the user retry. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/InviteListScreen.tsx:201`
- `MemberModerateScreen` now shows a recoverable full-screen error state when the member moderation payload fails to load, instead of leaving moderators stranded on a blank or partial screen. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/MemberModerateScreen.tsx:316`
- `GuildBansScreen` no longer treats a failed bans fetch as “No banned users”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GuildBansScreen.tsx:174`
- `BanAppealsScreen` no longer treats a failed appeals fetch as “No ban appeals”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/BanAppealsScreen.tsx:257`
- `AutomodConfigScreen` no longer treats a failed rule fetch as “no rules configured”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/AutomodConfigScreen.tsx:294`
- `WordFilterScreen` no longer treats a failed filter fetch as “no filtered words”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/WordFilterScreen.tsx:257`
- `RaidProtectionScreen` now shows a retryable error state when portal protection settings fail to load instead of rendering a dead-end fallback message. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/RaidProtectionScreen.tsx:260`
- `AuditLogScreen` no longer treats a failed audit-log fetch as “no audit log entries”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/AuditLogScreen.tsx:235`
- `ActivityLogScreen` no longer treats a failed activity-log fetch as “no activity yet”; it now shows the error and offers a retry path, and paginated load-more failures surface as toasts instead of disappearing silently. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ActivityLogScreen.tsx:145`
- `WebhookManagementScreen` no longer treats a failed webhook fetch as “no webhooks configured”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/WebhookManagementScreen.tsx:314`
- `EmojiManagementScreen` no longer treats a failed emoji fetch as “no emojis yet”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/EmojiManagementScreen.tsx:214`
- `ServerTemplatesScreen` no longer treats a failed templates fetch as “no templates”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ServerTemplatesScreen.tsx:282`
- `AutoRoleConfigScreen` no longer treats a failed auto-role fetch as “no auto roles”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/AutoRoleConfigScreen.tsx`
- `ReactionRoleConfigScreen` no longer relies on a toast-only failure path for first load; it now shows a retryable full-screen error when the initial reaction-role fetch fails. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ReactionRoleConfigScreen.tsx`
- `StarboardConfigScreen` no longer swallows an initial starboard config failure; it now shows a retryable full-screen error instead of dropping users into a misleading default form. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/StarboardConfigScreen.tsx`
- `DigestConfigScreen` no longer swallows an initial digest config failure; it now shows a retryable full-screen error instead of dropping users into a misleading default form. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/DigestConfigScreen.tsx`
- `OnboardingConfigScreen` no longer treats a failed onboarding-step fetch as “no onboarding steps”; it now shows the error and offers a retry path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/OnboardingConfigScreen.tsx`
- `GiveawayListScreen` no longer relies on a toast-only failure path for first load; it now shows a retryable full-screen error when the initial giveaway fetch fails. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GiveawayListScreen.tsx`
- `AnnouncementChannelScreen` no longer relies on a toast-only failure path for first load; it now shows a retryable full-screen error when the initial announcement fetch fails. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/AnnouncementChannelScreen.tsx`
- `ScheduledEventsScreen` no longer treats a failed event fetch as “no events”; it now shows a retryable full-screen error when the initial scheduled-events load fails. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ScheduledEventsScreen.tsx`
- `WorkflowListScreen` no longer relies on a toast-only failure path for first load; it now shows a retryable full-screen error when the initial workflow fetch fails. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/WorkflowListScreen.tsx`
- `ThreadListScreen` no longer relies on a toast-only failure path for first load; it now shows a retryable full-screen error when the initial thread fetch fails. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ThreadListScreen.tsx`
- `StarboardScreen` no longer relies on a toast-only failure path for first load; it now shows a retryable full-screen error when the initial starboard feed fetch fails. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/StarboardScreen.tsx`
- `GuildInsightsScreen` no longer swallows a failed guild/channel insights fetch and fall through to a dead-end message; it now shows a retryable full-screen error with a real reload path. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GuildInsightsScreen.tsx`

### Issues Requiring API Changes Or Deeper Investigation

- `SettingsAccountScreen` still needs a real authenticated password-change endpoint for mobile. This is tagged in code with `// MOBILE-POLISH:`. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/SettingsAccountScreen.tsx`
- `SettingsAccountScreen` still needs a real account-deletion endpoint and destructive confirmation flow for mobile. This is tagged in code with `// MOBILE-POLISH:`. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/SettingsAccountScreen.tsx`
- `SettingsNotificationsScreen` still lacks server-side fields for granular notification categories; only the master push toggle is backed by the API today. This is tagged in code with `// MOBILE-POLISH:`. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/app/SettingsNotificationsScreen.tsx`
- `GuildSettingsScreen` currently gates mobile admin tools to the guild owner as the safest fallback. The app still needs real member-permission data to expose these routes correctly to non-owner admins and moderators. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/GuildSettingsScreen.tsx`
- `ChannelCreateScreen` still depends on backend support to echo newly created moderation fields like `nsfw` and `slowModeSeconds` in the create response, so mobile can confirm the settings persisted without an extra refetch. This is tagged in code with `// MOBILE-POLISH:`. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/ChannelCreateScreen.tsx:85`
- `MemberModerateScreen` still cannot show correct preexisting role assignments for a member before toggling because the current mobile/API flow does not expose the member's assigned role IDs. This is tagged in code with `// MOBILE-POLISH:`. File: `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile/src/screens/guild/MemberModerateScreen.tsx:63`

### Screens Clean In This Pass

- `SettingsScreen` navigation hub was functionally clean in this pass.
- `SettingsAppearanceScreen` was already applying and persisting theme/font changes correctly for the currently supported settings model.
- `SettingsSessionsScreen`, `SettingsSoundScreen`, and `SettingsMutedUsersScreen` were functionally sound during this spot audit.
- `ChannelCreateScreen` category loading flow was otherwise sound once the missing payload fields were wired through.

### Summary Statistics

- Screens audited in this incremental Phase 03 pass: 36
- Bugs fixed in this incremental Phase 03 pass: 37
- Issues deferred with `MOBILE-POLISH`: 6
