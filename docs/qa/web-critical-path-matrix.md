# Web Critical Path Matrix

Last updated: 2026-02-21
Owner: Web Team

This matrix defines the minimum user journeys that must pass before any web release candidate can ship.

## P0 Flows (must pass every run)

| ID | Area | Scenario | Expected Result |
|---|---|---|---|
| WEB-CP-001 | Auth | Register with valid credentials | User account created and redirected to authenticated shell |
| WEB-CP-002 | Auth | Login with valid credentials | Session established and persisted across refresh |
| WEB-CP-003 | Auth | Logout | Session cleared and user returned to login screen |
| WEB-CP-004 | Navigation | Open guild -> channel route | Correct channel loads with message history |
| WEB-CP-005 | Messaging | Send message in guild channel | Message appears locally and after refresh |
| WEB-CP-006 | Messaging | Edit own message | Updated content appears in list and remains after refresh |
| WEB-CP-007 | Messaging | Delete own message | Message removed and state stays consistent after refresh |
| WEB-CP-008 | Realtime | Two clients in same channel | Message sent from Client A appears on Client B in near-real-time |
| WEB-CP-009 | Reactions | Add/remove reaction | Reaction counts update correctly in active channel |
| WEB-CP-010 | Threads | Open/create thread from message | Thread panel opens and thread messages load/send correctly |

## P1 Flows (required for release candidate sign-off)

| ID | Area | Scenario | Expected Result |
|---|---|---|---|
| WEB-CP-011 | Search | Search channel messages | Search results load and navigate to target message |
| WEB-CP-012 | Pins | Open pinned panel in guild channel | Panel loads pinned messages and navigation works |
| WEB-CP-013 | Settings | Update appearance preference | Setting persists after navigation + refresh |
| WEB-CP-014 | Settings | Update DND schedule | Save succeeds and values reload correctly |
| WEB-CP-015 | Presence | Typing indicator in active channel | Typing state appears and clears correctly |
| WEB-CP-016 | DM | Send message in DM | Message flow behaves like guild messaging path |
| WEB-CP-017 | Media | Upload image in channel/DM | Image appears in realtime without refresh |
| WEB-CP-018 | Media | Attachment URL safety | No loopback host dependency (`localhost`/`127.0.0.1`) for rendered attachments |

## Browser Coverage

The critical-path suite must run at minimum on:
- Chrome (latest stable)
- Firefox (latest stable)
- Safari (latest stable macOS)
- Edge (latest stable)

## Exit Criteria

- Zero failing P0 flows.
- Zero open P0/P1 release defects.
- P1 flows pass in at least one full run on all supported browsers before launch.
