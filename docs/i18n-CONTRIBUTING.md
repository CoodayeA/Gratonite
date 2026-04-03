# i18n contribution guide

## Locale files

- **Source of truth for keys:** `apps/web/src/i18n/locales/en.json`
- **Other locales:** `es.json`, `fr.json`, `de.json`, `pt.json`, `ja.json`, `zh.json`, `ko.json`, `ar.json`
- Keys are **flat** dotted strings (e.g. `common.save`).

## Check parity with English

From the **repository root**:

```bash
pnpm i18n:check
```

- Lists keys present in `en` but **missing** in other locales.
- Lists **extra** keys in a locale not in `en` (should be rare).

### Strict mode (CI)

```bash
pnpm i18n:check --strict
```

Exits with code **1** if any locale is missing keys compared to `en`. Use when you require full parity before merge.

## Adding a new locale

1. Copy `en.json` to `<code>.json`.
2. Translate values (keep keys identical).
3. Register the locale in `apps/web/src/i18n/index.ts` (`Locale` type, `AVAILABLE_LOCALES`, `loadLocale` / `staticTranslations` as appropriate).
4. Run `pnpm i18n:check --strict` and fix gaps.
5. Test RTL if applicable (`ar`) — see `applyDirection` in `apps/web/src/utils/rtl.ts`.

## Roadmap

Broader locale packs and community process are tracked in [ROADMAP.md](../ROADMAP.md) (Near-Term — i18n expansion).
