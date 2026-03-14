# Maestro Testing

Maestro is the fastest way to do repeatable iOS simulator bug sweeps for Gratonite.

## Prerequisites

- A booted iOS Simulator
- The Gratonite app installed on that simulator
- Test credentials exported as environment variables

## Test Credentials

```sh
export MAESTRO_EMAIL="your-test-account@example.com"
export MAESTRO_PASSWORD="your-test-password"
```

The login flow reads those values at runtime. Credentials are not stored in the repo.

For the register flow, also export:
```sh
export MAESTRO_REGISTER_USERNAME="test-user-123"
export MAESTRO_REGISTER_EMAIL="register-test@example.com"
export MAESTRO_REGISTER_PASSWORD="TestPass123!"
```

## Commands

From `/Volumes/Project BUS/GratoniteFinalForm/apps/mobile`:

```sh
npm run maestro:studio
```

Opens Maestro Studio for interactive flow authoring and debugging.

```sh
npm run maestro:smoke
```

Runs the basic login plus channel message smoke flow.

```sh
npm run maestro:regression
```

Runs the full regression suite (all critical paths chained together).

```sh
npm run maestro:login
npm run maestro:dm
npm run maestro:send-message
```

Runs individual flows from `flows/`.

## Existing Flows

### Auth
- `flows/login.yaml`: Signs in with the configured test account
- `flows/register.yaml`: Fills out the registration form and submits
- `flows/forgot-password.yaml`: Opens forgot-password screen and submits a reset request
- `flows/session-restore.yaml`: Launches the app and verifies a persisted session loads without re-login

### DM / Chats
- `flows/dm-flow.yaml`: Opens the Chats tab and sends a DM if one exists
- `flows/dm-list-ordering.yaml`: Opens the Chats tab and verifies the DM list renders
- `flows/dm-search.yaml`: Navigates to the DM search screen and performs a search

### Guild / Server
- `flows/guild-browse.yaml`: Opens first guild and first channel (basic)
- `flows/guild-channel-list.yaml`: Opens first guild and asserts channel list renders
- `flows/channel-chat-send.yaml`: Opens a guild channel and sends a message with verification
- `flows/join-guild.yaml`: Navigates to Server Discover and verifies the join UI renders
- `flows/send-message.yaml`: Opens a server channel and sends a message

### Threads
- `flows/thread-open.yaml`: Long-presses a message to open a thread view
- `flows/thread-reply.yaml`: Opens a thread and sends a reply message

### Settings
- `flows/settings.yaml`: Opens Settings and navigates Account, Appearance, Notifications, Privacy, Security
- `flows/settings-subscreens.yaml`: Extended settings walk — includes Sound, Sessions, and Muted Users

### Notifications
- `flows/notification-inbox.yaml`: Opens the Alerts tab and verifies notification inbox renders

### Admin / Guild Management
- `flows/guild-settings.yaml`: Opens guild settings and verifies key admin sections (Members, Roles, Bans)
- `flows/role-management.yaml`: Navigates to the Roles screen from guild settings

### Navigation
- `flows/navigation-tabs.yaml`: Cycles through all four bottom tabs (Portals, Chats, Friends, Alerts)
- `flows/friend-list.yaml`: Opens the Friends tab and verifies it renders
- `flows/profile-view.yaml`: Opens Settings > Account and checks Display Name / Bio fields

### Composite
- `flows/smoke.yaml`: Chains login and send-message together
- `flows/full-regression.yaml`: Chains all critical-path flows into one run

## Recommended Bug Workflow

1. Reproduce the bug manually once on the simulator.
2. Record or write a Maestro flow for that path.
3. Add assertions for the expected behavior.
4. Keep the flow as a regression test after the fix lands.

## Notes

- The wrapper script at `scripts/maestro.sh` sets up `JAVA_HOME` for the locally installed Maestro CLI.
- If the app is not installed yet, launch it once with Xcode or `expo run:ios` before running the flows.
- Flows that depend on existing data (threads, DMs) use `optional: true` to avoid hard failures on empty accounts.
- Thread flows use `longPressOn` on message bubbles — these require at least one message in the channel.
