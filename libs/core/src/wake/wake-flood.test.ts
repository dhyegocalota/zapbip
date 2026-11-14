import { SECOND_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { WAKE_DEBOUNCE_MS, WAKE_MAX_ATTEMPTS, WAKE_MIN_INTERVAL_MS } from './constants';
import { runDueWakes } from './run-due-wakes';
import { scheduleWake } from './schedule-wake';
import {
  addUnreadOwnerMessage,
  createWakeEnvironment,
  ALPHA_URL,
  PINNED_TOKEN,
  PUBLIC_HOST,
  setWebhook,
  type WakeEnvironment,
} from './testing/wake-fixtures';
import type { ScriptedWakeResponse } from './wake-ports';
import { OwnerLocale } from '@zapbip/types';

const OWNER_LOCALE = OwnerLocale.PortugueseBrazil;
const ACCEPTED: ScriptedWakeResponse = { statusCode: 200, errorName: null, retryAfterMs: null };
const BURST_SIZE = 200;
const MESSAGE_GAP_MS = 4 * SECOND_MS;
const TEN_MINUTES_MS = 600 * SECOND_MS;
const AGENT_COUNT = 50;
const REQUEST_CEILING = 11;
const SERVER_ERROR: ScriptedWakeResponse = { statusCode: 503, errorName: null, retryAfterMs: null };
const THIRTY_MINUTES_MS = 1_800 * SECOND_MS;
const FAILED_CYCLE_CEILING = 3;

function run(input: { wakeEnvironment: WakeEnvironment }) {
  return runDueWakes({ ...input.wakeEnvironment.context, ownerLocale: OWNER_LOCALE, publicHost: PUBLIC_HOST });
}

function accept(input: { wakeEnvironment: WakeEnvironment; agent: string; count: number }): void {
  const { wakeEnvironment, agent, count } = input;
  wakeEnvironment.transport.enqueue({ agent, responses: Array.from({ length: count }, () => ACCEPTED) });
}

async function messageThenWake(input: { wakeEnvironment: WakeEnvironment; agent: string }): Promise<void> {
  const { wakeEnvironment, agent } = input;
  await addUnreadOwnerMessage({ wakeEnvironment, agent });
  await scheduleWake({ ...wakeEnvironment.context, agent });
}

describe('wake flood limits', () => {
  test('a burst of messages makes one request', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: 'alpha' });
    accept({ wakeEnvironment, agent: 'alpha', count: BURST_SIZE });
    await Array.from({ length: BURST_SIZE }).reduce<Promise<void>>(async (previous) => {
      await previous;
      await messageThenWake({ wakeEnvironment, agent: 'alpha' });
    }, Promise.resolve());
    await wakeEnvironment.environment.clock.advance({ ms: WAKE_DEBOUNCE_MS });
    await run({ wakeEnvironment });
    expect(wakeEnvironment.transport.requests).toHaveLength(1);
  });

  test('an agent that never reads gets at most one request per minute', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: 'alpha' });
    accept({ wakeEnvironment, agent: 'alpha', count: TEN_MINUTES_MS / MESSAGE_GAP_MS });
    await Array.from({ length: TEN_MINUTES_MS / MESSAGE_GAP_MS }).reduce<Promise<void>>(async (previous) => {
      await previous;
      await messageThenWake({ wakeEnvironment, agent: 'alpha' });
      await wakeEnvironment.environment.clock.advance({ ms: MESSAGE_GAP_MS });
      await run({ wakeEnvironment });
    }, Promise.resolve());
    expect(wakeEnvironment.transport.requests.length).toBeLessThanOrEqual(REQUEST_CEILING);
  });

  test('an endpoint that always answers 503 gets at most three failed cycles in thirty minutes', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: 'alpha' });
    wakeEnvironment.transport.enqueue({
      agent: 'alpha',
      responses: Array.from({ length: THIRTY_MINUTES_MS / MESSAGE_GAP_MS }, () => SERVER_ERROR),
    });
    await Array.from({ length: THIRTY_MINUTES_MS / MESSAGE_GAP_MS }).reduce<Promise<void>>(async (previous) => {
      await previous;
      await messageThenWake({ wakeEnvironment, agent: 'alpha' });
      await wakeEnvironment.environment.clock.advance({ ms: MESSAGE_GAP_MS });
      await run({ wakeEnvironment });
    }, Promise.resolve());
    expect(wakeEnvironment.transport.requests.length).toBeLessThanOrEqual(FAILED_CYCLE_CEILING * WAKE_MAX_ATTEMPTS);
    expect(wakeEnvironment.environment.sender.sessions).toHaveLength(1);
  });

  test('a message inside the interval coalesces into the next allowed request', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: 'alpha' });
    accept({ wakeEnvironment, agent: 'alpha', count: 2 });
    await messageThenWake({ wakeEnvironment, agent: 'alpha' });
    await wakeEnvironment.environment.clock.advance({ ms: WAKE_DEBOUNCE_MS });
    await run({ wakeEnvironment });
    const requestedAt = wakeEnvironment.environment.clock.now();
    await wakeEnvironment.environment.clock.advance({ ms: MESSAGE_GAP_MS });
    await messageThenWake({ wakeEnvironment, agent: 'alpha' });
    expect(await wakeEnvironment.wake.repository.findJob({ agent: 'alpha' })).toMatchObject({ dueAt: requestedAt + WAKE_MIN_INTERVAL_MS });
  });

  test('fifty agents with one message each get one request each', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const agents = Array.from({ length: AGENT_COUNT }, (_unused, index) => `agent-${index}`);
    await agents.reduce<Promise<void>>(async (previous, agent) => {
      await previous;
      await setWebhook({ wakeEnvironment, agent });
      accept({ wakeEnvironment, agent, count: 1 });
      await messageThenWake({ wakeEnvironment, agent });
    }, Promise.resolve());
    await wakeEnvironment.environment.clock.advance({ ms: WAKE_DEBOUNCE_MS });
    await run({ wakeEnvironment });
    expect(wakeEnvironment.transport.requests).toHaveLength(AGENT_COUNT);
  });

  test('the token and the url never reach an observer event after a transport error', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: 'alpha' });
    wakeEnvironment.transport.enqueue({ agent: 'alpha', responses: [{ statusCode: null, errorName: 'TypeError', retryAfterMs: null }] });
    await messageThenWake({ wakeEnvironment, agent: 'alpha' });
    await wakeEnvironment.environment.clock.advance({ ms: WAKE_DEBOUNCE_MS });
    await run({ wakeEnvironment });
    const serialized = JSON.stringify(wakeEnvironment.observer.events);
    expect(serialized).not.toContain(PINNED_TOKEN);
    expect(serialized).not.toContain(new URL(ALPHA_URL).pathname);
  });
});
