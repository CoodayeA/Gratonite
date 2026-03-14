import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run tests sequentially since they share a database
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
