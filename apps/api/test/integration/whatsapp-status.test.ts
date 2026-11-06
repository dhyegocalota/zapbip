import { env, SELF } from 'cloudflare:test';
import { MINUTE_MS } from '@zapbip/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { UNINDEXED_STATUS_RETRY_WINDOW_MS, WEBHOOK_SIGNATURE_HEADER } from '../../src/adapters/whatsapp/whatsapp-constants';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import { HttpStatus } from '../../src/routes/http-status';
import playedFixture from '../fixtures/whatsapp/status/played.json';
import readFixture from '../fixtures/whatsapp/status/read.json';
import { notificationWith } from '../fixtures/whatsapp/inbound/notification';
import { signatureHeaderOf } from '../fixtures/whatsapp/inbound/signed-webhook';
import { ORIGIN } from './route-fixtures';

const STATUS_OK = 200;
const MILLISECONDS_PER_SECOND = 1_000;
const STALE_MARGIN_MS = MINUTE_MS;

afterEach(() => {
  vi.restoreAllMocks();
});

async function postStatus(input: { status: object }): Promise<Response> {
  const text = JSON.stringify(notificationWith({ statuses: [input.status] }));
  const signature = await signatureHeaderOf({ appSecret: env.META_APP_SECRET as string, body: new TextEncoder().encode(text) });
  return SELF.fetch(`${ORIGIN}${WHATSAPP_WEBHOOK_PATH}`, {
    method: 'POST',
    headers: { [WEBHOOK_SIGNATURE_HEADER]: signature },
    body: text,
  });
}

function secondsAgo(input: { ageMs: number }): string {
  return String(Math.floor((Date.now() - input.ageMs) / MILLISECONDS_PER_SECOND));
}

describe('webhook statuses', () => {
  test('WI-50 answers 503 for an unindexed wamid that is young, so Meta retries', async () => {
    const response = await postStatus({ status: { ...readFixture, id: 'wamid.YOUNG', timestamp: secondsAgo({ ageMs: 0 }) } });
    expect(response.status).toBe(HttpStatus.ServiceUnavailable);
  });

  test('WI-51 answers 200 and logs status.unindexed once the status is older than the window', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const ageMs = UNINDEXED_STATUS_RETRY_WINDOW_MS + STALE_MARGIN_MS;
    const response = await postStatus({ status: { ...readFixture, id: 'wamid.OLD', timestamp: secondsAgo({ ageMs }) } });
    expect(response.status).toBe(STATUS_OK);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).toContain(OperatorEvent.StatusUnindexed);
  });

  test('WI-56 answers 200 and logs status.ignored for a played status', async () => {
    const spies = [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
    const response = await postStatus({ status: { ...playedFixture, timestamp: secondsAgo({ ageMs: 0 }) } });
    expect(response.status).toBe(STATUS_OK);
    expect(JSON.stringify(spies.flatMap((spy) => spy.mock.calls))).toContain(OperatorEvent.StatusIgnored);
  });
});
