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
npm run maestro:login
npm run maestro:dm
npm run maestro:send-message
```

Runs individual flows from `flows/`.

## Existing Flows

- `flows/login.yaml`: signs in with the configured test account
- `flows/dm-flow.yaml`: opens the Chats tab and sends a DM if one exists
- `flows/send-message.yaml`: opens a server channel and sends a message
- `flows/smoke.yaml`: chains login and send-message together

## Recommended Bug Workflow

1. Reproduce the bug manually once on the simulator.
2. Record or write a Maestro flow for that path.
3. Add assertions for the expected behavior.
4. Keep the flow as a regression test after the fix lands.

## Notes

- The wrapper script at `scripts/maestro.sh` sets up `JAVA_HOME` for the locally installed Maestro CLI.
- If the app is not installed yet, launch it once with Xcode or `expo run:ios` before running the flows.
