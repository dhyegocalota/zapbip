import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, describe, expect, test } from 'vitest';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import type { Bindings } from '../../src/contract/env';
import { ACCESS_TOKEN, APP_SECRET, PHONE_NUMBER_ID, VERIFY_TOKEN } from './whatsapp-support/constants';

const runCommand = promisify(execFile);
const PRODUCTION_BUNDLE_FILE = 'index.js';
const BUNDLE_TIMEOUT_MS = 120_000;
const FAKE_GRAPH_ADDRESS = '127.0.0.1:4011';
const FIXTURE_MARKER = 'fixture-marker-whatsapp';
const FAKE_SENDER_MARKERS = ['fake-whatsapp-sender', 'createFakeWhatsAppSender', 'DevAccountInbox'];
const DEVELOPMENT_MEDIA_ORIGIN_MARKER = 'WHATSAPP_MEDIA_DOWNLOAD_ORIGIN';
const DEVELOPMENT_SKEW_MARKER = 'DEVELOPMENT_MAX_FUTURE_SKEW_MS';
const CLOUD_API_SENDER_MARKERS = ['createCloudApiMessageSender', 'zapbip_agent_notice'];
const GRAPH_BASE_URL_VARIABLE = 'WHATSAPP_GRAPH_BASE_URL';

const outputDirectories: string[] = [];

async function productionBundle(): Promise<string> {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'zapbip-whatsapp-bundle-'));
  outputDirectories.push(outputDirectory);
  await runCommand('pnpm', ['exec', 'wrangler', 'deploy', '--dry-run', '--outdir', outputDirectory]);
  return readFile(join(outputDirectory, PRODUCTION_BUNDLE_FILE), 'utf8');
}

afterAll(async () => {
  await Promise.all(outputDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('production bundle of the WhatsApp channel', () => {
  test(
    'PB-1 PB-2 PB-3 the production bundle sends through the Cloud API sender and carries no fake',
    async () => {
      const bundle = await productionBundle();
      const present = [
        FAKE_GRAPH_ADDRESS,
        FIXTURE_MARKER,
        DEVELOPMENT_MEDIA_ORIGIN_MARKER,
        DEVELOPMENT_SKEW_MARKER,
        ...FAKE_SENDER_MARKERS,
      ].filter((marker) => bundle.includes(marker));
      const missing = [GRAPH_BASE_URL_VARIABLE, ...CLOUD_API_SENDER_MARKERS].filter((marker) => !bundle.includes(marker));
      expect({ present, missing }).toEqual({ present: [], missing: [] });
    },
    BUNDLE_TIMEOUT_MS,
  );

  test('PB-4 the channel throws naming WHATSAPP_GRAPH_BASE_URL when production leaves it unset', () => {
    const environment = {
      META_APP_SECRET: APP_SECRET,
      WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN,
      WHATSAPP_ACCESS_TOKEN: ACCESS_TOKEN,
      WHATSAPP_PHONE_NUMBER_ID: PHONE_NUMBER_ID,
    } as Bindings;
    expect(() => readWhatsAppEnvironment({ env: environment })).toThrow(`${GRAPH_BASE_URL_VARIABLE} is not set`);
  });
});
