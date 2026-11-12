import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';
import { DeployEnvironment } from './src/contract/deploy-environment';
import { TEST_META_APP_SECRET } from './test/support/meta-app-secret';
import { BACKOFFICE_TEST_PASSWORD_PEPPER, BACKOFFICE_TEST_TOTP_SECRET } from './test/support/backoffice-credentials';

const WAKE_TEST_SECRET_KEY = Buffer.alloc(32).toString('base64');
const NUMBER_REGISTRY_TEST_KEY = Buffer.alloc(32).toString('base64');
const LOADED_MACHINE_TEST_TIMEOUT_MS = 30_000;

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc', environment: DeployEnvironment.Development },
      miniflare: {
        bindings: {
          MEDIA_LINK_SIGNING_KEY: 'test-media-key',
          UPLOAD_LINK_SIGNING_KEY: 'test-upload-key',
          WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
          META_APP_SECRET: TEST_META_APP_SECRET,
          WHATSAPP_GRAPH_BASE_URL: 'http://127.0.0.1:4012',
          WAKE_SECRET_KEY: WAKE_TEST_SECRET_KEY,
          NUMBER_REGISTRY_KEY: NUMBER_REGISTRY_TEST_KEY,
          BACKOFFICE_TOTP_SECRET: BACKOFFICE_TEST_TOTP_SECRET,
          BACKOFFICE_PASSWORD_PEPPER: BACKOFFICE_TEST_PASSWORD_PEPPER,
        },
      },
    }),
  ],
  test: {
    include: ['test/integration/**/*.test.ts'],
    globalSetup: 'test/support/fake-graph-global-setup.ts',
    testTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
    hookTimeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
  },
});
