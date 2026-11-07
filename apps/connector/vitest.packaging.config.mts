import { defineConfig } from 'vitest/config';

const LOADED_MACHINE_END_TO_END_TIMEOUT_MS = 120_000;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/packaging/**/*.test.ts'],
    testTimeout: LOADED_MACHINE_END_TO_END_TIMEOUT_MS,
    hookTimeout: LOADED_MACHINE_END_TO_END_TIMEOUT_MS,
  },
});
