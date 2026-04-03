#!/usr/bin/env node
/**
 * tools/check-openapi-coverage.mjs
 *
 * Audits OpenAPI coverage by comparing:
 *   - Route prefixes registered in apps/api/src/routes/index.ts
 *   - Paths documented in docs/api/openapi.yaml
 *
 * Exits 1 if the documented path count is below MIN_PATHS (ratcheting threshold).
 *
 * Usage:
 *   node tools/check-openapi-coverage.mjs [--list-undocumented]
 */

import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

/** Minimum number of documented paths — ratchet up as coverage improves. */
const MIN_PATHS = 25;

// ---------------------------------------------------------------------------
// Parse documented paths from openapi.yaml (simple line-scan, no full parse)
// ---------------------------------------------------------------------------
const yamlPath = join(REPO_ROOT, 'docs', 'api', 'openapi.yaml');
const yamlSrc = readFileSync(yamlPath, 'utf8');

const documentedPaths = [];
for (const line of yamlSrc.split('\n')) {
  // Lines like "  /foo/bar:" under the "paths:" block
  const m = line.match(/^  (\/[^:]+):\s*$/);
  if (m) documentedPaths.push(m[1]);
}

// ---------------------------------------------------------------------------
// Parse registered route prefixes from routes/index.ts
// ---------------------------------------------------------------------------
const indexPath = join(REPO_ROOT, 'apps', 'api', 'src', 'routes', 'index.ts');
const indexSrc = readFileSync(indexPath, 'utf8');

const registeredPrefixes = [];
for (const line of indexSrc.split('\n')) {
  // Matches: router.use('/path', ...)  or  app.use('/path', ...)
  const m = line.match(/(?:router|app)\.use\(\s*['"`](\/[^'"`]+)['"`]/);
  if (m) registeredPrefixes.push(m[1]);
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const showUndocumented = process.argv.includes('--list-undocumented');

console.log(`\n📋 OpenAPI Coverage Report`);
console.log(`  Documented paths in openapi.yaml : ${documentedPaths.length}`);
console.log(`  Registered route prefixes        : ${registeredPrefixes.length}`);
console.log(`  Required minimum (threshold)     : ${MIN_PATHS}\n`);

if (showUndocumented) {
  console.log('Documented paths:');
  documentedPaths.forEach(p => console.log(`  ✅  ${p}`));

  console.log('\nRegistered route prefixes (not 1-to-1 with paths):');
  registeredPrefixes.forEach(p => console.log(`  📌  ${p}`));
}

if (documentedPaths.length < MIN_PATHS) {
  console.error(
    `\n❌  OpenAPI coverage too low: ${documentedPaths.length} paths documented, minimum is ${MIN_PATHS}.\n` +
    `   Add path entries to docs/api/openapi.yaml and bump MIN_PATHS in this script as coverage grows.\n`,
  );
  process.exit(1);
} else {
  console.log(`✅  Coverage OK: ${documentedPaths.length} ≥ ${MIN_PATHS} documented paths.\n`);
}
