import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'test/e2e/whatsapp-channel.e2e.test.ts',
      'test/e2e/whatsapp-scheduled-wake.e2e.test.ts',
      'test/e2e/owner-flow.e2e.test.ts',
      'test/e2e/deploy-dry-run.e2e.test.ts',
    ],
    fileParallelism: false,
    globalSetup: 'test/e2e/whatsapp-support/global-setup.ts',
  },
});
