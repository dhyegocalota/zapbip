import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/e2e/whatsapp-channel.e2e.test.ts'],
    globalSetup: 'test/e2e/whatsapp-support/global-setup.ts',
  },
});
