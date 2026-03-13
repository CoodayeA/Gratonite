# Phase 01: Build Validation & Bug Discovery

This phase establishes the health baseline for the Gratonite mobile app. It runs TypeScript compilation, existing test suites, and performs a systematic code audit across all modified and new files to produce a structured bug inventory. By the end, you'll have a clear picture of every issue blocking a clean TestFlight build — organized by severity and category — plus validated EAS/App Store configuration.

## Tasks

- [ ] Run TypeScript compilation and capture all diagnostic errors:
  - Execute `cd "/Volumes/Project BUS/GratoniteFinalForm/apps/mobile" && npx tsc --noEmit 2>&1` and save the full output to `Auto Run Docs/Initiation/Working/ts-diagnostics.md`
  - Format the output as a markdown file with YAML front matter: `type: report`, `title: TypeScript Diagnostics`, `created: 2026-03-13`, `tags: [typescript, compilation, diagnostics]`
  - Group errors by file path, count total errors, and add a summary section at the top
  - If there are zero errors, note that compilation is clean

- [ ] Run the existing Jest test suite and capture results:
  - Execute `cd "/Volumes/Project BUS/GratoniteFinalForm/apps/mobile" && npx jest --no-coverage --forceExit 2>&1` and save the full output to `Auto Run Docs/Initiation/Working/test-results.md`
  - Format as markdown with YAML front matter: `type: report`, `title: Jest Test Results`, `created: 2026-03-13`, `tags: [tests, jest, baseline]`
  - Note which tests pass, which fail, and any test infrastructure issues (e.g. missing mocks, setup errors)
  - The existing tests are in `__tests__/api.test.ts` and `__tests__/VoiceContext.test.tsx`

- [ ] Validate EAS and App Store configuration for submission readiness:
  - Read `app.json`, `eas.json`, and `package.json` carefully
  - Check these App Store requirements and flag any issues:
    - `ios.bundleIdentifier` is set (`chat.gratonite.mobile` ✓)
    - `ios.buildNumber` is present and numeric (currently `"10"`)
    - `ios.config.usesNonExemptEncryption` is set to `false` (currently ✓)
    - `ios.infoPlist` has all required usage description strings for Camera, Microphone
    - `UIBackgroundModes` includes `audio` and `voip` (required for LiveKit voice)
    - `expo-notifications` plugin is present (for push notification entitlement)
    - Icon file `assets/icon.png` exists (1024×1024 required for App Store)
    - Splash screen is configured
    - `eas.json` has a `production` build profile with `distribution: "store"`
    - `eas.json` submit section has `ascAppId: "6759630780"`
    - `expo-updates` is configured with a valid `runtimeVersion` policy
    - Deep linking scheme `gratonite://` is registered
  - Save findings to `Auto Run Docs/Initiation/Working/eas-validation.md` with YAML front matter: `type: report`, `title: EAS & App Store Config Validation`, `created: 2026-03-13`, `tags: [eas, app-store, configuration, ios]`
  - Use `[[Bug-Inventory]]` wiki-link to reference the main inventory

- [ ] Audit all modified source files for iOS-specific bugs and common React Native issues:
  - Read through every file listed in `git status` as modified (`M` status) — there are ~85 modified files across `src/screens/`, `src/components/`, `src/contexts/`, `src/lib/`, and `src/navigation/`
  - For each file, check for these common iOS bug patterns:
    - **SafeArea issues**: Missing `useSafeAreaInsets()` or `SafeAreaView` on screens with content near edges
    - **Keyboard avoidance**: Input screens (chat, forms, search) missing `KeyboardAvoidingView` or `behavior="padding"` for iOS
    - **Gesture conflicts**: Nested `ScrollView`/`FlatList` without `nestedScrollEnabled`, gesture handler conflicts with navigation
    - **Memory leaks**: Missing cleanup in `useEffect` (unsubscribed listeners, uncancelled fetches)
    - **Navigation type mismatches**: Route params not matching `AppStackParamList` type definitions
    - **Theme usage**: Mixing `colors` from `src/lib/theme.ts` (the old static export) with `useTheme()` from `themeStore.ts` — the app has both, which causes inconsistency
    - **Undefined access**: Optional chaining missing on API response fields (e.g., `user.avatarHash` without `?.`)
    - **FlatList performance**: Missing `keyExtractor`, `getItemLayout`, or `windowSize` tuning on long lists
    - **Image loading**: `expo-image` vs `Image` from react-native — inconsistent usage
    - **Platform-specific behavior**: Missing `Platform.OS === 'ios'` guards where needed
  - Organize findings by file, noting the line range and severity (critical / high / medium / low)
  - This is a large audit — focus on the core paths first: `AuthContext.tsx`, `AppNavigator.tsx`, `socket.ts`, `api.ts`, `themeStore.ts`, then screens in order of user frequency (Login, Register, GuildList, DMList, ChannelChat, DirectMessage, Settings)

- [ ] Audit all new (untracked) source files for the same iOS bug patterns:
  - Read through every file listed in `git status` as untracked (`??` status) — there are ~80 new files across `src/screens/`, `src/components/`, `src/hooks/`, `src/lib/`, and `src/contexts/`
  - Apply the same bug pattern checklist from the previous task
  - Pay special attention to newly created screens that may lack consistent patterns (e.g., missing error boundaries, inconsistent header styling, missing loading states)
  - New files are more likely to have copy-paste issues or incomplete implementations — flag any TODO/FIXME/HACK comments found
  - Add findings to the same organized structure, clearly labeled as "new file" issues

- [ ] Generate the consolidated Bug Inventory document:
  - Create `Auto Run Docs/Initiation/Working/Bug-Inventory.md` combining all findings
  - Use YAML front matter: `type: report`, `title: Gratonite iOS Bug Inventory`, `created: 2026-03-13`, `tags: [bugs, ios, audit, triage]`
  - Add wiki-links: `[[ts-diagnostics]]`, `[[test-results]]`, `[[eas-validation]]`
  - Organize into these sections:
    1. **Executive Summary**: Total bug count, breakdown by severity, top 5 highest-impact issues
    2. **Critical (Blocks TestFlight)**: Type errors preventing compilation, crash-causing bugs, missing required iOS config
    3. **High (Blocks App Store Review)**: Privacy issues, missing permission strings, broken core flows
    4. **Medium (User-Facing Bugs)**: UI glitches, keyboard issues, theme inconsistencies, performance problems
    5. **Low (Polish)**: Minor visual issues, code style, non-blocking improvements
  - Each bug entry should include: file path, line range, description, suggested fix approach, estimated complexity (S/M/L)
  - Add a "Fix Priority Order" section at the bottom recommending the sequence for Phase 02 and 03
