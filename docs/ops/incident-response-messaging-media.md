# Incident Response: Messaging and Media

Date: 2026-02-22

## Scope

Message send/receive, typing, upload, attachment render, websocket delivery.

## Severity

1. P0: send path broken for broad user set
2. P1: major degradation in send/upload/render for many users
3. P2: isolated or partial degradation

## Immediate Actions

1. Freeze deploys.
2. Acknowledge incident owner + comms owner.
3. Check API error rate and websocket disconnect spikes.
4. Validate `POST /channels/:id/messages`, `POST /files/upload`, `GET /files/:hash`.
5. Execute rollback if P0/P1 persists.

## Resolution Checklist

1. Identify root cause category (app, API, storage, network, proxy).
2. Apply fix or rollback.
3. Re-run smoke checks.
4. Publish incident summary and follow-up tasks.
