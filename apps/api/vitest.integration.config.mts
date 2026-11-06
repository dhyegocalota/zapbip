import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const WAKE_TEST_SECRET_KEY = Buffer.alloc(32).toString('base64');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          MEDIA_LINK_SIGNING_KEY: 'test-media-key',
          UPLOAD_LINK_SIGNING_KEY: 'test-upload-key',
          WAKE_SECRET_KEY: WAKE_TEST_SECRET_KEY,
        },
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.test.ts'],
  },
});
