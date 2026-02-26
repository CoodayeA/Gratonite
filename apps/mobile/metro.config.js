const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// ── pnpm monorepo support ────────────────────────────────────────────
// pnpm uses symlinks into a .pnpm virtual store. Metro needs to:
// 1. Watch the workspace root (where .pnpm store lives) so symlinks resolve
// 2. Know where to find node_modules
// 3. Have explicit fallback mappings for packages that can't be found
//    through normal resolution from inside the .pnpm store

// Watch the entire workspace so Metro can follow pnpm symlinks
config.watchFolders = [workspaceRoot];

// Resolve from both project and workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Enable symlink support (Metro >= 0.79)
config.resolver.unstable_enableSymlinks = true;

// Explicit fallback: map every package in project node_modules
// so Metro can find them when resolving from deep inside .pnpm
const projectNodeModules = path.resolve(projectRoot, 'node_modules');
const extraNodeModules = {};
for (const entry of fs.readdirSync(projectNodeModules)) {
  if (entry.startsWith('.')) continue;
  if (entry.startsWith('@')) {
    const scopeDir = path.join(projectNodeModules, entry);
    for (const pkg of fs.readdirSync(scopeDir)) {
      extraNodeModules[`${entry}/${pkg}`] = path.join(scopeDir, pkg);
    }
  } else {
    extraNodeModules[entry] = path.join(projectNodeModules, entry);
  }
}
config.resolver.extraNodeModules = extraNodeModules;

// Note: EXPO_NO_METRO_WORKSPACE_ROOT=1 must be set when running `expo start`
// to prevent Metro from resolving the entry point from the monorepo root.

module.exports = config;
