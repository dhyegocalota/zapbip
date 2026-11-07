import { defineConfig } from 'vitest/config';

const LOADED_MACHINE_TEST_TIMEOUT_MS = 30_000;

export default defineConfig({
  test: {
    testTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
    hookTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
    environment: 'node',
    include: ['test/unit/**/*.test.ts', 'test/integration/**/*.test.ts'],
  },
});
