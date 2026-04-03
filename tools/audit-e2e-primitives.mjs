#!/usr/bin/env node
/**
 * Verifies that documented E2E source files exist and prints a one-line summary.
 * Run from repo root: node tools/audit-e2e-primitives.mjs
 * Exit 0 always unless a required path is missing (then exit 1).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const required = [
  'apps/web/src/lib/e2e.ts',
  'apps/web/src/workers/crypto.worker.ts',
  'apps/mobile/src/lib/crypto.ts',
  'apps/mobile/src/hooks/useE2E.ts',
  'docs/crypto/e2e-primitives.md',
];

let ok = true;
for (const rel of required) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    console.error(`[audit-e2e] missing: ${rel}`);
    ok = false;
  }
}

if (!ok) {
  process.exit(1);
}

console.log('[audit-e2e] OK — primitives inventory present (see docs/crypto/e2e-primitives.md).');
