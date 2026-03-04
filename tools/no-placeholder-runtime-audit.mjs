import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const evidenceFile = path.join(root, 'docs/migration/20260302-220738/no-placeholder-runtime-audit.log');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function contains(relPath, needle) {
  return read(relPath).includes(needle);
}

function lacks(relPath, pattern) {
  return !pattern.test(read(relPath));
}

const checks = [
  {
    label: 'Discover join flow uses backend contract',
    pass: contains('apps/web/src/pages/app/Discover.tsx', 'api.guilds.join(portal.id)'),
  },
  {
    label: 'Message requests accept/ignore/report paths call backend',
    pass:
      contains('apps/web/src/pages/app/MessageRequests.tsx', 'api.messageRequests.accept') &&
      contains('apps/web/src/pages/app/MessageRequests.tsx', 'api.messageRequests.ignore') &&
      contains('apps/web/src/pages/app/MessageRequests.tsx', 'api.messageRequests.report'),
  },
  {
    label: 'Bot Store install/review uses backend endpoints',
    pass:
      contains('apps/web/src/pages/app/BotStore.tsx', 'api.botInstalls.install') &&
      contains('apps/web/src/pages/app/BotStore.tsx', 'api.botStore.postReview'),
  },
  {
    label: 'Marketplace create/purchase uses backend endpoints',
    pass:
      contains('apps/web/src/pages/app/Marketplace.tsx', 'api.cosmetics.create') &&
      contains('apps/web/src/pages/app/Marketplace.tsx', 'api.cosmetics.submitForReview') &&
      contains('apps/web/src/pages/app/Marketplace.tsx', 'api.cosmetics.purchase'),
  },
  {
    label: 'BotBuilder listing submission requires linked application and backend call',
    pass:
      contains('apps/web/src/pages/app/BotBuilder.tsx', 'if (!selectedApplicationId)') &&
      contains('apps/web/src/pages/app/BotBuilder.tsx', 'await api.botStore.createListing'),
  },
  {
    label: 'DM call flow resolves canonical channel id',
    pass:
      contains('apps/web/src/pages/app/DirectMessage.tsx', 'resolveDmChannelId') &&
      contains('apps/web/src/pages/app/DirectMessage.tsx', 'const resolvedId = await resolveDmChannelId(id);'),
  },
  {
    label: 'No explicit timeout-driven fake success in audited runtime pages',
    pass:
      lacks('apps/web/src/pages/app/Discover.tsx', /fake success|simulate success|mock success/i) &&
      lacks('apps/web/src/pages/app/MessageRequests.tsx', /fake success|simulate success|mock success/i) &&
      lacks('apps/web/src/pages/app/BotStore.tsx', /fake success|simulate success|mock success/i) &&
      lacks('apps/web/src/pages/app/Marketplace.tsx', /fake success|simulate success|mock success/i) &&
      lacks('apps/web/src/pages/app/BotBuilder.tsx', /fake success|simulate success|mock success/i),
  },
];

const now = new Date().toISOString();
const lines = [];
let passed = 0;

lines.push('# No Placeholder Runtime Audit');
lines.push(`timestamp=${now}`);
lines.push('scope=discover|message-requests|bot-store|marketplace|bot-builder|dm-call');
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
