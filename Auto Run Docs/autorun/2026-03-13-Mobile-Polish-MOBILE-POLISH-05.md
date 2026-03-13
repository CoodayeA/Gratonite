# Phase 05: Maestro Test Expansion & App Store Readiness

This is the final phase before App Store publication. It builds a comprehensive Maestro test suite to catch regressions, ensures Apple compliance requirements are met (privacy manifest, required error states), performs a performance pass, and prepares the final submission checklist. After this phase, the app should be ready for App Store review with confidence.

## Tasks

- [ ] Expand Maestro test suite to cover all critical user flows:
  - Read existing Maestro flows in `apps/mobile/flows/` (login.yaml, dm-flow.yaml, send-message.yaml, smoke.yaml, and forgot-password.yaml from Phase 01) to understand the pattern and test infrastructure
  - Create new Maestro flows for these critical paths:
    - `flows/register.yaml` — Register a new account (fill username, email, password, confirm password, tap register, verify navigation to VerifyEmail screen)
    - `flows/forgot-password.yaml` — If not created in Phase 01, create it now: navigate to Forgot Password from Login, fill email, submit, verify success state
    - `flows/navigation-tabs.yaml` — After login, tap each bottom tab (Guilds, Chats, Friends, Alerts) and verify each renders its expected content
    - `flows/guild-browse.yaml` — After login, tap a guild from the list, verify channel list loads, tap a text channel, verify chat screen loads
    - `flows/settings.yaml` — Navigate to Settings, verify all settings sections are accessible (tap into Account, Appearance, Notifications, etc.), verify back navigation works
    - `flows/friend-list.yaml` — Navigate to Friends tab, verify friend list loads, check that presence indicators are visible
    - `flows/profile-view.yaml` — Navigate to user profile (own profile from settings or friend's profile), verify profile data renders
  - Each flow should use environment variables for credentials (TEST_EMAIL, TEST_PASSWORD) matching the existing login.yaml pattern
  - Each flow should end with an assertion that confirms the screen rendered correctly

- [ ] Create a comprehensive smoke test that chains critical flows:
  - Read the existing `flows/smoke.yaml` to understand the composite flow pattern
  - Create `flows/full-regression.yaml` that runs these flows in sequence:
    - login.yaml → navigation-tabs.yaml → guild-browse.yaml → settings.yaml → friend-list.yaml
  - This becomes the single command to run before every TestFlight push: `npm run maestro:test -- flows/full-regression.yaml`
  - Add a script to `package.json`: `"maestro:regression": "maestro test flows/full-regression.yaml"`

- [ ] Add iOS Privacy Manifest (PrivacyInfo.xcprivacy):
  - Check if `apps/mobile/ios/` directory contains a `PrivacyInfo.xcprivacy` file. If not, create one.
  - Read the app's actual data usage to determine required privacy declarations:
    - **NSPrivacyTracking**: `false` (the app has no ads and no tracking)
    - **NSPrivacyTrackingDomains**: empty array
    - **NSPrivacyCollectedDataTypes**: declare what the app actually collects:
      - Email address (for account creation, linked to user identity)
      - User ID (for account functionality, linked to user identity)
      - If push notifications are used: device token
      - If crash reporting is used: crash data
    - **NSPrivacyAccessedAPITypes**: declare required reason APIs the app uses. Check the codebase for usage of:
      - `UserDefaults` / `NSUserDefaults` → reason `CA92.1` (app functionality)
      - `systemUptime` / `mach_absolute_time` → check if used
      - `diskSpace` → check if used
      - `activeKeyboards` → check if used
      - File timestamp APIs → check if used
    - Review Expo's documentation for their recommended PrivacyInfo.xcprivacy configuration, as Expo may include its own API usage that needs declaring
  - If using Expo's managed workflow, check if this is configured in `app.json` or `app.config.js` under the `ios.privacyManifests` key instead
  - Verify the privacy manifest is included in the Xcode project build

- [ ] Perform a performance audit and fix obvious bottlenecks:
  - Read through the heaviest screens (ChannelChatScreen at 1213 lines, DirectMessageScreen at 1061 lines) and check for:
    - **FlatList optimization**: are `keyExtractor`, `getItemLayout` (if items are fixed height), `maxToRenderPerBatch`, `windowSize`, and `removeClippedSubviews` configured? Missing these can cause scroll jank on long message lists.
    - **Memoization**: are expensive component renders wrapped in `React.memo()`? Are inline functions in render passed as stable callbacks via `useCallback`? Are expensive computations wrapped in `useMemo`?
    - **Image optimization**: is `expo-image` (or equivalent) used with proper caching for avatars and attachments? Are images loaded at appropriate resolutions (not loading full-size images for thumbnails)?
    - **Re-render prevention**: check if state updates cause unnecessary re-renders of the entire message list when only one message changes
    - **Memory leaks**: check for missing cleanup in useEffect (socket listeners, timers, subscriptions that aren't unsubscribed on unmount)
  - Apply fixes for any performance issues found. Focus on the chat screens — these are where performance matters most (long scrollable lists with rich content).

- [ ] Final build validation and TypeScript check:
  - Run `npx tsc --noEmit` from `apps/mobile/` to verify zero TypeScript errors across the entire mobile app
  - Run `npx expo-doctor` (if available) or `npx expo config --type introspect` to check for Expo configuration issues
  - Verify that all imports resolve correctly — no circular dependencies, no missing modules
  - Check that `app.json` / `app.config.js` has correct:
    - `version` and `ios.buildNumber` — ready to increment for next TestFlight push
    - `ios.bundleIdentifier` — matches the App Store Connect configuration
    - `ios.infoPlist` — any required keys (camera, microphone, photo library usage descriptions)
    - `ios.config.usesNonExemptEncryption` — set to `true` if E2E encryption is used (it is), with proper compliance documentation, OR `false` if the encryption qualifies for an exemption
  - Review the existing EAS build configuration for any issues

- [ ] Create the App Store submission checklist:
  - Create `apps/mobile/Auto Run Docs/2026-03-13-Millie/Working/app-store-checklist.md` with YAML front matter:
    ```yaml
    ---
    type: reference
    title: App Store Submission Checklist
    created: 2026-03-13
    tags:
      - mobile
      - app-store
      - submission
      - checklist
    ---
    ```
  - Include a comprehensive checklist covering:
    - [ ] Privacy manifest included and accurate
    - [ ] All required Info.plist usage descriptions present (camera, microphone, photos, notifications, location if used)
    - [ ] No placeholder content visible in the app
    - [ ] All screens handle errors gracefully (no crashes on API failure)
    - [ ] All screens handle empty states (no blank screens)
    - [ ] Login/Register/Forgot Password flow works completely
    - [ ] Age rating: appropriate content rating selected in App Store Connect
    - [ ] Export compliance: encryption declaration completed (E2E encryption in use)
    - [ ] App icon: present in all required sizes
    - [ ] Launch screen / splash screen: renders correctly
    - [ ] No references to "beta" or "test" in user-visible strings
    - [ ] No ads or ad frameworks (Gratonite is ad-free)
    - [ ] No Stripe / payment SDKs integrated (donations via BuyMeACoffee only, which is external)
    - [ ] Deep links work: gratonite:// URLs handled correctly
    - [ ] Push notifications: permission request at appropriate time (not on first launch)
    - [ ] Background modes: only what's needed (push notifications, audio for voice channels)
    - [ ] TypeScript compiles with zero errors
    - [ ] Maestro regression suite passes
    - [ ] Latest build uploaded to TestFlight and verified by at least one tester
  - This checklist is for the user's reference before hitting "Submit for Review" in App Store Connect
