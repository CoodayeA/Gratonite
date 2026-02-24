# Voice Browser Reliability Checklist

Date: 2026-02-21
Scope: Final manual validation for Phase C voice/browser reliability.

## Browsers

1. Chrome (latest stable)
2. Safari (latest stable on macOS)
3. Zen Browser (latest stable)

## Test Cases

1. Voice channel join with first-time permission prompt.
2. Voice channel join after previously denied permission (retry flow).
3. Join with microphone available, camera blocked (should still join voice).
4. Change microphone device while connected.
5. Start/stop camera while connected.
6. Start/stop screen share while connected.
7. Leave and rejoin same voice channel.
8. Join after device unplug/replug (devicechange path).

## Pass Criteria

1. No uncaught UI errors.
2. Clear user-facing error message for permission/device failures.
3. Mic-only join works even when camera access fails.
4. Recovery actions (retry, device switch) work without full page refresh.
