import { defineConfig } from 'vitest/config';

const LOADED_MACHINE_END_TO_END_TIMEOUT_MS = 120_000;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.test.ts'],
    exclude: [
      'test/e2e/whatsapp-channel.e2e.test.ts',
      'test/e2e/whatsapp-scheduled-wake.e2e.test.ts',
      'test/e2e/owner-flow.e2e.test.ts',
      'test/e2e/deploy-dry-run.e2e.test.ts',
    ],
    globalSetup: 'test/e2e/global-setup.ts',
    testTimeout: LOADED_MACHINE_END_TO_END_TIMEOUT_MS,
    hookTimeout: LOADED_MACHINE_END_TO_END_TIMEOUT_MS,
  },
});
