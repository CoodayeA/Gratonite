# Web build experiments

Experiments are **real, opt-in behaviors** compiled into the web client via Vite environment variables.

## How to enable

1. In `apps/web/.env` or your deployment env, set `VITE_EXPERIMENT_<ID>=1` (see list in [`apps/web/src/lib/experiments.ts`](../../apps/web/src/lib/experiments.ts)).
2. Rebuild the web app (`pnpm --filter gratonite-web run build` or `dev`).

Example:

```bash
VITE_EXPERIMENT_VERBOSE_SOCKET_LOGS=1
```

## Where to see status

**Settings → Developer → Build experiments** shows each flag, its env key, and whether it is on in the current build.

## Implemented experiments

| ID | Behavior |
|----|----------|
| `verbose_socket_logs` | In **development**, logs Socket.IO event names and payloads to the browser console. |
| `reduced_motion_composer` | Adds a body class that minimizes CSS animations/transitions (accessibility / QA). |

There is no runtime toggle without a rebuild; this is intentional for predictable production bundles.
