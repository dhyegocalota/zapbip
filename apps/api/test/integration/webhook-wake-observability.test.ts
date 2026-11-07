import { reset, runDurableObjectAlarm } from 'cloudflare:test';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCloudflareWakeObserver } from '../../src/adapters/wake/wake-observer';
import { advanceClock, receiveOwnerText } from '../support/inbox-session';
import { applyDirectoryMigration } from '../support/seed';
import {
  ACCEPTED,
  GROK_TOKEN,
  GROK_URL,
  UNAVAILABLE,
  WAKE_ACCOUNT,
  WAKE_AGENT,
  enableGrokWake,
  mentionText,
  expectOk,
  replaceWakeDependencies,
  wakeStub,
  applyWakeDirectory,
} from '../support/wake-session';

const OWNER_TEXT = 'segredo-do-dono';
const GROK_PATH = 'automations/webhook';
const RETRY_ADVANCES_MS = [3_000, 5_000, 10_000, 20_000];
const ATTEMPTS = 4;

let stub: DurableObjectStub<DevAccountInbox>;

function observeWith(input: { writeDataPoint: (point: AnalyticsEngineDataPoint) => void }) {
  return replaceWakeDependencies({
    stub,
    patch: { observer: createCloudflareWakeObserver({ dataset: { writeDataPoint: input.writeDataPoint }, accountId: WAKE_ACCOUNT }) },
  });
}

async function runThreeRetriesAndDelivery(): Promise<void> {
  await stub.devScriptWake({ agent: WAKE_AGENT, responses: [UNAVAILABLE, UNAVAILABLE, UNAVAILABLE, ACCEPTED] });
  expectOk(await receiveOwnerText({ stub, text: mentionText({ text: OWNER_TEXT }) }));
  for (const advanceMs of RETRY_ADVANCES_MS) {
    await advanceClock({ stub, advanceMs });
    await runDurableObjectAlarm(stub);
  }
}

beforeEach(applyWakeDirectory);

beforeEach(async () => {
  stub = wakeStub({});
  await enableGrokWake({ stub });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('webhook wake observability', () => {
  it('logs no secret, url path, owner text or header value', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');
    await observeWith({ writeDataPoint: () => undefined });
    await runThreeRetriesAndDelivery();
    const lines = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().map(String);
    expect(lines.length).toBeGreaterThan(0);
    [GROK_TOKEN, GROK_PATH, OWNER_TEXT, `Bearer`].forEach((secret) => lines.forEach((line) => expect(line).not.toContain(secret)));
  });

  it('writes one data point per attempt with provider, outcome and status class', async () => {
    const points: AnalyticsEngineDataPoint[] = [];
    await observeWith({ writeDataPoint: (point) => points.push(point) });
    await runThreeRetriesAndDelivery();
    expect(points).toHaveLength(ATTEMPTS);
    expect(points.map((point) => point.blobs)).toEqual([
      ['grok_routine', 'retry', '5xx'],
      ['grok_routine', 'retry', '5xx'],
      ['grok_routine', 'retry', '5xx'],
      ['grok_routine', 'delivered', '2xx'],
    ]);
  });

  it('logs no message text when the transport error carries the url', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');
    await replaceWakeDependencies({
      stub,
      patch: {
        transport: {
          send: async () => {
            throw new Error(`request to ${GROK_URL} failed`);
          },
        },
      },
    });
    expectOk(await receiveOwnerText({ stub, text: mentionText({ text: 'oi' }) }));
    await advanceClock({ stub, advanceMs: 3_000 });
    await runDurableObjectAlarm(stub);
    const lines = [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().map(String);
    lines.forEach((line) => expect(line).not.toContain(GROK_URL));
    lines.forEach((line) => expect(line).not.toContain(GROK_PATH));
  });
});
