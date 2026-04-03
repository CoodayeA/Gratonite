#!/usr/bin/env node
/**
 * tools/check-sw-precache.mjs
 *
 * Verifies that every URL listed in the STATIC_ASSETS constant inside
 * apps/web/public/sw.js resolves to a real file in the Vite build output
 * (apps/web/dist/).
 *
 * Run after `build:vite`:
 *   node tools/check-sw-precache.mjs
 *
 * Exits 1 if any precached asset is missing from the dist directory.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const SW_PATH = join(REPO_ROOT, 'apps', 'web', 'public', 'sw.js');
const DIST_DIR = join(REPO_ROOT, 'apps', 'web', 'dist');
const BASE_PATH = '/app/';

// ---------------------------------------------------------------------------
// Parse STATIC_ASSETS from sw.js (regex — keeps CI fast without a full parse)
// ---------------------------------------------------------------------------
const swSource = readFileSync(SW_PATH, 'utf8');
const match = swSource.match(/const STATIC_ASSETS\s*=\s*\[([^\]]+)\]/);
if (!match) {
  console.error('❌  Could not find STATIC_ASSETS in sw.js');
  process.exit(1);
}

const assets = match[1]
  .split(',')
  .map(s => s.trim().replace(/^['"]|['"]$/g, '').trim())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// Map URL paths to dist files
// ---------------------------------------------------------------------------
let failed = false;
for (const assetUrl of assets) {
  if (!assetUrl.startsWith(BASE_PATH)) {
    // Skip non-app paths (e.g. CDN fonts) — only check local assets
    continue;
  }

  // '/app/' → 'index.html', '/app/manifest.json' → 'manifest.json', etc.
  let relPath = assetUrl.slice(BASE_PATH.length) || 'index.html';
  const filePath = join(DIST_DIR, relPath);

  if (!existsSync(filePath)) {
    console.error(`❌  Precached asset missing in dist: ${assetUrl} → ${filePath}`);
    failed = true;
  } else {
    console.log(`✅  ${assetUrl}`);
  }
}

if (failed) {
  console.error('\nSW precache check failed — update STATIC_ASSETS in sw.js or add the missing file to public/.');
  process.exit(1);
} else {
  console.log('\nAll SW precache assets found in dist. ✓');
}
