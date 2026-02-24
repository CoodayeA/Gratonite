# Bug Inbox Triage Workflow (Beta)

Route: `https://gratonite.chat/ops/bugs`

## Status Flow

1. `open` -> new/unreviewed
2. `triaged` -> reproducible or clarified
3. `resolved` -> fixed and verified after deploy
4. `dismissed` -> duplicate/invalid/unreproducible

## Beta Triage Priorities

1. Auth/login/email verification/MFA failures
2. Messaging/realtime failures
3. Media upload/render failures
4. Voice/video/screenshare failures
5. Moderation/permission leaks
6. Major UI dead-ends

## Daily Triage Loop

1. Open `/ops/bugs` and filter `open`
2. Reproduce and classify severity (`P0`..`P3`)
3. Move to `triaged` with notes in external tracker/PR if applicable
4. Re-test after deploy and set `resolved`
5. Dismiss duplicates with cross-reference note

## Required Repro Data

1. Route/URL
2. Device + browser
3. Timestamp
4. Screenshot/video
5. Repro after hard refresh? (`yes/no`)
6. API health status at time of issue
