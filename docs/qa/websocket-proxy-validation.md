# Websocket Proxy Validation (Production)

Date: 2026-02-22

## Goal

Confirm reverse proxy and network path support stable Socket.IO websocket upgrades.

## Validation Steps

1. Open app in two clients on production domain.
2. Verify websocket connection established (browser devtools network: `ws` upgraded).
3. Force reconnect (toggle network) and verify auto-recovery.
4. Send DM and guild messages after reconnect; confirm realtime delivery.
5. Confirm typing indicators still propagate.

## Proxy Requirements

1. Preserve `Upgrade` and `Connection` headers.
2. Preserve `X-Forwarded-*` headers for origin/proto handling.
3. Support sticky behavior or shared Redis fanout for multi-instance API.

## Failure Signals

1. Frequent connect/disconnect loops.
2. Polling fallback only with failed websocket upgrade.
3. Delayed or missing realtime events while HTTP API remains healthy.

## Remediation

1. Recheck proxy websocket config and timeout values.
2. Verify CORS allowlist includes `app.<domain>`.
3. Validate Redis pub/sub connectivity for multi-instance fanout.

