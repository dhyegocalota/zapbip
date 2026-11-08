import { defineConfig } from 'vitest/config';

const LOADED_MACHINE_TEST_TIMEOUT_MS = 30_000;

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'generate/**/*.test.ts', 'supported/**/*.test.ts', 'testing/**/*.test.ts'],
    testTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
    hookTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
  },
});
