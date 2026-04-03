#!/usr/bin/env node
/**
 * Compare apps/web i18n locale JSON files to en.json (key parity).
 * Usage: node tools/check-i18n-parity.mjs [--strict]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'apps', 'web', 'src', 'i18n', 'locales');

const strict = process.argv.includes('--strict');

function loadJson(name) {
  const path = join(localesDir, name);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function keySet(obj) {
  return new Set(Object.keys(obj));
}

const en = loadJson('en.json');
const enKeys = keySet(en);

const files = readdirSync(localesDir).filter((f) => f.endsWith('.json') && f !== 'en.json');

let hasProblems = false;

console.log('i18n parity (vs en.json)\n');
console.log(`Reference key count: ${enKeys.size}\n`);

for (const file of files.sort()) {
  const locale = loadJson(file);
  const keys = keySet(locale);
  const missing = [...enKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !enKeys.has(k));

  if (missing.length === 0 && extra.length === 0) {
    console.log(`${file}: OK (${keys.size} keys)`);
    continue;
  }

  hasProblems = true;
  console.log(`${file}:`);
  if (missing.length) {
    console.log(`  missing vs en: ${missing.length}`);
    missing.slice(0, 25).forEach((k) => console.log(`    - ${k}`));
    if (missing.length > 25) console.log(`    ... and ${missing.length - 25} more`);
  }
  if (extra.length) {
    console.log(`  extra (not in en): ${extra.length}`);
    extra.slice(0, 15).forEach((k) => console.log(`    + ${k}`));
    if (extra.length > 15) console.log(`    ... and ${extra.length - 15} more`);
  }
  console.log('');
}

if (hasProblems && strict) {
  console.error('i18n:check --strict FAILED: fix missing keys or update en.json intentionally.');
  process.exit(1);
}

if (!hasProblems) {
  console.log('All locales match en key set.');
}

process.exit(0);
