# Enterprise Batch 6 Integration Notes

**Stripe:** Real-money Stripe integration was **removed**. Gratonite uses in-game currency and shop flows only; there is no `/payments` API or `stripe_*` tables (see migration `0001_drop_stripe_tables.sql`).

The sections below are **historical** notes for metrics, sockets, and other batch-6 items. Ignore any references to `paymentsRouter`, `stripe` schema, or Stripe npm packages.

---

## 1. `routes/index.ts` (historical)

Payments router is not mounted. Metrics and other endpoints may still apply as documented elsewhere in the codebase.

---

## 2. `schema/index.ts` (historical)

`export * from './stripe'` has been removed.

---

## 3. Request duration middleware

See current [`index.ts`](../index.ts) for `httpRequestDuration` wiring.

---

## 4–8. Metrics, messages, socket, npm

Refer to the live codebase; prom-client and metrics are integrated in the API. Do not add `stripe` or `@stripe/*` packages.

---

## 9. Env vars (Stripe — obsolete)

Do not set `STRIPE_*` or `VITE_STRIPE_*` for Gratonite core.

---

## 10. Migrations

Run `node dist/db/migrate.js` after deploy as usual; journal includes `0001_drop_stripe_tables` for existing databases that still had Stripe tables.
