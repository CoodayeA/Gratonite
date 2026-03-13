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

# App Store Submission Checklist

- [ ] Privacy manifest included and accurate
- [ ] All required `Info.plist` usage descriptions present for camera, microphone, photo library, and notifications
- [ ] No placeholder content visible in the app
- [ ] All screens handle errors gracefully with either toast recovery or a full-screen retry state
- [ ] All screens handle empty states with contextual messaging
- [ ] Login / Register / Forgot Password flow works end-to-end
- [ ] Age rating completed correctly in App Store Connect
- [ ] Export compliance completed correctly for Gratonite's encryption model
- [ ] App icon present in all required sizes
- [ ] Launch screen / splash screen renders correctly on device
- [ ] No user-visible references to beta, test, or internal-only wording
- [ ] No ads or ad frameworks are included
- [ ] No in-app Stripe or payment SDKs are included for digital goods
- [ ] Deep links work for `gratonite://` URLs, especially invite and password reset flows
- [ ] Push notification permission is requested at an appropriate time, not on first launch without context
- [ ] Background modes are limited to what the app actually needs
- [ ] TypeScript compiles cleanly with `npx tsc --noEmit`
- [ ] Expo / EAS config validated with `npx expo-doctor` or `npx expo config --type introspect`
- [ ] Maestro regression suite passes, including `flows/full-regression.yaml`
- [ ] Latest iOS build uploaded to TestFlight
- [ ] Latest iOS build verified by at least one human tester on device

## Notes For Current State

- The native iOS project already includes [PrivacyInfo.xcprivacy](/Volumes/Project%20BUS/GratoniteFinalForm/apps/mobile/ios/Gratonite/PrivacyInfo.xcprivacy), but it should be reviewed against Gratonite's actual collected data before final submission.
- [app.json](/Volumes/Project%20BUS/GratoniteFinalForm/apps/mobile/app.json) currently sets `usesNonExemptEncryption` to `false`; keep this aligned with the final App Store Connect export-compliance answers for the release build you submit.
- Maestro regression coverage now has a dedicated entry point in [package.json](/Volumes/Project%20BUS/GratoniteFinalForm/apps/mobile/package.json) via `npm run maestro:regression`.
