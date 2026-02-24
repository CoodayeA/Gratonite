# Beta SLO Targets

Date: 2026-02-22

## Core SLOs

1. Message send API success >= 99.9%
2. Attachment upload success >= 99.5%
3. Attachment render success >= 99.9%
4. Auth success (login/register) >= 99.9%
5. Websocket session stability >= 99.5%

## Latency Targets

1. Message send API p95 < 500ms
2. Upload API p95 < 2000ms
3. File fetch p95 < 700ms

## Alert Threshold Guidance

1. Trigger alert if 5-min error rate > 1% on core routes.
2. Trigger warning if p95 doubles baseline for 10+ minutes.
