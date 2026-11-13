import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ClientAppVariable } from './client-app-environment';

export async function capture(input: { page: Page; name: string }): Promise<void> {
  const directory = process.env[ClientAppVariable.ScreenshotDirectory];
  if (directory === undefined) return;
  mkdirSync(directory, { recursive: true });
  await input.page.screenshot({ path: join(directory, `${input.name}.png`), fullPage: true });
}
