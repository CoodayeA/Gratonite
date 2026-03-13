# Phase 02: Core Infrastructure Fixes

This phase addresses the highest-severity bugs found during the Phase 01 audit — the issues that block TypeScript compilation, cause crashes, or break core user flows (authentication, navigation, real-time messaging, and theming). Fixing these first ensures the app can actually build and the critical paths work before we touch individual screens.

## Tasks

- [ ] Fix all TypeScript compilation errors blocking the build:
  - Read `Auto Run Docs/Initiation/Working/ts-diagnostics.md` for the full error list from Phase 01
  - Fix type errors in order of dependency (types/index.ts first, then lib/, then contexts/, then navigation/, then screens/)
  - Common patterns to look for and fix:
    - Missing type exports in `src/types/index.ts` that new screens depend on
    - Navigation parameter type mismatches between `src/navigation/types.ts` (AppStackParamList) and actual screen usage
    - Incorrect import paths for new files that were added but not wired up correctly
    - Generic type parameter issues with React Navigation hooks (`useRoute`, `useNavigation`)
  - After fixes, run `npx tsc --noEmit` to verify zero errors remain
  - Do NOT change any runtime behavior — only fix type-level issues

- [ ] Fix authentication flow issues in AuthContext and related modules:
  - Read `src/contexts/AuthContext.tsx`, `src/lib/api.ts`, and `src/lib/crypto.ts`
  - Review the Bug Inventory (`Auto Run Docs/Initiation/Working/Bug-Inventory.md`) for auth-related issues
  - Common auth issues to fix:
    - Token refresh race conditions (multiple 401s triggering parallel refresh attempts)
    - `loadTokens()` not awaited before first API call after app foreground resume
    - Login/register error handling: ensure `ApiRequestError` details are surfaced to the user (not swallowed)
    - `clearKeyPairFromSecureStore()` and `clearCacheEncryptionKey()` — ensure logout fully clears state
    - The `useEffect` auto-idle logic references stale `user.status` via closure — needs a ref or callback pattern
  - Search for any existing patterns in the codebase before creating new solutions
  - Test: After fixes, the login → fetch user → connect socket → navigate to main tabs flow should work without errors in the console

- [ ] Fix navigation and deep linking issues:
  - Read `src/navigation/AppNavigator.tsx`, `src/navigation/GuildDrawerNavigator.tsx`, and `src/navigation/types.ts`
  - Review the Bug Inventory for navigation-related issues
  - Common navigation issues to fix:
    - Route parameter type mismatches: ensure every `navigation.navigate('ScreenName', { ... })` call across all screens matches the `AppStackParamList` definition
    - Missing screens: verify every screen imported in `AppNavigator.tsx` actually exists and exports a default component
    - Deep link config: the `linking` object in `App.tsx` maps `gratonite://invite/:code` etc. — verify these params match the type definitions
    - Back navigation: ensure no screen creates a navigation loop (e.g., navigating to a screen that auto-navigates back)
    - The `GuildDrawerNavigator` — verify drawer gestures don't conflict with native iOS back swipe
  - After fixes, verify the navigation tree renders without warnings

- [ ] Fix socket connection and real-time messaging issues:
  - Read `src/lib/socket.ts` and review the Bug Inventory for socket-related issues
  - Common socket issues to fix:
    - Socket reconnection after app returns from background: `connectSocket()` in `App.tsx`'s `AppState` listener may race with `AuthContext`'s own socket management
    - Duplicate socket connections: both `App.tsx` (ThemedApp) and `AuthContext` call `connectSocket()` — ensure only one connection is active
    - Socket auth: verify the socket passes the current `accessToken` and handles token refresh
    - Event listener cleanup: ensure socket event handlers are properly removed on unmount
    - Typing indicator events: verify `sendTyping()` is debounced and doesn't fire excessively
  - After fixes, verify: connect → receive message → send message → disconnect → reconnect works cleanly

- [ ] Fix theme system inconsistencies between old and new APIs:
  - The app has TWO theme systems that need to be reconciled:
    - `src/lib/theme.ts` — older static export (`colors`, `useTheme` from this file)
    - `src/lib/themeStore.ts` — newer reactive store (`useTheme`, `useColors`, `useNeo`, `useGlass`)
  - Read both files, then search the entire `src/` directory for imports from each:
    - `grep -r "from.*lib/theme'" src/` (old static)
    - `grep -r "from.*lib/themeStore'" src/` (new reactive)
  - The goal is to ensure all screens use the reactive `themeStore` version consistently
  - Fix any screens/components that import from the old `theme.ts` to use `themeStore.ts` instead
  - Verify the neobrutalism and glassmorphism theme variants (which use `neo` and `glass` extras) don't crash when those extras are `null` on standard themes
  - After fixes, switching themes in Settings → Appearance should update all visible UI immediately without restart

- [ ] Run TypeScript compilation and Jest tests to verify all core fixes:
  - Execute `cd "/Volumes/Project BUS/GratoniteFinalForm/apps/mobile" && npx tsc --noEmit 2>&1`
  - Verify zero TypeScript errors (or document any remaining non-critical ones)
  - Execute `cd "/Volumes/Project BUS/GratoniteFinalForm/apps/mobile" && npx jest --no-coverage --forceExit 2>&1`
  - If tests fail due to changes in this phase, fix the tests to match the new behavior
  - Update `Auto Run Docs/Initiation/Working/Bug-Inventory.md` — mark resolved items as `[FIXED]` and note any new issues discovered during fixes
