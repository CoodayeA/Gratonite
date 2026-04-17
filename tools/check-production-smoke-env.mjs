#!/usr/bin/env node

const publicOnly = process.env.SMOKE_PUBLIC_ONLY === 'true';

const requiredForAllRuns = [
  'SMOKE_BASE_URL',
  'SMOKE_API_HEALTH_URL',
];

const requiredForAuthenticatedRuns = [
  'SMOKE_EMAIL',
  'SMOKE_PASSWORD',
  'SMOKE_GUILD_ID',
  'SMOKE_CHAT_CHANNEL_ID',
  'SMOKE_FORUM_CHANNEL_ID',
];

function missing(names) {
  return names.filter((name) => !process.env[name]?.trim());
}

const missingBase = missing(requiredForAllRuns);
if (missingBase.length > 0) {
  console.error('production-smoke config is incomplete.');
  console.error(`Missing required env: ${missingBase.join(', ')}`);
  process.exit(1);
}

if (publicOnly) {
  console.log('production-smoke config: PASS (public-only mode)');
  process.exit(0);
}

const missingAuth = missing(requiredForAuthenticatedRuns);
if (missingAuth.length === 0) {
  console.log('production-smoke config: PASS (authenticated mode)');
  process.exit(0);
}

console.error('production-smoke config is incomplete for authenticated smoke runs.');
console.error(`Missing required env: ${missingAuth.join(', ')}`);
console.error('');
console.error('Add the missing GitHub secrets/variables before running scheduled or authenticated smoke:');
console.error('- secrets: SMOKE_EMAIL, SMOKE_PASSWORD');
console.error('- variables: SMOKE_GUILD_ID, SMOKE_CHAT_CHANNEL_ID, SMOKE_FORUM_CHANNEL_ID');
console.error('');
console.error('If you only want to verify public surfaces manually, dispatch the workflow with public_only=true.');
process.exit(1);
