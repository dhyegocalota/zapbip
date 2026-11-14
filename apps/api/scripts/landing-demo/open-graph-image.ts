import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

const runCommand = promisify(execFile);
const OPEN_GRAPH_FILE = join(import.meta.dirname, 'og.html');
const OPEN_GRAPH_SIZE = { width: 1200, height: 630 };
const OPEN_GRAPH_LIMIT_BYTES = 300_000;
const OPEN_GRAPH_COLORS = '192';

export type OpenGraphData = {
  titleLead: string;
  titleAccent: string;
  tagline: string;
  agentName: string;
  questionShort: string;
  options: string[];
};

async function shrinkIfNeeded(input: { target: string }): Promise<void> {
  if ((await stat(input.target)).size <= OPEN_GRAPH_LIMIT_BYTES) return;
  await runCommand('magick', [input.target, '-strip', '-colors', OPEN_GRAPH_COLORS, `PNG8:${input.target}`]);
}

export async function renderOpenGraphImage(input: { data: OpenGraphData; language: string; target: string }): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: OPEN_GRAPH_SIZE, deviceScaleFactor: 1 });
  await page.addInitScript(`window.DEMO = ${JSON.stringify(input.data)};`);
  await page.goto(`file://${OPEN_GRAPH_FILE}`);
  await page.evaluate(`document.documentElement.setAttribute('lang', ${JSON.stringify(input.language)})`);
  await page.screenshot({ path: input.target });
  await browser.close();
  await shrinkIfNeeded({ target: input.target });
}
