---
type: report
title: TypeScript Diagnostics
created: 2026-03-13
tags:
  - typescript
  - compilation
  - diagnostics
related:
  - '[[Bug-Inventory]]'
  - '[[test-results]]'
  - '[[eas-validation]]'
---

# TypeScript Diagnostics Report

## Summary

| Metric | Value |
|---|---|
| **Total Errors** | 5 |
| **Files with Errors** | 2 |
| **Compilation Status** | ❌ FAILED |

### Error Breakdown by File

| File | Error Count | Severity |
|---|---|---|
| `src/lib/cryptoPolyfill.ts` | 3 | Medium — type narrowing issue |
| `src/navigation/GuildDrawerNavigator.tsx` | 2 | Critical — screen component type mismatch |

---

## Errors by File

### `src/lib/cryptoPolyfill.ts` (3 errors)

All three errors are the same root cause: `ArrayBuffer | SharedArrayBuffer` is not assignable to `ArrayBuffer`.

**Error 1 — Line 201**
```
error TS2322: Type 'ArrayBuffer | SharedArrayBuffer' is not assignable to type 'ArrayBuffer'.
  Type 'SharedArrayBuffer' is missing the following properties from type 'ArrayBuffer':
  resizable, resize, detached, transfer, transferToFixedLength
```

**Error 2 — Line 216**
```
error TS2322: Type 'ArrayBuffer | SharedArrayBuffer' is not assignable to type 'ArrayBuffer'.
  Type 'SharedArrayBuffer' is missing the following properties from type 'ArrayBuffer':
  resizable, resize, detached, transfer, transferToFixedLength
```

**Error 3 — Line 228**
```
error TS2322: Type 'ArrayBuffer | SharedArrayBuffer' is not assignable to type 'ArrayBuffer'.
  Type 'SharedArrayBuffer' is missing the following properties from type 'ArrayBuffer':
  resizable, resize, detached, transfer, transferToFixedLength
```

**Root Cause:** The `cryptoPolyfill.ts` file returns buffer results from a Uint8Array `.buffer` property, which TypeScript 5.9 types as `ArrayBuffer | SharedArrayBuffer`. The receiving variable or return type expects plain `ArrayBuffer`.

**Suggested Fix:** Cast the `.buffer` result to `ArrayBuffer` explicitly (e.g., `result.buffer as ArrayBuffer`), or change the function return types to accept `ArrayBuffer | SharedArrayBuffer`. Since this is a crypto polyfill for React Native where `SharedArrayBuffer` is unlikely, a cast is safe.

**Estimated Complexity:** S (Small)

---

### `src/navigation/GuildDrawerNavigator.tsx` (2 errors)

Both errors are the same pattern: screen component type mismatch with the drawer navigator's expected `ScreenComponentType`.

**Error 4 — Line 688**
```
error TS2322: Type '({ route, navigation }: Props) => Element' is not assignable to
  type 'ScreenComponentType<ParamListBase, "ChannelChat"> | undefined'.
  Type '({ route, navigation }: Props) => Element' is not assignable to
    type 'FunctionComponent<{}>'.
    Types of parameters '__0' and 'props' are incompatible.
      Type '{}' is missing the following properties from type 'Props': navigation, route
```

**Error 5 — Line 695**
```
error TS2322: Type '({ route, navigation }: Props) => Element' is not assignable to
  type 'ScreenComponentType<ParamListBase, "VoiceChannel"> | undefined'.
  Type '({ route, navigation }: Props) => Element' is not assignable to
    type 'FunctionComponent<{}>'.
    Types of parameters '__0' and 'props' are incompatible.
      Type '{}' is missing the following properties from type 'Props': navigation, route
```

**Root Cause:** The inline `component` prop on `<Drawer.Screen>` is receiving a function that destructures `{ route, navigation }` from a custom `Props` type. React Navigation 7.x expects screen components to receive props via the generic param list, not through an explicit `Props` type that requires `navigation` and `route` as mandatory fields. The component signature is incompatible with `FunctionComponent<{}>`.

**Suggested Fix:** Either:
1. Remove the explicit `Props` type and let React Navigation inject `route`/`navigation` automatically via the screen component generics, or
2. Use the `children` render callback pattern instead of `component`, or
3. Wrap the component using a lambda in the `component` prop (though this causes re-mount on each render — not recommended).

**Estimated Complexity:** M (Medium) — requires understanding the navigation type setup across `types.ts` and the drawer navigator.

---

## Raw Compiler Output

```
src/lib/cryptoPolyfill.ts(201,7): error TS2322: Type 'ArrayBuffer | SharedArrayBuffer' is not assignable to type 'ArrayBuffer'.
  Type 'SharedArrayBuffer' is missing the following properties from type 'ArrayBuffer': resizable, resize, detached, transfer, transferToFixedLength
src/lib/cryptoPolyfill.ts(216,7): error TS2322: Type 'ArrayBuffer | SharedArrayBuffer' is not assignable to type 'ArrayBuffer'.
  Type 'SharedArrayBuffer' is missing the following properties from type 'ArrayBuffer': resizable, resize, detached, transfer, transferToFixedLength
src/lib/cryptoPolyfill.ts(228,7): error TS2322: Type 'ArrayBuffer | SharedArrayBuffer' is not assignable to type 'ArrayBuffer'.
  Type 'SharedArrayBuffer' is missing the following properties from type 'ArrayBuffer': resizable, resize, detached, transfer, transferToFixedLength
src/navigation/GuildDrawerNavigator.tsx(688,9): error TS2322: Type '({ route, navigation }: Props) => Element' is not assignable to type 'ScreenComponentType<ParamListBase, "ChannelChat"> | undefined'.
  Type '({ route, navigation }: Props) => Element' is not assignable to type 'FunctionComponent<{}>'.
    Types of parameters '__0' and 'props' are incompatible.
      Type '{}' is missing the following properties from type 'Props': navigation, route
src/navigation/GuildDrawerNavigator.tsx(695,9): error TS2322: Type '({ route, navigation }: Props) => Element' is not assignable to type 'ScreenComponentType<ParamListBase, "VoiceChannel"> | undefined'.
  Type '({ route, navigation }: Props) => Element' is not assignable to type 'FunctionComponent<{}>'.
    Types of parameters '__0' and 'props' are incompatible.
      Type '{}' is missing the following properties from type 'Props': navigation, route
```
