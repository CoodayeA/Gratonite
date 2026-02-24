# Monitoring Panel Spec

Date: 2026-02-22

## Panels

1. API request rate + error rate by endpoint.
2. API p50/p95 latency for message/upload/file endpoints.
3. Socket connect/disconnect counts and reasons.
4. File delivery status code breakdown for `/api/v1/files/:hash`.
5. Auth success/failure rates.

## Required Filters

1. environment
2. region/host
3. route/event
4. release version
