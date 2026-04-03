import { rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
try {
  rmSync(dist, { recursive: true, force: true });
} catch (err) {
  console.error(
    '[clean-dist] Could not remove apps/desktop/dist (close Gratonite.exe / IDE handles on that folder, or retry):',
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}
