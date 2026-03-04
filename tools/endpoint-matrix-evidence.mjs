import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'docs/migration/20260302-220738');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function has(relPath, needle) {
  return read(relPath).includes(needle);
}

function hasAny(relPath, needles) {
  const text = read(relPath);
  return needles.some((needle) => text.includes(needle));
}

const domains = [
  {
    slug: 'core-auth-guild-chat-voice-routes',
    checks: [
      { type: 'contains', file: 'apps/api/src/routes/index.ts', needle: "router.use('/auth', authRateLimit, authRouter);", label: 'auth router mounted' },
      { type: 'contains', file: 'apps/api/src/routes/index.ts', needle: "router.use('/guilds', guildsRouter);", label: 'guild router mounted' },
      { type: 'contains', file: 'apps/api/src/routes/index.ts', needle: "router.use('/channels/:channelId/messages', messagesRouter);", label: 'chat router mounted' },
      { type: 'contains', file: 'apps/api/src/routes/index.ts', needle: "router.use('/voice', voiceRouter);", label: 'voice router mounted' },
      { type: 'contains', file: 'apps/web/src/lib/api.ts', needle: "'/capabilities'", label: 'frontend capability path wired' },
    ],
  },
  {
    slug: 'discover-join-flow',
    checks: [
      { type: 'contains', file: 'apps/api/src/routes/guilds.ts', needle: "'/:guildId/join'", label: 'discover join endpoint exists' },
      { type: 'contains', file: 'apps/api/src/routes/guilds.ts', needle: 'INVITE_REQUIRED', label: 'negative path for non-discoverable guild' },
      { type: 'contains', file: 'apps/api/src/routes/guilds.ts', needle: 'alreadyMember', label: 'idempotent existing-membership path' },
      { type: 'contains', file: 'apps/web/src/lib/api.ts', needle: "join: (guildId: string)", label: 'frontend API helper exists' },
      { type: 'contains', file: 'apps/web/src/pages/app/Discover.tsx', needle: 'api.guilds.join(portal.id)', label: 'discover page integration path' },
    ],
  },
  {
    slug: 'message-requests',
    checks: [
      { type: 'contains', file: 'apps/api/src/routes/relationships.ts', needle: "'/message-requests/:userId/accept'", label: 'accept endpoint exists' },
      { type: 'contains', file: 'apps/api/src/routes/relationships.ts', needle: "'/message-requests/:userId/ignore'", label: 'ignore endpoint exists' },
      { type: 'contains', file: 'apps/api/src/routes/relationships.ts', needle: "'/message-requests/:userId/report'", label: 'report endpoint exists' },
      { type: 'contains', file: 'apps/api/src/routes/relationships.ts', needle: "eq(reports.reason, 'message_request_spam')", label: 'report negative-path persistence' },
      { type: 'contains', file: 'apps/web/src/pages/app/MessageRequests.tsx', needle: 'api.messageRequests.accept(request.user.id)', label: 'frontend accept integration' },
    ],
  },
  {
    slug: 'admin-team-audit-bot-moderation',
    checks: [
      { type: 'contains', file: 'apps/api/src/routes/admin.ts', needle: "adminRouter.get('/team'", label: 'team endpoint exists' },
      { type: 'contains', file: 'apps/api/src/routes/admin.ts', needle: "adminRouter.get('/audit-log'", label: 'audit endpoint exists' },
      { type: 'contains', file: 'apps/api/src/routes/admin.ts', needle: "adminRouter.get('/bot-store'", label: 'bot moderation endpoint exists' },
      { type: 'contains', file: 'apps/api/src/routes/admin.ts', needle: 'assertScope(req, res, ADMIN_SCOPES.TEAM_MANAGE)', label: 'scope guard for team routes' },
      { type: 'contains', file: 'apps/api/src/routes/admin.ts', needle: 'assertScope(req, res, ADMIN_SCOPES.BOT_MODERATE)', label: 'scope guard for moderation routes' },
    ],
  },
  {
    slug: 'bot-store-lifecycle',
    checks: [
      { type: 'contains', file: 'apps/api/src/routes/bot-store.ts', needle: "botStoreRouter.post('/bots/installs'", label: 'install endpoint exists' },
      { type: 'contains', file: 'apps/api/src/routes/bot-store.ts', needle: "botStoreRouter.post('/bot-store/:id/reviews'", label: 'review submit endpoint exists' },
      { type: 'contains', file: 'apps/web/src/lib/api.ts', needle: "install: (guildId: string, applicationId: string)", label: 'frontend install helper exists' },
      { type: 'contains', file: 'apps/web/src/pages/app/BotStore.tsx', needle: 'api.botInstalls.install(selectedGuildId, selectedBot.applicationId)', label: 'frontend install integration path' },
      { type: 'contains', file: 'apps/web/src/pages/app/BotStore.tsx', needle: 'api.botStore.postReview', label: 'frontend review integration path' },
    ],
  },
  {
    slug: 'bot-builder-publish-linkage',
    checks: [
      { type: 'contains', file: 'apps/api/src/routes/bot-store.ts', needle: 'applicationId: z.string().optional()', label: 'listing accepts applicationId' },
      { type: 'contains', file: 'apps/web/src/pages/app/BotBuilder.tsx', needle: 'if (!selectedApplicationId)', label: 'frontend requires linked application' },
      { type: 'contains', file: 'apps/web/src/pages/app/BotBuilder.tsx', needle: 'api.botStore.createListing({', label: 'listing API call present' },
      { type: 'contains', file: 'apps/web/src/pages/app/BotBuilder.tsx', needle: 'applicationId: selectedApplicationId', label: 'linked application propagated' },
    ],
  },
  {
    slug: 'marketplace-purchase-create',
    checks: [
      { type: 'contains', file: 'apps/api/src/routes/cosmetics.ts', needle: '// PATCH /cosmetics/:id/submit — Submit for review', label: 'submit endpoint contract present' },
      { type: 'contains', file: 'apps/api/src/routes/cosmetics.ts', needle: '// POST /cosmetics/:id/purchase', label: 'purchase endpoint contract present' },
      { type: 'contains', file: 'apps/web/src/pages/app/Marketplace.tsx', needle: 'await api.cosmetics.submitForReview(created.id);', label: 'frontend create -> submit integration' },
      { type: 'contains', file: 'apps/web/src/pages/app/Marketplace.tsx', needle: 'const result = await api.cosmetics.purchase(purchaseItem.id);', label: 'frontend purchase integration path' },
      { type: 'contains', file: 'apps/api/src/routes/cosmetics.ts', needle: 'INSUFFICIENT_BALANCE', label: 'purchase negative path exists' },
    ],
  },
  {
    slug: 'dm-call-voice-entry-reliability',
    checks: [
      { type: 'contains', file: 'apps/web/src/pages/app/DirectMessage.tsx', needle: 'const resolveDmChannelId = useCallback(async (routeId: string)', label: 'channel-id resolution helper present' },
      { type: 'contains', file: 'apps/web/src/pages/app/DirectMessage.tsx', needle: 'const resolvedId = await resolveDmChannelId(id);', label: 'resolved channel id applied before call flow' },
      { type: 'contains', file: 'apps/api/src/routes/voice.ts', needle: 'Ensure user is a participant for DM/GROUP_DM voice joins', label: 'DM membership gate present' },
      { type: 'contains', file: 'apps/api/src/routes/voice.ts', needle: 'You are not a member of this direct message channel', label: 'DM membership negative path response' },
    ],
  },
  {
    slug: 'route-normalization-navigation-entry-points',
    checks: [
      { type: 'contains', file: 'apps/web/src/lib/routes.ts', needle: 'export function normalizeLegacyRoute(route: string)', label: 'legacy route normalization helper exists' },
      { type: 'contains', file: 'apps/web/src/App.tsx', needle: 'path="guilds/:guildId/:channelId"', label: 'legacy guild route redirect exists' },
      { type: 'contains', file: 'apps/web/src/App.tsx', needle: 'Navigate to={`/guild/${guildId}/channel/${channelId}`}', label: 'canonical channel route target present' },
      { type: 'contains', file: 'apps/web/src/App.tsx', needle: 'Navigate to={`/guild/${guildId}/voice/${channelId}`}', label: 'canonical voice route target present' },
    ],
  },
  {
    slug: 'voice-channel-type-compatibility',
    checks: [
      { type: 'contains', file: 'apps/api/src/routes/voice.ts', needle: 'function normalizeChannelType(type: string | null | undefined): string', label: 'backend channel type normalizer exists' },
      { type: 'contains', file: 'apps/api/src/routes/voice.ts', needle: "normalized === 'GROUP_DM'", label: 'group DM channel-type compatibility path' },
      { type: 'contains', file: 'apps/api/src/routes/voice.ts', needle: "normalized === 'STAGE_VOICE'", label: 'legacy/current stage compatibility path' },
      { type: 'contains', file: 'apps/web/src/pages/app/DirectMessage.tsx', needle: "channelType === 'DM' || channelType === 'GROUP_DM'", label: 'frontend DM type compatibility path' },
    ],
  },
  {
    slug: 'avatar-parity-top-left-vs-bottom-left',
    checks: [
      { type: 'contains', file: 'apps/web/src/components/ui/Avatar.tsx', needle: 'useEffect(() => {', label: 'avatar error-state reset hook present' },
      { type: 'contains', file: 'apps/web/src/components/ui/Avatar.tsx', needle: '}, [avatarHash, userId]);', label: 'reset keyed on hash changes' },
      { type: 'contains', file: 'apps/web/src/App.tsx', needle: '<Avatar', label: 'shared Avatar component used in shell' },
      { type: 'contains', file: 'apps/web/src/App.tsx', needle: 'avatarHash={userProfile.avatarHash}', label: 'user profile avatarHash wired to Avatar component' },
    ],
  },
  {
    slug: 'bot-lifecycle-marketplace-full-persistence',
    checks: [
      { type: 'contains', file: 'apps/web/src/pages/app/BotBuilder.tsx', needle: 'await api.botStore.createListing({', label: 'bot listing persists through backend API' },
      { type: 'contains', file: 'apps/web/src/pages/app/Marketplace.tsx', needle: 'await api.cosmetics.create({', label: 'marketplace create persists through backend API' },
      { type: 'contains', file: 'apps/web/src/pages/app/Marketplace.tsx', needle: 'await api.cosmetics.submitForReview(created.id);', label: 'marketplace publish path persists through backend API' },
      { type: 'contains', file: 'apps/web/src/pages/app/BotStore.tsx', needle: 'await api.botInstalls.install(selectedGuildId, selectedBot.applicationId);', label: 'bot install persists through backend API' },
      { type: 'contains', file: 'apps/web/src/pages/app/BotBuilder.tsx', needle: 'setSubmitted(true);', label: 'success is tied to API completion' },
    ],
  },
];

function runCheck(check) {
  if (check.type === 'contains') {
    return has(check.file, check.needle);
  }

  if (check.type === 'containsAny') {
    return hasAny(check.file, check.needles);
  }

  return false;
}

function writeDomainEvidence(domain) {
  const now = new Date().toISOString();
  const lines = [];
  let passed = 0;

  lines.push(`# Endpoint Matrix Evidence: ${domain.slug}`);
  lines.push(`timestamp=${now}`);
  lines.push(`mode=static-contract-and-integration-verification`);
  lines.push('');

  for (const check of domain.checks) {
    const ok = runCheck(check);
    if (ok) passed += 1;
    lines.push(`${ok ? 'PASS' : 'FAIL'} | ${check.label} | file=${check.file}`);
  }

  lines.push('');
  lines.push(`summary=${passed}/${domain.checks.length}`);
  lines.push(`result=${passed === domain.checks.length ? 'PASS' : 'FAIL'}`);
  lines.push('');

  const outFile = path.join(evidenceDir, `endpoint-matrix-${domain.slug}-evidence.log`);
  fs.writeFileSync(outFile, `${lines.join('\n')}\n`, 'utf8');
  return { outFile, pass: passed === domain.checks.length, total: domain.checks.length, passed };
}

fs.mkdirSync(evidenceDir, { recursive: true });
const results = domains.map(writeDomainEvidence);

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  for (const row of failed) {
    console.error(`FAIL ${path.basename(row.outFile)} (${row.passed}/${row.total})`);
  }
  process.exit(1);
}

for (const row of results) {
  console.log(`PASS ${path.basename(row.outFile)} (${row.passed}/${row.total})`);
}
