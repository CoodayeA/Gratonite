#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const ignoredDeployDirs = [
  '/deploy/api/',
  '/deploy/web/dist/',
  '/deploy/landing/',
];

const allowedTrackedDeployEntries = [
  'deploy/api/drizzle.config.ts',
  'deploy/api/package.json',
  'deploy/api/pnpm-lock.yaml',
  'deploy/api/drizzle/',
];

const mirrorPairs = [
  ['apps/api/drizzle.config.ts', 'deploy/api/drizzle.config.ts'],
  ['apps/api/package.json', 'deploy/api/package.json'],
  ['apps/api/pnpm-lock.yaml', 'deploy/api/pnpm-lock.yaml'],
  ['apps/api/drizzle', 'deploy/api/drizzle'],
];

function repoPath(...segments) {
  return path.join(repoRoot, ...segments);
}

function isAllowedTrackedDeployEntry(filePath) {
  return allowedTrackedDeployEntries.some((allowedPath) => (
    allowedPath.endsWith('/') ? filePath.startsWith(allowedPath) : filePath === allowedPath
  ));
}

function readTrackedFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--', 'deploy/api', 'deploy/web/dist', 'deploy/landing'],
    { cwd: repoRoot, encoding: 'utf8' },
  );

  return output.split('\0').filter(Boolean);
}

function compareFiles(sourceRelativePath, mirrorRelativePath) {
  const sourcePath = repoPath(sourceRelativePath);
  const mirrorPath = repoPath(mirrorRelativePath);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourceRelativePath}`);
  }
  if (!existsSync(mirrorPath)) {
    throw new Error(`Missing deploy mirror: ${mirrorRelativePath}`);
  }

  const sourceContents = readFileSync(sourcePath);
  const mirrorContents = readFileSync(mirrorPath);
  if (!sourceContents.equals(mirrorContents)) {
    throw new Error(`${mirrorRelativePath} has drifted from ${sourceRelativePath}`);
  }
}

function compareDirectories(sourceRelativePath, mirrorRelativePath) {
  const sourcePath = repoPath(sourceRelativePath);
  const mirrorPath = repoPath(mirrorRelativePath);

  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source directory: ${sourceRelativePath}`);
  }
  if (!existsSync(mirrorPath)) {
    throw new Error(`Missing deploy mirror directory: ${mirrorRelativePath}`);
  }

  const sourceEntries = readdirSync(sourcePath).sort();
  const mirrorEntries = readdirSync(mirrorPath).sort();

  if (sourceEntries.join('\n') !== mirrorEntries.join('\n')) {
    throw new Error(`${mirrorRelativePath} does not match ${sourceRelativePath} entry-for-entry`);
  }

  for (const entry of sourceEntries) {
    const nextSourceRelativePath = path.posix.join(sourceRelativePath, entry);
    const nextMirrorRelativePath = path.posix.join(mirrorRelativePath, entry);
    const nextSourcePath = repoPath(nextSourceRelativePath);
    const nextSourceStat = statSync(nextSourcePath);
    if (nextSourceStat.isDirectory()) {
      compareDirectories(nextSourceRelativePath, nextMirrorRelativePath);
    } else {
      compareFiles(nextSourceRelativePath, nextMirrorRelativePath);
    }
  }
}

try {
  const gitignorePath = repoPath('.gitignore');
  const gitignore = readFileSync(gitignorePath, 'utf8');
  const missingIgnoreRules = ignoredDeployDirs.filter((entry) => !gitignore.includes(entry));
  if (missingIgnoreRules.length > 0) {
    throw new Error(`.gitignore is missing deploy staging ignores: ${missingIgnoreRules.join(', ')}`);
  }

  const trackedFiles = readTrackedFiles();
  const unexpectedTrackedFiles = trackedFiles.filter((filePath) => !isAllowedTrackedDeployEntry(filePath));
  if (unexpectedTrackedFiles.length > 0) {
    throw new Error(
      `Unexpected tracked deploy artifacts detected:\n${unexpectedTrackedFiles.map((filePath) => `  - ${filePath}`).join('\n')}`,
    );
  }

  for (const [sourceRelativePath, mirrorRelativePath] of mirrorPairs) {
    const sourcePath = repoPath(sourceRelativePath);
    if (statSync(sourcePath).isDirectory()) {
      compareDirectories(sourceRelativePath, mirrorRelativePath);
    } else {
      compareFiles(sourceRelativePath, mirrorRelativePath);
    }
  }

  console.log('deploy artifact hygiene: PASS');
  console.log('  - ignored staging directories are still protected in .gitignore');
  console.log('  - only canonical deploy/api mirrors remain tracked');
  console.log('  - deploy/api tracked mirrors match apps/api ownership exactly');
} catch (error) {
  console.error('deploy artifact hygiene: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
