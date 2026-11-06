import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
import { DEVELOPMENT_ENVIRONMENT } from './src/contract/constants';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc', environment: DEVELOPMENT_ENVIRONMENT },
      miniflare: {
        bindings: { MEDIA_LINK_SIGNING_KEY: 'test-media-key', UPLOAD_LINK_SIGNING_KEY: 'test-upload-key' },
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.test.ts'],
  },
});
