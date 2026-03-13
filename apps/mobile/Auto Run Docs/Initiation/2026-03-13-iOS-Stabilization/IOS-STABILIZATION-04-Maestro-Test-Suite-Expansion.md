# Phase 04: Maestro Test Suite Expansion

This phase builds out the Maestro E2E test suite from the current 4 flows to comprehensive coverage of the app's critical paths. Each new flow serves double duty: it's a regression test for CI and a one-click reproduction tool for bug reports. The existing flows (`login.yaml`, `dm-flow.yaml`, `send-message.yaml`, `smoke.yaml`) establish the pattern — we'll extend that pattern to cover settings, guild management, profile editing, search, and onboarding.

## Tasks

- [ ] Create Maestro flows for the Settings navigation path:
  - Read the existing flows in `flows/` to match the established YAML style and `appId` convention
  - Create `flows/settings-navigation.yaml`:
    - Prerequisite: user is logged in (start with `runFlow: login.yaml`)
    - Navigate to Settings: tap the user avatar or settings gear (check `SettingsScreen.tsx` for the entry point — likely from a tab or header button)
    - Assert the Settings screen is visible with key sections
    - Navigate into each settings sub-screen and assert it loads:
      - Account, Appearance, Notifications, Privacy, Sessions, Muted Users, Sound, App Lock, Security
    - Navigate back to Settings after each sub-screen
    - Return to the main tab screen
  - Use `accessibilityLabel` or `testID` attributes where available — check the screen source code for existing `testID` props
  - Add `optional: true` on taps that depend on dynamic content (user data, toggles)

- [ ] Create Maestro flows for guild (portal) creation and management:
  - Create `flows/guild-create.yaml`:
    - Start from the Portals tab (already visible after login)
    - Tap "Create Portal" button (check `GuildListScreen.tsx` for the button label/testID)
    - Fill in portal name: "Maestro Test Portal"
    - Submit the form
    - Assert the new portal appears or the guild channels screen loads
    - Note: This creates real data on the API — add a comment noting cleanup may be needed
  - Create `flows/guild-settings.yaml`:
    - Navigate into an existing portal (tap first guild item)
    - Open portal settings (check `GuildSettingsScreen.tsx` entry point)
    - Assert key settings sections are visible (General, Roles, Channels, Moderation)
    - Navigate back cleanly
  - Both flows should be independent (each starts from login or assumes logged-in state)

- [ ] Create Maestro flows for user profile and friends:
  - Create `flows/profile-view.yaml`:
    - Navigate to the Friends tab
    - If a friend exists, tap on them to view their profile
    - Assert the profile screen loads with username visible
    - Navigate back to Friends tab
    - Use `optional: true` for friend-dependent assertions
  - Create `flows/friend-add.yaml`:
    - Navigate to Friends tab
    - Tap "Add Friend" button (check `FriendsScreen.tsx` for the button)
    - Assert the search/add friend screen loads
    - Type a search query
    - Navigate back without completing (to avoid side effects)

- [ ] Create Maestro flows for search and bookmarks:
  - Create `flows/global-search.yaml`:
    - From the main tabs, navigate to Global Search (check how it's accessed — likely a header icon or dedicated entry)
    - Type a search query: "test"
    - Wait for results to appear (use `assertVisible` with a timeout)
    - Navigate back
  - Create `flows/bookmarks.yaml`:
    - Navigate to Bookmarks/Saved Messages screen
    - Assert the screen loads (may show empty state or saved messages)
    - Navigate back

- [ ] Create Maestro flow for the onboarding and theme picker:
  - Create `flows/onboarding.yaml`:
    - This flow tests the first-launch experience
    - It should NOT use `login.yaml` as a prerequisite since onboarding happens before login
    - Launch the app fresh (use `clearState: true` or `clearKeychain: true` if supported)
    - Assert the theme picker screen appears
    - Tap a theme option
    - Tap continue/done
    - Assert the onboarding slides appear
    - Swipe through or tap through the onboarding
    - Assert the login screen appears
    - Note: This flow may need `launchApp` with `clearState` to reset SecureStore flags — check Maestro docs for the correct syntax

- [ ] Create a comprehensive regression suite flow:
  - Create `flows/regression.yaml` that chains the critical flows together:
    ```yaml
    appId: chat.gratonite.mobile
    ---
    - runFlow: login.yaml
    - runFlow: send-message.yaml
    - runFlow: dm-flow.yaml
    - runFlow: settings-navigation.yaml
    - runFlow: global-search.yaml
    - runFlow: profile-view.yaml
    ```
  - Add a corresponding npm script to `package.json`:
    - `"maestro:regression": "./scripts/maestro.sh test flows/regression.yaml"`
  - This single flow should exercise all major app paths in sequence
  - Keep the total runtime under 3 minutes to encourage frequent use

- [ ] Add testID props to critical interactive elements across screens:
  - The existing Maestro flows reference `id: "email-input"`, `id: "password-input"`, `id: "guild-item"`, `id: "channel-item"`, `id: "dm-item"` — verify these `testID` props actually exist in the corresponding components
  - Check and add `testID` props to these key interactive elements:
    - `LoginScreen.tsx`: email input, password input, sign-in button
    - `RegisterScreen.tsx`: username input, email input, password input, register button
    - `GuildListScreen.tsx`: each guild list item (`guild-item`), create portal button
    - `DMListScreen.tsx`: each DM list item (`dm-item`)
    - `ChannelChatScreen.tsx`: message input, send button
    - `DirectMessageScreen.tsx`: message input, send button
    - `SettingsScreen.tsx`: each settings row
    - `FriendsScreen.tsx`: add friend button, each friend item
  - Use a consistent naming convention: `kebab-case` (e.g., `testID="guild-item"`, `testID="send-button"`)
  - Only add `testID` where it's missing — don't duplicate existing ones

- [ ] Verify all Maestro flows parse correctly:
  - Run `cd "/Volumes/Project BUS/GratoniteFinalForm/apps/mobile" && npx tsc --noEmit 2>&1` to ensure testID additions don't break types
  - Verify each new YAML flow file has valid syntax by checking for common issues:
    - Correct `appId: chat.gratonite.mobile` header
    - Proper YAML indentation
    - `runFlow` paths are relative and correct
    - All referenced `id:` values match actual `testID` props in the code
  - Note: Actually running Maestro requires a booted simulator with the app installed — document this prerequisite but don't block on it
