# Phase 02: Critical Path Screen Audit & Bug Fixes

This phase performs a deep code audit of the most-used screens in the app — the ones every beta tester hits in every session: chat, DMs, guild navigation, notifications, and onboarding. The goal is to find and fix bugs, broken API integrations, hardcoded data, missing error handling, and navigation edge cases in these critical path screens before they hit App Store reviewers or real users. Read each screen file carefully, trace the data flow from API call to render, and fix issues in place.

## Tasks

- [ ] Audit and fix the ChannelChatScreen (the most-used screen in the app):
  - Read `apps/mobile/src/screens/guild/ChannelChatScreen.tsx` (1213 lines) thoroughly
  - Check for:
    - Message sending: does it handle failures gracefully? Does the sent message appear immediately (optimistic update) or only after API confirmation?
    - Message loading: is pagination (infinite scroll / load-more) working correctly? Are there off-by-one errors in cursor-based pagination?
    - Real-time updates: are MESSAGE_CREATE, MESSAGE_UPDATE, MESSAGE_DELETE socket events handled? Do new messages from other users appear without refresh?
    - Typing indicators: does TYPING_START display correctly? Does it time out?
    - Attachments: can users send images/files? Does the attachment preview render correctly?
    - Reactions: can users add/remove reactions? Does the reaction count update?
    - Reply/Edit/Delete: do message context menu actions work end-to-end?
    - Thread creation: does replying in a thread navigate correctly?
    - Empty channel state: what shows when a channel has no messages?
    - Error recovery: if the API call fails mid-chat, does the screen recover or get stuck?
  - Fix any issues found. For complex issues that need API changes, add a clearly-marked comment `// MOBILE-POLISH: [description of needed fix]` and move on.

- [ ] Audit and fix the DirectMessageScreen:
  - Read `apps/mobile/src/screens/app/DirectMessageScreen.tsx` (1061 lines) thoroughly
  - Check all the same items as ChannelChatScreen above, plus:
    - E2E encryption: does encryption/decryption work without errors? Are encrypted messages displayed correctly? What happens if key exchange fails?
    - Disappearing messages: if enabled, does the timer display and do messages disappear?
    - Group DM specifics: does the group DM header show correct member names? Can members be added/removed?
    - Read receipts: if implemented, do they update correctly?
    - DM-specific navigation: does tapping user avatar open their profile?
  - Fix issues found inline.

- [ ] Audit and fix the DMListScreen and message navigation:
  - Read `apps/mobile/src/screens/app/DMListScreen.tsx` and `apps/mobile/src/screens/app/DMSearchScreen.tsx`
  - Check for:
    - DM list loading: are conversations sorted by most recent message?
    - Unread indicators: do unread badges/counts display correctly?
    - Last message preview: does it show the actual last message text (or "[Attachment]" for media)?
    - Search: does DMSearchScreen filter results correctly? Is there debounce on search input?
    - Navigation: does tapping a DM conversation navigate to the correct DirectMessageScreen with the right channelId?
    - Empty state: what shows when the user has no DMs?
    - User presence: are status dots correct? (should be using presenceStore after Phase 01 fix)
  - Fix issues found inline.

- [ ] Audit and fix the GuildListScreen and GuildChannelsScreen:
  - Read `apps/mobile/src/screens/app/GuildListScreen.tsx` and `apps/mobile/src/screens/guild/GuildChannelsScreen.tsx`
  - Check for:
    - Guild list: are guilds loaded from the API correctly? Do guild icons/avatars render?
    - Guild ordering: are guilds in the user's preferred order? Is drag-to-reorder working if implemented?
    - Channel categories: are channels grouped by category with collapsible headers?
    - Channel types: do different channel types (text, voice, announcement, forum, stage) show correct icons and navigate to the correct screen?
    - Unread indicators: do channels with unread messages have visual indicators?
    - Create guild: does the "Create Guild" flow work end-to-end?
    - Server discovery: does navigation to ServerDiscoverScreen work?
    - Permissions: are channels the user can't access hidden or shown as locked?
  - Fix issues found inline.

- [ ] Audit and fix the NotificationInboxScreen:
  - Read `apps/mobile/src/screens/app/NotificationInboxScreen.tsx`
  - Check for:
    - Notification loading: do notifications load and paginate correctly?
    - Notification types: are different notification types (mention, reply, friend request, guild invite, etc.) rendered with appropriate icons and messaging?
    - Tap actions: does tapping a notification navigate to the correct screen (the message, the guild, the friend request, etc.)?
    - Mark as read: does marking notifications as read work? Does the badge count update in the tab bar?
    - Empty state: what shows when there are no notifications?
    - Pull-to-refresh: can the user refresh the notification list?
    - Real-time: do new notifications appear without refresh via socket events?
  - Fix issues found inline.

- [ ] Audit and fix the OnboardingScreen and first-run experience:
  - Read `apps/mobile/src/screens/onboarding/OnboardingScreen.tsx` and `apps/mobile/src/screens/onboarding/ThemePickerScreen.tsx`
  - Check for:
    - Onboarding flow: does it display correctly on first launch? Are the slides/pages complete?
    - Theme picker: does selecting a theme apply it immediately? Is the selection persisted?
    - Navigation: after onboarding completes, does the user land on the correct screen (Login if not authenticated, MainTabs if authenticated)?
    - Skip/dismiss: can the user skip onboarding? Does it not re-fire on subsequent launches?
    - Visual polish: are the onboarding illustrations/content polished and complete (no placeholder text)?
    - "No ads" and other brand pills mentioned in onboarding — are they present and rendering?
  - Fix issues found inline.

- [ ] Audit and fix the CreateGuildScreen and InviteAcceptScreen:
  - Read `apps/mobile/src/screens/app/CreateGuildScreen.tsx` and `apps/mobile/src/screens/app/InviteAcceptScreen.tsx`
  - Check for:
    - Create guild: full flow from name input → icon upload → creation → navigation to new guild
    - Invite accept: does the deep link `gratonite://invite/:code` work? Does it show guild preview info before accepting?
    - Error handling: what happens with invalid invite codes, expired invites, or guilds the user is already in?
    - Loading states during guild creation and invite acceptance
  - Fix issues found inline.

- [ ] Create a bug report document summarizing all findings:
  - Create `apps/mobile/Auto Run Docs/2026-03-13-Millie/Working/critical-path-audit-report.md` with YAML front matter:
    ```yaml
    ---
    type: report
    title: Critical Path Screen Audit Report
    created: 2026-03-13
    tags:
      - mobile
      - bug-audit
      - critical-path
    ---
    ```
  - List every bug found and fixed in this phase (with file path and line reference)
  - List any issues that couldn't be fixed because they require API changes or deeper investigation (tagged with `// MOBILE-POLISH:` comments in code)
  - List any screens that were clean with no issues
  - This report helps the user and future phases understand what was addressed
