import { defineConfig } from 'vitest/config';

const LOADED_MACHINE_END_TO_END_TIMEOUT_MS = 120_000;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/owner-flow.e2e.test.ts', 'test/e2e/deploy-dry-run.e2e.test.ts'],
    fileParallelism: false,
    globalSetup: 'test/e2e/whatsapp-support/global-setup.ts',
    testTimeout: LOADED_MACHINE_END_TO_END_TIMEOUT_MS,
    hookTimeout: LOADED_MACHINE_END_TO_END_TIMEOUT_MS,
  },
});
