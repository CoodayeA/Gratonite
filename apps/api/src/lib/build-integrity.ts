/**
 * lib/build-integrity.ts — Self-verification of build artifacts on startup.
 * Compares dist files against a .build-manifest.json embedded during CI build.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

interface BuildManifest {
  buildTime: string;
  files: Record<string, string>; // filepath -> sha256 hash
}

/**
 * Validate build integrity by comparing dist files against the embedded manifest.
 * Logs warnings for any mismatches but does not prevent startup.
 */
export function validateBuildIntegrity(): void {
  const manifestPath = path.join(__dirname, '..', '.build-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.info('[build-integrity] No build manifest found (dev mode or first build). Skipping check.');
    return;
  }

  try {
    const manifest: BuildManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    let mismatches = 0;

    for (const [filePath, expectedHash] of Object.entries(manifest.files)) {
      const fullPath = path.join(__dirname, '..', filePath);

      if (!fs.existsSync(fullPath)) {
        console.warn(`[build-integrity] MISSING: ${filePath}`);
        mismatches++;
        continue;
      }

      const content = fs.readFileSync(fullPath);
      const actualHash = crypto.createHash('sha256').update(content).digest('hex');

      if (actualHash !== expectedHash) {
        console.warn(`[build-integrity] MODIFIED: ${filePath} (expected ${expectedHash.slice(0, 12)}..., got ${actualHash.slice(0, 12)}...)`);
        mismatches++;
      }
    }

    if (mismatches > 0) {
      console.warn(`[build-integrity] ${mismatches} file(s) differ from build manifest. This may indicate tampering or manual modification.`);
    } else {
      console.info(`[build-integrity] All ${Object.keys(manifest.files).length} files match build manifest (built ${manifest.buildTime}).`);
    }
  } catch (err) {
    console.warn('[build-integrity] Failed to validate build manifest:', err);
  }
}
