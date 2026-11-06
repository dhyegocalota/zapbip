import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
import { DEVELOPMENT_ENVIRONMENT } from './src/contract/constants';

const WAKE_TEST_SECRET_KEY = Buffer.alloc(32).toString('base64');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc', environment: DEVELOPMENT_ENVIRONMENT },
      miniflare: {
        bindings: {
          MEDIA_LINK_SIGNING_KEY: 'test-media-key',
          UPLOAD_LINK_SIGNING_KEY: 'test-upload-key',
          WAKE_SECRET_KEY: WAKE_TEST_SECRET_KEY,
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
    globalSetup: 'test/support/fake-graph-global-setup.ts',
  },
});
