#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const productionRoots = [
  path.join(repoRoot, 'apps', 'web', 'src'),
  path.join(repoRoot, 'apps', 'api', 'src'),
];

const skipDirNames = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '__tests__',
  '__mocks__',
  'mocks',
  'fixtures',
  'stories',
  'storybook',
  'docs',
  'test',
  'tests',
]);

const scanExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
]);

const patterns = [
  { id: 'coming_soon_literal', regex: /\bcoming soon\b/i, description: 'coming soon placeholder copy' },
  { id: 'simulation_literal', regex: /\b(simulated|simulation)\b/i, description: 'simulation marker in production code' },
  { id: 'fake_data_literal', regex: /\bfake (data|success|response|result|creator|id|ids)\b/i, description: 'fake-data marker in production code' },
  { id: 'mock_data_literal', regex: /\bmock data\b/i, description: 'mock-data marker in production code' },
  { id: 'mock_literal', regex: /\bmock\b/i, description: 'mock marker in production code' },
  { id: 'synthetic_success_literal', regex: /\bsynthetic success\b/i, description: 'synthetic-success marker in production code' },
  { id: 'local_only_fallback_literal', regex: /\blocal-only fallback\b/i, description: 'local-only fallback marker in production code' },
  { id: 'fallback_users_symbol', regex: /\bfallbackUsers\b/, description: 'fallback users array marker in production code' },
  { id: 'fallback_server_ratings_symbol', regex: /\bfallbackServerRatings\b/, description: 'fallback server ratings marker in production code' },
];

async function loadAllowlist() {
  const file = path.join(repoRoot, 'tools', 'placeholder-guard.allowlist.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function allowlistHit(allowlist, hit) {
  return allowlist.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    if (entry.id && entry.id !== hit.id) return false;
    if (entry.path && entry.path !== hit.path) return false;
    if (entry.lineContains && !hit.line.includes(entry.lineContains)) return false;
    return true;
  });
}

async function walk(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (skipDirNames.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, files);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (scanExtensions.has(ext)) files.push(full);
  }
  return files;
}

async function scanFile(filePath, allowlist) {
  const rel = path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const pattern of patterns) {
      if (!pattern.regex.test(line)) continue;
      const hit = {
        id: pattern.id,
        description: pattern.description,
        path: rel,
        lineNumber: i + 1,
        line: line.trim(),
      };
      if (!allowlistHit(allowlist, hit)) {
        hits.push(hit);
      }
    }
  }
  return hits;
}

async function main() {
  const allowlist = await loadAllowlist();
  const allFiles = [];
  for (const root of productionRoots) {
    try {
      await fs.access(root);
      const files = await walk(root);
      allFiles.push(...files);
    } catch {
      // Ignore missing roots so the guard still works in partial checkouts.
    }
  }

  const findings = [];
  for (const file of allFiles) {
    const fileHits = await scanFile(file, allowlist);
    findings.push(...fileHits);
  }

  if (findings.length === 0) {
    console.log('placeholder-guard: PASS (no blocked placeholder/simulation patterns found)');
    return;
  }

  console.error('placeholder-guard: FAIL');
  for (const finding of findings) {
    console.error(`- ${finding.path}:${finding.lineNumber} [${finding.id}] ${finding.description}`);
    console.error(`  ${finding.line}`);
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('placeholder-guard: ERROR');
  console.error(err);
  process.exitCode = 1;
});
