import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          MEDIA_LINK_SIGNING_KEY: 'test-media-key',
          UPLOAD_LINK_SIGNING_KEY: 'test-upload-key',
          WHATSAPP_ACCESS_TOKEN: 'test-access-token',
          META_APP_SECRET: 'test-app-secret',
          WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
          WHATSAPP_PHONE_NUMBER_ID: '1000000000000001',
          WHATSAPP_GRAPH_BASE_URL: 'http://127.0.0.1:4012',
        },
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.test.ts'],
  },
});
