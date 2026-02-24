# Web Visual Regression Plan

Last updated: 2026-02-21  
Owner: Web Team

## Coverage targets

1. Home server gallery
2. Guild shell (sidebar/topbar)
3. Message list + composer
4. Settings (profiles/appearance/avatar studio/economy)

## Implementation notes

1. Use Playwright screenshot baselines on Chromium first.
2. Add snapshot update workflow before CI gate enablement.
3. Start as non-blocking in CI, then promote to blocking after baseline stability.

## Pre-beta requirement

1. At least one visual baseline run on modernized surfaces with no unexplained diffs.
