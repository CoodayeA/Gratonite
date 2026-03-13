# Phase 05: TestFlight Build & App Store Readiness

This phase takes the stabilized app through the final steps to a TestFlight build and App Store submission. It covers iOS privacy manifest compliance (required since iOS 17), App Transport Security, EAS build execution, and the pre-submission checklist that prevents common Apple review rejections. By the end, you'll have a production EAS build submitted to TestFlight.

## Tasks

- [ ] Add the iOS Privacy Manifest (`PrivacyInfo.xcprivacy`) required by Apple:
  - Since iOS 17, Apple requires all apps to declare their data collection and API usage via a privacy manifest
  - Create the privacy manifest as an Expo plugin or config plugin entry
  - Check if Expo SDK 55 handles this automatically via `expo-updates` or another plugin — search the Expo docs and `node_modules/expo/` for `PrivacyInfo`
  - If manual creation is needed, create `ios/PrivacyInfo.xcprivacy` with:
    - `NSPrivacyAccessedAPITypes`: Declare usage of UserDefaults (`NSPrivacyAccessedAPICategoryUserDefaults`), file timestamp APIs if used, and disk space APIs if used
    - `NSPrivacyCollectedDataTypes`: Declare what user data the app collects (email for account, device token for push notifications, usage data for analytics if any)
    - `NSPrivacyTracking`: `false` (the app doesn't appear to use tracking)
    - `NSPrivacyTrackingDomains`: empty array
  - Verify the manifest is included in the Xcode project's build phases (Expo's prebuild should handle this)
  - Reference: Apple's documentation at https://developer.apple.com/documentation/bundleresources/privacy_manifest_files

- [ ] Verify and harden App Transport Security configuration:
  - Read `app.json` iOS config section for any `NSAppTransportSecurity` entries
  - The app communicates with `https://api.gratonite.chat` — this is HTTPS, so ATS is satisfied ✓
  - Check `src/lib/api.ts` for any HTTP (non-HTTPS) URLs that would fail ATS:
    - The `API_BASE` is `https://api.gratonite.chat/api/v1` ✓
    - Check for any development-only `http://` URLs left in comments or conditional code
  - Check LiveKit WebRTC configuration — LiveKit uses WebSocket (`wss://`) which is fine
  - If any HTTP exceptions are needed for development, ensure they're NOT in the production build (use environment-based config)
  - Verify `expo-image` doesn't load any HTTP images — avatar and media URLs from the API should all be HTTPS

- [ ] Validate all required iOS permission strings and entitlements:
  - Read `app.json` and verify every permission string is:
    - Present and non-empty
    - Descriptive enough for Apple review (generic strings like "This app needs camera access" get rejected)
    - Consistent with actual app usage
  - Required permission strings for Gratonite:
    - `NSCameraUsageDescription` — "Allow Gratonite to access your camera for video calls." ✓
    - `NSMicrophoneUsageDescription` — "Allow Gratonite to access your microphone for voice channels." ✓
    - `NSPhotoLibraryUsageDescription` — for `expo-image-picker` (check if the plugin config adds this)
    - `NSFaceIDUsageDescription` — for `expo-local-authentication` (App Lock feature) — verify this is set
    - `NSUserTrackingUsageDescription` — NOT needed since we don't track
  - Verify entitlements:
    - Push Notifications entitlement (added by `expo-notifications` plugin)
    - `UIBackgroundModes`: `audio`, `voip` (already set ✓) — verify these match actual capability usage
  - If any permission strings are missing, add them to `app.json` `ios.infoPlist`

- [ ] Review and bump version numbers for the TestFlight build:
  - Current version in `app.json`: `"version": "1.0.0"`, `"buildNumber": "10"`
  - The `eas.json` has `"autoIncrement": true` for production builds, which will auto-bump `buildNumber`
  - Verify `appVersionSource` is set to `"local"` in `eas.json` (it is ✓) — this means `app.json` is the source of truth
  - No changes needed if this is continuing from buildNumber 10 — EAS will increment to 11
  - If a clean version bump is desired, update `app.json`:
    - Keep `version` at `"1.0.0"` for the initial App Store release
    - The `buildNumber` will auto-increment via EAS

- [ ] Create an App Store pre-submission checklist document:
  - Create `Auto Run Docs/Initiation/Working/App-Store-Checklist.md` with YAML front matter:
    - `type: reference`, `title: App Store Submission Checklist`, `created: 2026-03-13`, `tags: [app-store, testflight, submission, ios]`
  - Add wiki-links: `[[Bug-Inventory]]`, `[[eas-validation]]`
  - Include these checklist sections:
    1. **App Store Connect Setup**: App record exists (ASC App ID: 6759630780 ✓), app name, subtitle, category (Social Networking), age rating
    2. **Screenshots**: Required sizes for iPhone 6.7" (1290×2796), iPhone 6.5" (1242×2688), and optionally iPad
    3. **App Icon**: 1024×1024 PNG without alpha channel — verify `assets/icon.png` meets this spec
    4. **Privacy Policy URL**: Required for apps with user accounts — needs to be a live URL
    5. **App Review Information**: Demo account credentials for the reviewer, contact info, notes explaining chat features
    6. **Export Compliance**: `usesNonExemptEncryption: false` is set ✓ — but the app uses `@noble/ciphers` for E2E encryption which IS encryption — this may need to be `true` with an ERN exemption or declaration
    7. **Content Rights**: The app allows user-generated content — explain moderation features
    8. **Sign in with Apple**: Not required since the app doesn't use any third-party social login — but verify
  - Flag any items that need user action (screenshots, privacy policy URL, review credentials) as `[ACTION REQUIRED]`

- [ ] Trigger an EAS production build for iOS and document the process:
  - Before building, ensure all changes from Phases 01-04 are committed:
    - Run `git add -A && git status` to see what's staged
    - Create a commit: `git commit -m "chore: stabilize iOS app for TestFlight (Phases 01-04)"`
  - Trigger the EAS build:
    - Run `cd "/Volumes/Project BUS/GratoniteFinalForm/apps/mobile" && npx eas-cli build --platform ios --profile production --non-interactive 2>&1`
    - If `eas-cli` is not installed globally, try `npx eas build --platform ios --profile production --non-interactive`
    - Capture the build URL from the output
    - If the build fails, capture the error log and document the fix needed
  - Note: This requires an authenticated EAS session (`eas login`) and valid Apple Developer credentials configured in EAS. If not authenticated, document the steps needed:
    1. `eas login` with Expo account
    2. Apple Developer credentials (can be provided via `EXPO_APPLE_ID` and `EXPO_APPLE_PASSWORD` env vars or interactive login)
    3. App Store Connect API key (preferred for CI) or Apple ID with app-specific password
  - Save the build status and URL to `Auto Run Docs/Initiation/Working/Build-Status.md`

- [ ] Submit the successful build to TestFlight:
  - After the EAS build succeeds (check build status at the URL from previous step):
    - Run `cd "/Volumes/Project BUS/GratoniteFinalForm/apps/mobile" && npx eas-cli submit --platform ios --profile production --non-interactive 2>&1`
    - This uses the `ascAppId: "6759630780"` from `eas.json` to target the correct App Store Connect record
  - If submission fails due to missing credentials or configuration:
    - Document the exact error and the fix
    - Common issues: missing ASC API key, build not found, compliance questionnaire not answered
  - After successful submission:
    - The build will appear in App Store Connect → TestFlight within 15-30 minutes
    - Apple's automated review (beta app review) takes 24-48 hours
    - Document the TestFlight build number and submission timestamp
  - If this step can't complete non-interactively (requires Apple credential input), document the manual steps clearly so the user can finish the submission
