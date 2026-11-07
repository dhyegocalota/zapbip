import { defineConfig } from '@playwright/test';
import { DocsLanguage } from '@zapbip/types';
import { DOCS_LOCALE_OF, docsPortOf } from './e2e/support/docs-experience';

const SERVER_TIMEOUT_MS = 120_000;
const docsPort = await docsPortOf();

export default defineConfig({
  testDir: 'e2e',
  retries: 0,
  use: { baseURL: `http://localhost:${docsPort}` },
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
