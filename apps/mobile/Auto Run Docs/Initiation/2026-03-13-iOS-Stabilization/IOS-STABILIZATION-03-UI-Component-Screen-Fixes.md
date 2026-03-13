# Phase 03: UI Component & Screen Fixes

This phase addresses the medium-severity iOS bugs across individual screens and shared components — the issues that make the app feel broken to testers even if it technically runs. Focus areas are keyboard handling, safe area compliance, list performance, and consistent loading/error states across the 80+ screens.

## Tasks

- [ ] Fix keyboard avoidance on all text input screens:
  - Read `Auto Run Docs/Initiation/Working/Bug-Inventory.md` for keyboard-related issues
  - The following screens have text inputs that need proper iOS keyboard avoidance:
    - `src/screens/guild/ChannelChatScreen.tsx` — main chat input
    - `src/screens/app/DirectMessageScreen.tsx` — DM chat input
    - `src/screens/guild/ThreadViewScreen.tsx` — thread reply input
    - `src/screens/auth/LoginScreen.tsx` and `RegisterScreen.tsx` — form inputs
    - `src/screens/app/FriendAddScreen.tsx` — search input
    - `src/screens/app/DMSearchScreen.tsx` — search input
    - `src/screens/app/GlobalSearchScreen.tsx` — search input
    - `src/screens/guild/ForumChannelScreen.tsx` — post creation
    - `src/screens/app/FeedbackScreen.tsx` — text area
  - For each screen, check if `KeyboardAvoidingView` (with `behavior="padding"` and `keyboardVerticalOffset` accounting for the navigation header height) is present
  - Search for existing keyboard handling patterns in the codebase first — reuse the same approach consistently
  - Also check for `<ScrollView keyboardShouldPersistTaps="handled">` on form screens to prevent tap-to-dismiss issues
  - Verify the bottom tab bar doesn't overlap the keyboard on chat screens

- [ ] Fix SafeArea and inset issues across screens:
  - Screens rendered inside the Stack Navigator already get safe area from the navigation header, but screens with `headerShown: false` or custom headers need manual safe area handling
  - Check these specific areas:
    - `MainTabs` in `AppNavigator.tsx` — the tab bar already uses `useSafeAreaInsets()` for bottom padding ✓
    - Modal screens (like `CommandPaletteScreen` with `presentation: 'modal'`) — verify top inset
    - The `OfflineBanner` component — should sit below the status bar, not under it
    - `OnboardingScreen` and `ThemePickerScreen` — rendered outside the navigation container, need full safe area
    - `AppLockScreen` — rendered as an overlay, needs safe area awareness
  - For any screen missing safe area handling, add `useSafeAreaInsets()` from `react-native-safe-area-context` and apply the appropriate padding
  - Use the pattern already established in `MainTabs` (reading `insets.bottom` for tab bar padding)

- [ ] Fix FlatList performance and rendering issues on list-heavy screens:
  - These screens render potentially long lists and need optimization:
    - `src/screens/app/GuildListScreen.tsx` — server list
    - `src/screens/app/DMListScreen.tsx` — DM conversation list
    - `src/screens/app/FriendsScreen.tsx` — friends list
    - `src/screens/app/NotificationInboxScreen.tsx` — notification feed
    - `src/screens/guild/GuildMemberListScreen.tsx` — member list
    - `src/screens/guild/AuditLogScreen.tsx` — audit log entries
    - `src/screens/guild/ThreadListScreen.tsx` — thread list
    - `src/screens/app/BookmarksScreen.tsx` — saved messages
  - For each list screen, ensure:
    - `keyExtractor` is set (use `item.id` or equivalent unique key)
    - `initialNumToRender` is set to a reasonable value (10-15)
    - `maxToRenderPerBatch` and `windowSize` are tuned for smooth scrolling
    - `removeClippedSubviews={true}` on iOS for large lists
    - List items are wrapped in `React.memo()` to prevent unnecessary re-renders
    - Empty state is shown when the list is empty (check for existing `EmptyState` component at `src/components/EmptyState.tsx`)
  - Search the codebase for existing `FlatList` optimization patterns and apply them consistently

- [ ] Fix loading states and error handling on data-fetching screens:
  - Ensure every screen that fetches data on mount has:
    - A loading skeleton or spinner while data loads (check for existing `ListSkeleton` component at `src/components/ListSkeleton.tsx` and `LoadingScreen` at `src/components/LoadingScreen.tsx`)
    - An error state with a retry button when the API call fails
    - Pull-to-refresh where appropriate (`onRefresh` + `refreshing` on FlatList/ScrollView)
  - Priority screens to check (highest user traffic):
    - `GuildListScreen`, `DMListScreen`, `FriendsScreen` — the main tab screens
    - `ChannelChatScreen`, `DirectMessageScreen` — the chat screens
    - `UserProfileScreen` — profile viewing
    - `SettingsScreen` — settings hub
  - Reuse the existing `LoadingScreen` and `ListSkeleton` components — don't create new loading patterns
  - Ensure API errors show user-friendly messages (not raw error codes) — check how `ApiRequestError` is caught and displayed

- [ ] Fix image loading and avatar display consistency:
  - The app uses both `expo-image` (the `Image` component from expo-image) and React Native's built-in `Image` — these should be unified to `expo-image` for better caching and performance on iOS
  - Search for `from 'react-native'` imports that include `Image` and replace with `import { Image } from 'expo-image'`
  - Check avatar display across these components:
    - `src/components/AvatarFrame.tsx` — the main avatar component
    - `src/components/MessageBubble.tsx` — message author avatars
    - `src/screens/app/UserProfileScreen.tsx` — profile avatar and banner
    - DM list items, friend list items, member list items
  - Ensure avatars have:
    - A placeholder/fallback when `avatarHash` is null (initials or default icon)
    - `contentFit="cover"` for proper aspect ratio
    - Appropriate `cachePolicy` for expo-image (`"memory-disk"` for avatars)
  - Check that banner images on profiles don't cause layout shifts while loading

- [ ] Fix gesture handler and scroll conflicts on nested scrollable screens:
  - These screens are known to have scroll conflicts on iOS:
    - `ChannelChatScreen` — inverted FlatList for messages + input bar + bottom sheet for reactions
    - `DirectMessageScreen` — same pattern as ChannelChatScreen
    - `GuildChannelsScreen` — channel list with categories (possibly nested ScrollViews)
    - `ForumChannelScreen` — post list with expandable content
    - `WikiChannelScreen` — wiki page content with embedded scrollable areas
  - For each, ensure:
    - No nested `ScrollView` inside `FlatList` without `nestedScrollEnabled={true}`
    - Bottom sheets from `@gorhom/bottom-sheet` have `enablePanDownToClose` and don't block the underlying scroll
    - Swipe-to-go-back gesture (iOS native) isn't blocked by horizontal gesture handlers
    - `react-native-draggable-flatlist` (used for reordering) properly handles gesture handoff
  - Check that `GestureHandlerRootView` in `App.tsx` wraps everything correctly (it does ✓ — just verify no screen adds a second one)

- [ ] Run TypeScript compilation and verify all UI fixes compile cleanly:
  - Execute `cd "/Volumes/Project BUS/GratoniteFinalForm/apps/mobile" && npx tsc --noEmit 2>&1`
  - Fix any new type errors introduced by the changes in this phase
  - Update `Auto Run Docs/Initiation/Working/Bug-Inventory.md` — mark resolved items as `[FIXED]`
