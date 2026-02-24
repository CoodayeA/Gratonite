# Design Token Architecture + Shareable Theme Manifest

Date: 2026-02-21
Owner: Engineering + Design
Status: Draft for implementation in WEB-016

## Goals

1. Create one token contract that works on web, desktop, and mobile.
2. Enable safe user customization and theme sharing.
3. Keep component styling deterministic and testable.

## Token Layer Model

1. Core tokens (raw values):
   - color scale, spacing scale, radius scale, typography scale, blur, shadow, motion durations/easing
2. Semantic tokens (purpose-driven):
   - `surface/*`, `text/*`, `border/*`, `action/*`, `status/*`, `focus/*`
3. Component tokens (component-specific):
   - `button/*`, `input/*`, `sidebar/*`, `composer/*`, `message/*`, `modal/*`
4. Runtime state tokens:
   - hover/active/selected/disabled/focus-visible

## Required Platform Outputs

1. Web/Desktop:
   - CSS custom properties generated from semantic + component tokens
2. Mobile:
   - Typed token map exported as JSON/TS for React Native style usage
3. Shared:
   - Stable token key naming and versioning policy

## Naming Convention

Use slash-separated namespaces:

1. `core/color/neutral/900`
2. `semantic/surface/base`
3. `semantic/text/primary`
4. `component/button/primary/background`
5. `component/sidebar/item/active-bg`

## Theme Manifest Contract

Each shared theme is a manifest with metadata + token overrides.

```json
{
  "version": "1.0.0",
  "themeId": "aurora-glass-01",
  "name": "Aurora Glass",
  "author": {
    "userId": "123456789012345678",
    "displayName": "Ferdinand"
  },
  "description": "High-clarity glass theme with cool accent rail.",
  "tags": ["glass", "cool", "high-contrast"],
  "compatibility": {
    "minAppVersion": "0.1.0",
    "tokenSchemaVersion": "2.0.0"
  },
  "settings": {
    "density": "comfortable",
    "motion": "normal",
    "cornerStyle": "rounded",
    "glassIntensity": 0.72
  },
  "overrides": {
    "semantic/surface/base": "#0a0f1a",
    "semantic/surface/raised": "rgba(17, 26, 43, 0.78)",
    "semantic/text/primary": "#f1f6ff",
    "component/button/primary/background": "linear-gradient(120deg, #5fd7ff, #ffcf6a)"
  }
}
```

## Validation Rules

1. Reject unknown top-level fields.
2. Reject overrides for non-whitelisted token keys.
3. Enforce type-safe token value formats:
   - color: hex/rgb/hsl
   - number ranges: blur, opacity, radius, spacing multipliers
   - enum values: density/motion/cornerStyle
4. Enforce contrast checks for critical semantic pairs:
   - `text/primary` vs `surface/base`
   - `text/muted` vs `surface/raised`
5. Reject embedded script/custom CSS in shared payloads.

## Runtime Theme Resolution Order

1. Base system theme (default theme pack)
2. User selected theme preset
3. User local adjustments
4. Workspace-level override (if enabled)
5. Temporary preview override (editor mode)

## Feature Flag Plan

1. `ui_v2_tokens`: enables token v2 resolution path.
2. `ui_v2_shell`: enables redesigned shell components.
3. `ui_theme_sharing`: enables export/import/publish UI.

## Testing Requirements

1. Unit tests:
   - parser/validator for manifest schema
   - token resolution order
2. Integration tests:
   - apply theme and verify CSS variable updates
   - import/export round-trip determinism
3. Visual regression:
   - default theme + at least 2 shared theme packs across critical screens
4. Accessibility checks:
   - contrast and focus visibility in every theme pack

## Implementation Notes

1. Place token definitions in `apps/web/src/theme/tokens-v2.ts`.
2. Create `apps/web/src/theme/resolveTheme.ts` for merge + validation flow.
3. Expose CSS vars in `apps/web/src/styles.css` under `:root[data-theme-v2="true"]`.
4. Keep old tokens active until `ui_v2_shell` is default-on.
