#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const gitignorePath = path.join(repoRoot, '.gitignore');
const deployScriptPath = path.join(repoRoot, 'deploy', 'deploy.sh');

function fail(message) {
  console.error(`deploy-artifact-hygiene: FAIL - ${message}`);
  process.exit(1);
}

function gitLsFiles(...args) {
  return execFileSync('git', ['ls-files', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

if (!existsSync(gitignorePath)) fail('missing .gitignore');
if (!existsSync(deployScriptPath)) fail('missing deploy/deploy.sh');

const gitignore = readFileSync(gitignorePath, 'utf8');
for (const ignoredPath of ['/deploy/api/', '/deploy/web/dist/', '/deploy/landing/']) {
  if (!gitignore.includes(ignoredPath)) {
    fail(`.gitignore must ignore ${ignoredPath}`);
  }
}

const forbiddenTracked = gitLsFiles('deploy/web/dist', 'deploy/landing')
  .split('\n')
  .filter(Boolean);
if (forbiddenTracked.length > 0) {
  fail(`generated deploy output is tracked: ${forbiddenTracked.join(', ')}`);
}

const deployScript = readFileSync(deployScriptPath, 'utf8');
for (const sourceRef of ['apps/api/dist', 'apps/api/drizzle', 'apps/web/dist', 'apps/landing/out']) {
  if (!deployScript.includes(sourceRef)) {
    fail(`deploy/deploy.sh must package from ${sourceRef}`);
  }
}

console.log('deploy-artifact-hygiene: PASS');
