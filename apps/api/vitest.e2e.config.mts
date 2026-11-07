import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.test.ts'],
    exclude: ['test/e2e/whatsapp-channel.e2e.test.ts', 'test/e2e/whatsapp-scheduled-wake.e2e.test.ts'],
    globalSetup: 'test/e2e/global-setup.ts',
  },
});
