import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { MEDIA_LINK_SIGNING_KEY: 'test-media-key', UPLOAD_LINK_SIGNING_KEY: 'test-upload-key' },
        },
      },
    },
  },
});
