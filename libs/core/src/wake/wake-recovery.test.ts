import { MessageKind, OwnerLocale, WakeMode, WakeStatus } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { connectionOf } from '../inbox/testing/fixtures';
import { WAKE_DEBOUNCE_MS, WAKE_FAILED_RETRY_MS } from './constants';
import { runDueWakes } from './run-due-wakes';
import { scheduleWake } from './schedule-wake';
import { setWake } from './set-wake';
import {
  addUnreadOwnerMessage,
  createWakeEnvironment,
  GROK_URL,
  PUBLIC_HOST,
  setWebhook,
  type WakeEnvironment,
} from './testing/wake-fixtures';
import type { ScriptedWakeResponse } from './wake-ports';

const AGENT = 'alpha';
const OTHER_AGENT = 'beta';
const OWNER_LOCALE = OwnerLocale.PortugueseBrazil;
const OTHER_TOKEN = 'q'.repeat(24);
const REFUSED: ScriptedWakeResponse = { statusCode: 401, errorName: null, retryAfterMs: null };
const ACCEPTED: ScriptedWakeResponse = { statusCode: 200, errorName: null, retryAfterMs: null };

async function armed(): Promise<WakeEnvironment> {
  const wakeEnvironment = await createWakeEnvironment();
  await setWebhook({ wakeEnvironment, agent: AGENT });
  await addUnreadOwnerMessage({ wakeEnvironment, agent: AGENT });
  await scheduleWake({ ...wakeEnvironment.context, agent: AGENT });
  return wakeEnvironment;
}

function run(input: { wakeEnvironment: WakeEnvironment }) {
  return runDueWakes({ ...input.wakeEnvironment.context, ownerLocale: OWNER_LOCALE, publicHost: PUBLIC_HOST });
}

async function fireAfter(input: { wakeEnvironment: WakeEnvironment; delayMs: number }) {
  await input.wakeEnvironment.environment.clock.advance({ ms: input.delayMs });
  await run({ wakeEnvironment: input.wakeEnvironment });
}

function noticeCount(input: { wakeEnvironment: WakeEnvironment }): number {
  return input.wakeEnvironment.environment.sender.sessions.filter((message) => message.kind === MessageKind.Text).length;
}

function findWake(input: { wakeEnvironment: WakeEnvironment; agent?: string }) {
  return input.wakeEnvironment.wake.repository.findWake({ agent: input.agent === undefined ? AGENT : input.agent });
}

async function runWithHookInFlight(input: { hook: (wakeEnvironment: WakeEnvironment) => Promise<void> }): Promise<WakeEnvironment> {
  const wakeEnvironment = await armed();
  wakeEnvironment.transport.enqueue({ agent: AGENT, responses: [REFUSED] });
  const send = wakeEnvironment.transport.send.bind(wakeEnvironment.transport);
  wakeEnvironment.transport.send = async (request) => {
    await input.hook(wakeEnvironment);
    return send(request);
  };
  await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
  return wakeEnvironment;
}

describe('wake recovery', () => {
  test('a message after a refusal re-wakes after the failed retry gap, returns to active and adds no second notice', async () => {
    const wakeEnvironment = await armed();
    wakeEnvironment.transport.enqueue({ agent: AGENT, responses: [REFUSED, ACCEPTED] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    await addUnreadOwnerMessage({ wakeEnvironment, agent: AGENT });
    await scheduleWake({ ...wakeEnvironment.context, agent: AGENT });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_FAILED_RETRY_MS });
    expect(wakeEnvironment.transport.requests).toHaveLength(2);
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Active });
    expect(noticeCount({ wakeEnvironment })).toBe(1);
  });

  test('a wake replaced by a new target while its request is in flight is neither settled nor announced', async () => {
    const wakeEnvironment = await runWithHookInFlight({
      hook: async (environment) => {
        await setWake({
          ...environment.context,
          connection: connectionOf({ agent: AGENT }),
          setting: { mode: WakeMode.Webhook, url: GROK_URL, token: OTHER_TOKEN, intervalMinutes: null, standbyAgent: null },
          publicHost: PUBLIC_HOST,
        });
      },
    });
    expect(noticeCount({ wakeEnvironment })).toBe(0);
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Active });
  });

  test('the sealed target of one agent copied into another agent is refused without a request', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: AGENT });
    await setWebhook({ wakeEnvironment, agent: OTHER_AGENT });
    const source = await findWake({ wakeEnvironment });
    const destination = await findWake({ wakeEnvironment, agent: OTHER_AGENT });
    if (source === null || source.target === null || destination === null || destination.target === null)
      throw new Error('expected two wakes');
    await wakeEnvironment.wake.repository.saveWake({
      wake: { ...destination, target: { ...destination.target, sealedTarget: source.target.sealedTarget } },
    });
    await addUnreadOwnerMessage({ wakeEnvironment, agent: OTHER_AGENT });
    await scheduleWake({ ...wakeEnvironment.context, agent: OTHER_AGENT });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requests).toEqual([]);
    expect(await findWake({ wakeEnvironment, agent: OTHER_AGENT })).toMatchObject({ status: WakeStatus.Failing });
  });
});
