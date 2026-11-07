import { defineConfig } from '@playwright/test';
import { DocsLanguage } from '@zapbip/types';
import { DOCS_LOCALE_OF, docsPortOf } from './e2e/support/docs-experience';

const SERVER_TIMEOUT_MS = 120_000;
const LOADED_MACHINE_END_TO_END_TIMEOUT_MS = 120_000;
const LOADED_MACHINE_EXPECT_TIMEOUT_MS = 30_000;
const LOADED_MACHINE_NAVIGATION_TIMEOUT_MS = 60_000;
const LOADED_MACHINE_ACTION_TIMEOUT_MS = 30_000;
const docsPort = await docsPortOf();

export default defineConfig({
  testDir: 'e2e',
  retries: 0,
  timeout: LOADED_MACHINE_END_TO_END_TIMEOUT_MS,
  expect: { timeout: LOADED_MACHINE_EXPECT_TIMEOUT_MS },
  use: {
    baseURL: `http://localhost:${docsPort}`,
    navigationTimeout: LOADED_MACHINE_NAVIGATION_TIMEOUT_MS,
    actionTimeout: LOADED_MACHINE_ACTION_TIMEOUT_MS,
  },
  projects: Object.values(DocsLanguage).map((language) => ({
    name: DOCS_LOCALE_OF[language],
    use: { locale: DOCS_LOCALE_OF[language] },
  })),
  webServer: {
    command: `pnpm dlx mint@4.2.1207 dev --port ${docsPort} --client-version 0.0.4077`,
    url: `http://localhost:${docsPort}`,
    reuseExistingServer: false,
    timeout: SERVER_TIMEOUT_MS,
  },
});
