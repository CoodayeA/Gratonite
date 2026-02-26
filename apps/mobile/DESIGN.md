# Gratonite iOS App — Native Rebuild Design Document

## Understanding Summary

- **What**: Fully native iOS app for Gratonite (Discord-like realtime communication platform) using Expo SDK 54 + React Native 0.81 + Apple Liquid Glass
- **Why**: Replace broken WebView wrapper with first-class iOS experience. App Store requires iOS 26 SDK by April 28, 2026. Liquid Glass requires native views.
- **Who**: Gratonite users on iPhone/iPad
- **Scope**: Full feature parity with web app (~30 screens, ~60+ API endpoints, realtime WebSocket, voice/video)
- **Non-goals**: Android (separate effort), new features beyond web parity, backend API changes (except push token endpoint)

## Tech Stack

- Expo SDK 54, React Native 0.81, React 19.1
- React Navigation (bottom tabs + stacks)
- Zustand (state management — ported from web)
- @tanstack/react-query (server state caching)
- Socket.IO client (realtime)
- @livekit/react-native (voice/video)
- expo-glass-effect (Liquid Glass)
- expo-notifications (APNs)
- expo-background-fetch + expo-task-manager
- @shopify/flash-list (message list performance)
- expo-image (fast cached images)
- expo-haptics (haptic feedback)
- expo-secure-store (token storage)

## Navigation Architecture

React Navigation: Native Tabs (Liquid Glass) + Stack navigators

```
RootNavigator
├── AuthStack (Login, Register, Verify, Setup)
└── MainTabs (Liquid Glass bottom tab bar)
    ├── Home (Friends, DM Chat, User Profile)
    ├── Portals (Guild List → Guild → Channel → Thread)
    ├── Discover (Server Browser)
    ├── Inbox (Notifications)
    └── You (Settings, Profile, Shop, Wallet, Leaderboard)
```

## Data Layer

Port ~80% from web app:
- All 11 Zustand stores (auth, messages, channels, guilds, members, presence, unread, voice, call, ui, search)
- API client (same endpoints, SecureStore for tokens)
- Socket.IO provider (same gateway events)
- React Query hooks

New native layers:
- Push notifications (APNs via expo-notifications)
- Background fetch (expo-task-manager)
- Audio (expo-av)
- Haptics (expo-haptics)

## Liquid Glass Integration

1. Bottom Tab Bar — automatic via React Navigation + iOS 26
2. Navigation Bars — automatic via stack headers
3. Message Composer — GlassView wrapper
4. Sheets & Modals — GlassView backgrounds
5. Voice Call Overlay — GlassView floating bar
6. Profile Cards — GlassView backgrounds
7. App Icon — .icon file via Icon Composer

## Implementation Phases

### Phase 1 — Foundation
1. Upgrade to Expo SDK 54
2. React Navigation (tabs + stacks)
3. Port Zustand stores + API client
4. Port Socket.IO provider
5. Auth flow screens
6. Liquid Glass tab bar shell

### Phase 2 — Core Chat
7. Friends list screen
8. DM list + DM chat (FlashList)
9. Message composer
10. Message actions (edit, delete, react, pin)
11. Typing indicators
12. Markdown rendering

### Phase 3 — Guilds
13. Guild list screen
14. Guild screen (channel list)
15. Channel screen
16. Thread screen
17. Member list
18. Guild settings

### Phase 4 — Voice & Video
19. Voice channel UI
20. DM voice/video calls (LiveKit)
21. Incoming call modal
22. Screen sharing

### Phase 5 — Social & Features
23. User profiles
24. Discover screen
25. Shop screen
26. Notifications screen
27. Leaderboard screen
28. Settings screens
29. Wallet & economy
30. Creator dashboard

### Phase 6 — Native Polish
31. Push notifications (APNs)
32. Background fetch
33. Haptic feedback
34. Liquid Glass icon
35. Deep linking
36. App Store submission

## Decision Log

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 1 | Fully native rebuild | WebView, Hybrid | Max polish + Liquid Glass needs native views |
| 2 | Expo SDK 54 | Bare RN, Expo 51 | iOS 26 SDK + Liquid Glass + EAS |
| 3 | Full feature parity | MVP, Chat+social | Complete experience |
| 4 | WS + APNs + background fetch | WS only | Most robust realtime for chat |
| 5 | Ship when ready | Fixed timeline | Quality first |
| 6 | React Navigation | Expo Router | More control, battle-tested |
| 7 | Native Tabs + Stack | Drawer | iOS-native, auto Liquid Glass |
| 8 | Drill-down for guilds | Sheet picker | Clean iOS pattern |
| 9 | FlashList | FlatList | 5-10x chat perf |
| 10 | Port Zustand from web | Rewrite | ~80% code reuse |
