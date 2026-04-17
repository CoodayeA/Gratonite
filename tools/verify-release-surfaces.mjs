#!/usr/bin/env node

const checks = [
  {
    label: 'API health',
    url: process.env.API_HEALTH_URL || 'https://api.gratonite.chat/health',
    validate: async (response, body) => {
      if (!response.ok) {
        throw new Error(`expected 2xx, got ${response.status}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error('returned non-JSON health payload');
      }

      if (parsed.status !== 'ok') {
        throw new Error(`expected status=ok, got ${parsed.status ?? 'missing'}`);
      }
    },
  },
  {
    label: 'Landing page',
    url: process.env.LANDING_BASE_URL || 'https://gratonite.chat/',
    validate: async (response, body) => {
      if (!response.ok || !/Gratonite Chat/i.test(body)) {
        throw new Error(`missing landing marker or non-2xx response (${response.status})`);
      }
    },
  },
  {
    label: 'App shell',
    url: process.env.APP_BASE_URL || 'https://gratonite.chat/app/',
    validate: async (response, body) => {
      if (!response.ok || !/Gratonite/i.test(body)) {
        throw new Error(`missing app marker or non-2xx response (${response.status})`);
      }
    },
  },
  {
    label: 'Release notes',
    url: process.env.RELEASES_URL || 'https://gratonite.chat/releases',
    validate: async (response, body) => {
      if (!response.ok || !/Release|What&apos;s new|What's new/i.test(body)) {
        throw new Error(`missing release marker or non-2xx response (${response.status})`);
      }
    },
  },
  {
    label: 'Service worker',
    url: process.env.SERVICE_WORKER_URL || 'https://gratonite.chat/app/sw.js',
    validate: async (response, body) => {
      if (!response.ok || !body.includes('STATIC_ASSETS')) {
        throw new Error(`missing STATIC_ASSETS marker or non-2xx response (${response.status})`);
      }
    },
  },
  {
    label: 'Web manifest',
    url: process.env.WEB_MANIFEST_URL || 'https://gratonite.chat/app/manifest.json',
    validate: async (response, body) => {
      if (!response.ok) {
        throw new Error(`expected 2xx, got ${response.status}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new Error('returned non-JSON manifest payload');
      }

      if (parsed.name !== 'Gratonite' || parsed.start_url !== '/app/') {
        throw new Error(`unexpected manifest values: name=${parsed.name ?? 'missing'}, start_url=${parsed.start_url ?? 'missing'}`);
      }
    },
  },
];

for (const check of checks) {
  try {
    const response = await fetch(check.url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'gratonite-release-surface-check/1.0',
      },
    });
    const body = await response.text();
    await check.validate(response, body);
    console.log(`✅ ${check.label}: ${check.url}`);
  } catch (error) {
    console.error(`❌ ${check.label}: ${check.url}`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

console.log('release surface verification: PASS');
