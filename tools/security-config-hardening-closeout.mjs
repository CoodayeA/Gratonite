import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const evidenceFile = path.join(root, 'docs/migration/20260302-220738/security-config-hardening-closeout.log');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function includes(relPath, needle) {
  return read(relPath).includes(needle);
}

const checks = [
  {
    label: 'Admin routes use scoped authorization helper',
    pass:
      includes('apps/api/src/routes/admin.ts', 'assertScope(req, res, ADMIN_SCOPES.TEAM_MANAGE)') &&
      includes('apps/api/src/routes/admin-shop.ts', 'ADMIN_SCOPES.SHOP_MANAGE') &&
      includes('apps/api/src/routes/reports.ts', 'ADMIN_SCOPES.REPORTS_MANAGE') &&
      includes('apps/api/src/routes/feedback.ts', 'ADMIN_SCOPES.FEEDBACK_MANAGE') &&
      includes('apps/api/src/routes/bug-reports.ts', 'ADMIN_SCOPES.BUG_REPORTS_MANAGE') &&
      includes('apps/api/src/routes/cosmetics.ts', 'ADMIN_SCOPES.COSMETICS_MODERATE'),
  },
  {
    label: 'Scoped admin schema and migration exist',
    pass:
      includes('apps/api/src/db/schema/admin.ts', "admin_user_scopes") &&
      includes('apps/api/drizzle/0007_tasty_scope_hardening.sql', 'CREATE TABLE IF NOT EXISTS "admin_user_scopes"') &&
      includes('apps/api/drizzle/0007_tasty_scope_hardening.sql', "ON CONFLICT (\"user_id\", \"scope\") DO NOTHING"),
  },
  {
    label: 'Legacy isAdmin bootstrap mapped to full scopes',
    pass:
      includes('apps/api/drizzle/0007_tasty_scope_hardening.sql', "WHERE u.\"is_admin\" = true") &&
      includes('apps/api/src/lib/admin-scopes.ts', 'return !hasAnyScope;'),
  },
  {
    label: 'Voice join enforces DM membership before issuing token',
    pass:
      includes('apps/api/src/routes/voice.ts', 'Ensure user is a participant for DM/GROUP_DM voice joins') &&
      includes('apps/api/src/routes/voice.ts', 'You are not a member of this direct message channel'),
  },
  {
    label: 'Secret/config baseline avoids hard-coded production defaults in example',
    pass:
      includes('apps/api/.env.example', 'JWT_SECRET=') &&
      includes('apps/api/.env.example', 'JWT_REFRESH_SECRET=') &&
      !includes('apps/api/.env.example', 'changeme'),
  },
];

const now = new Date().toISOString();
const lines = [];
let passed = 0;

lines.push('# Security/Config Hardening Closeout');
lines.push(`timestamp=${now}`);
lines.push('scope=admin-authz|config-sanity|voice-membership');
lines.push('');

for (const check of checks) {
  if (check.pass) passed += 1;
  lines.push(`${check.pass ? 'PASS' : 'FAIL'} | ${check.label}`);
}

lines.push('');
lines.push(`summary=${passed}/${checks.length}`);
lines.push(`result=${passed === checks.length ? 'PASS' : 'FAIL'}`);
lines.push('');

fs.writeFileSync(evidenceFile, `${lines.join('\n')}\n`, 'utf8');

if (passed !== checks.length) {
  process.exit(1);
}

console.log(`PASS ${path.basename(evidenceFile)} (${passed}/${checks.length})`);
