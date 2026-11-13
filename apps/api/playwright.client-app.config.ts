import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { SECOND_MS } from '@zapbip/types';

const LOADED_MACHINE_TEST_TIMEOUT_MS = 90 * SECOND_MS;
const LOADED_MACHINE_EXPECT_TIMEOUT_MS = 15 * SECOND_MS;
const LOADED_MACHINE_NAVIGATION_TIMEOUT_MS = 30 * SECOND_MS;
const LOADED_MACHINE_ACTION_TIMEOUT_MS = 15 * SECOND_MS;
const BROWSER_LOCALE = 'en-US';
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 375, height: 812 };

export default defineConfig({
  testDir: './e2e/client-app',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/_*.spec.ts',
  globalSetup: './e2e/client-app/global-setup.ts',
  outputDir: join(tmpdir(), 'zapbip-client-app-walk-results'),
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: LOADED_MACHINE_TEST_TIMEOUT_MS,
  expect: { timeout: LOADED_MACHINE_EXPECT_TIMEOUT_MS },
  use: {
    locale: BROWSER_LOCALE,
    navigationTimeout: LOADED_MACHINE_NAVIGATION_TIMEOUT_MS,
    actionTimeout: LOADED_MACHINE_ACTION_TIMEOUT_MS,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: DESKTOP_VIEWPORT } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: MOBILE_VIEWPORT } },
  ],
});
