# Phase 04: UX Polish & Animation Pass

This phase elevates the app from "functional" to "polished." Every screen should feel intentional — smooth transitions, informative loading states, helpful empty states, graceful error recovery, and consistent interaction patterns. Apple reviewers notice these details, and so do users. This pass focuses on the patterns that make a chat app feel responsive and trustworthy: skeleton loaders instead of spinners, pull-to-refresh everywhere it makes sense, keyboard-aware scrolling, and safe area compliance on all device sizes.

## Tasks

- [ ] Implement consistent loading skeleton patterns across all list screens:
  - Read `apps/mobile/src/components/MessageSkeleton.tsx` and `apps/mobile/src/components/ListSkeleton.tsx` to understand existing skeleton patterns
  - Audit which screens currently use `ActivityIndicator` spinners for initial load — these should be upgraded to skeleton loaders for a more polished perceived-performance
  - Create a reusable `SkeletonRow` component (if one doesn't already exist) that can be configured for different row heights and layouts (avatar + text, text-only, card-style)
  - Apply skeleton loading to at minimum these high-traffic list screens:
    - DMListScreen — show skeleton conversation rows while loading
    - FriendsScreen — show skeleton friend rows while loading
    - GuildListScreen — show skeleton guild icons while loading
    - GuildChannelsScreen — show skeleton channel rows while loading
    - NotificationInboxScreen — show skeleton notification rows while loading
  - Keep the existing `ActivityIndicator` as a fallback for screens where skeletons would be overkill (settings toggles, simple detail views)

- [ ] Ensure every list screen has a meaningful empty state:
  - Read `apps/mobile/src/components/EmptyState.tsx` to understand the existing empty state component
  - Audit all screens that render FlatList/SectionList and check their `ListEmptyComponent`:
    - If missing entirely, add an `EmptyState` component with appropriate icon, title, and subtitle
    - If present but generic ("No items"), make it contextual and actionable:
      - DMListScreen empty: "No conversations yet" + "Start a chat with a friend" + action button
      - FriendsScreen empty: "No friends yet" + "Add friends by username" + link to FriendAddScreen
      - NotificationInboxScreen empty: "All caught up!" + friendly icon
      - BookmarksScreen empty: "No bookmarks" + "Long-press a message to bookmark it"
      - GuildChannelsScreen categories empty: handle gracefully
      - Search results empty: "No results for [query]" + suggestions
    - Ensure empty states are themed correctly (use textSecondary, textMuted colors)
  - This task covers ALL list screens across the app, not just the ones listed above — use the list above as examples of the quality bar

- [ ] Add consistent error states and retry patterns:
  - Audit screens for error handling patterns. The current pattern uses `toast.error()` which is good for inline errors, but screens that fail to load entirely should show a full-screen error state with a retry button.
  - Create or verify a reusable `ErrorState` component (icon + error message + "Try Again" button) if one doesn't exist
  - Apply full-screen error state to screens where the initial data load fails completely:
    - If a screen's `useEffect` fetch fails and there's no cached data, show ErrorState instead of an empty screen
    - The "Try Again" button should re-trigger the fetch
  - Ensure that transient errors (network blip during a send) use toast notifications, while persistent errors (screen can't load at all) use the ErrorState component
  - Add offline handling: read `apps/mobile/src/components/OfflineBanner.tsx` and verify it shows when the device is offline. Screens should gracefully degrade — show cached data if available, show offline message if not.

- [ ] Add pull-to-refresh to all appropriate screens:
  - Audit all FlatList/ScrollView screens for `refreshControl` / `onRefresh` support
  - Add pull-to-refresh to any list screen that fetches data from the API but doesn't already support it. Key screens:
    - DMListScreen, FriendsScreen, NotificationInboxScreen, GuildChannelsScreen
    - ForumChannelScreen, ThreadListScreen, WikiChannelScreen
    - ShopScreen, MarketplaceScreen, InventoryScreen
    - AuditLogScreen, GuildMemberListScreen
  - Use the existing `refreshing` state pattern seen throughout the codebase: `const [refreshing, setRefreshing] = useState(false)` with `RefreshControl`
  - Ensure the refresh spinner uses the theme's accent color

- [ ] Fix keyboard handling and scroll behavior across input screens:
  - Audit screens with text inputs (chat screens, create/edit screens, search screens, settings forms) for:
    - `KeyboardAvoidingView` — ensure it's wrapping content on screens with bottom-positioned inputs (especially ChannelChatScreen, DirectMessageScreen where the message input is at the bottom)
    - `keyboardDismissMode` on ScrollViews — should be "interactive" or "on-drag" for natural dismissal
    - Input focus: when tapping an input field, the keyboard should not obscure the input. The screen should scroll/shift to keep the focused input visible.
    - Platform differences: `KeyboardAvoidingView` behavior should be "padding" on iOS (check if this is already configured correctly)
  - Test key screens:
    - ChannelChatScreen / DirectMessageScreen — message input must stay above keyboard
    - ForgotPasswordScreen / ResetPasswordScreen (from Phase 01) — form inputs must not be hidden by keyboard
    - CreateGuildScreen, ChannelCreateScreen, FormCreateScreen — multi-field forms must scroll with keyboard
    - GlobalSearchScreen, DMSearchScreen — search input interaction

- [ ] Add subtle animations and transitions for a polished feel:
  - Read `apps/mobile/src/components/AnimatedListItem.tsx` and `apps/mobile/src/components/PressableScale.tsx` to understand existing animation patterns
  - Review what animation library is available (react-native-reanimated is in dependencies)
  - Add/improve animations in these high-visibility areas:
    - Tab bar transitions: ensure smooth cross-fade between tabs (verify this works with React Navigation's default animation)
    - List item entrance: use `AnimatedListItem` for staggered list entrance animations on key screens (FriendsScreen, DMListScreen, NotificationInboxScreen) if not already applied
    - Screen transitions: verify React Navigation's stack animations are smooth (should be using native driver by default with native-stack)
    - Button feedback: ensure all interactive elements use `PressableScale` or similar touch feedback (no "dead" tap areas)
    - Message sending: add a subtle send animation or haptic feedback when sending a message (check if `haptics.ts` is already called)
    - Toasts: verify toast notifications animate in/out smoothly
  - Do NOT over-animate — the goal is subtle polish, not flashy effects. Match Discord/iMessage level of restraint.

- [ ] Ensure safe area compliance and responsive layout on all device sizes:
  - Verify that all screens use `SafeAreaView` or `useSafeAreaInsets()` correctly:
    - No content hidden behind the notch/Dynamic Island on modern iPhones
    - No content hidden behind the home indicator bar at the bottom
    - Tab bar screens: content should not overlap with the bottom tab bar
    - Modal/sheet screens: verify `@gorhom/bottom-sheet` respects safe areas
  - Check edge cases:
    - Landscape orientation: if the app supports landscape, verify screens don't break. If it's portrait-only, verify orientation is locked in app.json/Info.plist.
    - Large text / accessibility font sizes: verify screens don't completely break with larger system font sizes (they don't need to be perfect, but shouldn't crash or become unusable)
    - iPad: if the app runs on iPad (universal binary), check that screens scale reasonably. If iPad isn't supported, verify it's excluded in the build config.
