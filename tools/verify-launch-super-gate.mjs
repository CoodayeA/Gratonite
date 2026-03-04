#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function run(cmd, args, label) {
  process.stdout.write(`\n[super-gate] ${label}\n`);
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });
  if (result.status !== 0) {
    process.stderr.write(`[super-gate] FAILED: ${label}\n`);
    process.exit(result.status ?? 1);
  }
}

function readScripts(packagePath) {
  const fullPath = path.join(repoRoot, packagePath);
  try {
    const json = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    return json?.scripts ?? {};
  } catch {
    return {};
  }
}

const rootScripts = readScripts('package.json');
const webScripts = readScripts(path.join('apps', 'web', 'package.json'));
const apiScripts = readScripts(path.join('apps', 'api', 'package.json'));

const requiredChecks = [
  { cmd: 'npm', args: ['--prefix', 'apps/web', 'run', 'verify:prod'], label: 'web verify:prod' },
  { cmd: 'pnpm', args: ['--dir', 'apps/api', 'run', 'verify:release'], label: 'api verify:release' },
  { cmd: 'npm', args: ['--prefix', 'apps/web', 'run', 'smoke:e2e'], label: 'web smoke:e2e' },
  { cmd: 'npm', args: ['run', 'verify:release:all'], label: 'root verify:release:all' },
];

for (const check of requiredChecks) {
  run(check.cmd, check.args, check.label);
}

const optionalCandidates = [
  { scripts: webScripts, scriptName: 'load:test', cmd: 'npm', args: ['--prefix', 'apps/web', 'run', 'load:test'], label: 'web load:test' },
  { scripts: webScripts, scriptName: 'test:load', cmd: 'npm', args: ['--prefix', 'apps/web', 'run', 'test:load'], label: 'web test:load' },
  { scripts: apiScripts, scriptName: 'load:test', cmd: 'pnpm', args: ['--dir', 'apps/api', 'run', 'load:test'], label: 'api load:test' },
  { scripts: apiScripts, scriptName: 'test:load', cmd: 'pnpm', args: ['--dir', 'apps/api', 'run', 'test:load'], label: 'api test:load' },
  { scripts: webScripts, scriptName: 'verify:security', cmd: 'npm', args: ['--prefix', 'apps/web', 'run', 'verify:security'], label: 'web verify:security' },
  { scripts: apiScripts, scriptName: 'verify:security', cmd: 'pnpm', args: ['--dir', 'apps/api', 'run', 'verify:security'], label: 'api verify:security' },
  { scripts: rootScripts, scriptName: 'verify:security', cmd: 'npm', args: ['run', 'verify:security'], label: 'root verify:security' },
];

for (const candidate of optionalCandidates) {
  if (typeof candidate.scripts[candidate.scriptName] !== 'string') {
    process.stdout.write(`[super-gate] SKIP: ${candidate.label} (script not present)\n`);
    continue;
  }
  run(candidate.cmd, candidate.args, candidate.label);
}

process.stdout.write('\n[super-gate] PASS\n');
