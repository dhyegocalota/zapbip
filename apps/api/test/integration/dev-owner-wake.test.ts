import { WAKE_DEBOUNCE_MS, WAKE_SIGNAL_BODY, type RecordedWakeRequest } from '@zapbip/core';
import { MessageKind, WakeMode } from '@zapbip/types';
import { SELF } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { inboxOf, ORIGIN, seedAccount } from './route-fixtures';
import { ACCEPTED, PINNED_WAKE_TOKEN, PINNED_WAKE_URL } from '../support/wake-session';

const STATUS_NO_CONTENT = 204;
const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;
const UNKNOWN_PHONE = '5500000000000';
const MALFORMED_PHONE = 'abc';
const FIRST_AGENT = 'alpha';
const SECOND_AGENT = 'beta';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function agentWakeUrl(input: { phone: string; agent: string; route: string }): string {
  return `${ORIGIN}/dev/owner/${input.phone}/agents/${input.agent}/wake/${input.route}`;
}

function scriptWake(input: { phone: string; agent: string; body: unknown }): Promise<Response> {
  return SELF.fetch(agentWakeUrl({ ...input, route: 'script' }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input.body),
  });
}

function readWakeRequests(input: { phone: string; agent: string }): Promise<Response> {
  return SELF.fetch(agentWakeUrl({ ...input, route: 'requests' }));
}

function runWakes(input: { phone: string }): Promise<Response> {
  return SELF.fetch(`${ORIGIN}/dev/owner/${input.phone}/wake/run`, { method: 'POST' });
}

async function postOwnerText(input: { phone: string; text: string }): Promise<Response> {
  return SELF.fetch(`${ORIGIN}/dev/owner/${input.phone}/messages`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind: MessageKind.Text, text: input.text }),
  });
}

async function advanceWakeClock(input: { phone: string; advanceMs: number }): Promise<Response> {
  return SELF.fetch(`${ORIGIN}/dev/owner/${input.phone}/clock`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ advance_ms: input.advanceMs }),
  });
}

describe('wake dev routes', () => {
  test('WR-1 a scripted response is recorded as one request after the debounce and the run', async () => {
    const account = await seedAccount({ agent: FIRST_AGENT });
    const setting = await inboxOf({ accountId: account.accountId }).setWake({
      connection: account.connection,
      setting: { mode: WakeMode.Webhook, url: PINNED_WAKE_URL, token: PINNED_WAKE_TOKEN, intervalMinutes: null, standbyAgent: null },
    });
    expect(setting.ok).toBe(true);
    const script = await scriptWake({ phone: account.phone, agent: FIRST_AGENT, body: { responses: [ACCEPTED] } });
    expect(script.status).toBe(STATUS_NO_CONTENT);
    expect((await postOwnerText({ phone: account.phone, text: `@${FIRST_AGENT} oi` })).status).toBe(STATUS_OK);
    expect((await advanceWakeClock({ phone: account.phone, advanceMs: WAKE_DEBOUNCE_MS })).status).toBe(STATUS_OK);
    const run = await runWakes({ phone: account.phone });
    expect(run.status).toBe(STATUS_NO_CONTENT);
    const read = await readWakeRequests({ phone: account.phone, agent: FIRST_AGENT });
    expect(read.status).toBe(STATUS_OK);
    const requests = (await read.json()) as RecordedWakeRequest[];
    expect(requests.map((request) => request.body)).toEqual([WAKE_SIGNAL_BODY]);
  });

  test('WR-2 an agent with no scripted traffic reads an empty list', async () => {
    const account = await seedAccount({ agent: FIRST_AGENT });
    const read = await readWakeRequests({ phone: account.phone, agent: FIRST_AGENT });
    expect(read.status).toBe(STATUS_OK);
    expect(await read.json()).toEqual([]);
  });

  test.each([
    { phone: UNKNOWN_PHONE, label: 'an unknown phone' },
    { phone: MALFORMED_PHONE, label: 'a malformed phone' },
  ])('WR-3 $label answers 404 on every wake route', async ({ phone }) => {
    const statuses = await Promise.all([
      scriptWake({ phone, agent: FIRST_AGENT, body: { responses: [] } }),
      readWakeRequests({ phone, agent: FIRST_AGENT }),
      runWakes({ phone }),
    ]).then((responses) => responses.map((response) => response.status));
    expect(statuses).toEqual([STATUS_NOT_FOUND, STATUS_NOT_FOUND, STATUS_NOT_FOUND]);
  });

  test('WR-4 the agent of another account answers 404 on script and requests', async () => {
    const owner = await seedAccount({ agent: FIRST_AGENT });
    await seedAccount({ agent: SECOND_AGENT });
    const statuses = await Promise.all([
      scriptWake({ phone: owner.phone, agent: SECOND_AGENT, body: { responses: [ACCEPTED] } }),
      readWakeRequests({ phone: owner.phone, agent: SECOND_AGENT }),
    ]).then((responses) => responses.map((response) => response.status));
    expect(statuses).toEqual([STATUS_NOT_FOUND, STATUS_NOT_FOUND]);
  });

  test('WR-5 a malformed script body answers 400', async () => {
    const account = await seedAccount({ agent: FIRST_AGENT });
    const response = await scriptWake({ phone: account.phone, agent: FIRST_AGENT, body: { responses: [{ statusCode: 'ok' }] } });
    expect(response.status).toBe(STATUS_BAD_REQUEST);
  });
});
