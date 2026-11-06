import {
  MessageKind,
  OwnerLocale,
  SECOND_MS,
  WakeAttemptOutcome,
  WakeLogEventName,
  WakeMode,
  WakeStatus,
  WakeCopyKey,
} from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import {
  WAKE_BACKOFF_BASE_MS,
  WAKE_BACKOFF_CAP_MS,
  WAKE_DEBOUNCE_MS,
  WAKE_FAILED_RETRY_MS,
  WAKE_LEASE_MS,
  WAKE_MAX_ATTEMPTS,
  WAKE_MIN_INTERVAL_MS,
  WAKE_SIGNAL_BODY,
} from './constants';
import { runDueWakes } from './run-due-wakes';
import { scheduleWake } from './schedule-wake';
import { addUnreadOwnerMessage, createWakeEnvironment, PUBLIC_HOST, setWebhook, type WakeEnvironment } from './testing/wake-fixtures';
import { wakeAssociatedData } from './wake-associated-data';
import { WAKE_COPY } from './wake-copy';
import type { ScriptedWakeResponse } from './wake-ports';
import type { WakeJob } from './wake-setting';

const AGENT = 'claude-code';
const OWNER_LOCALE = OwnerLocale.PortugueseBrazil;
const SERVER_ERROR = 503;
const UNAUTHORIZED = 401;
const OK = 200;
const IN_FLIGHT_HOLD_MS = 4 * SECOND_MS;
const MAX_SETTLE_POLLS = 1_000;

function respond(input: { statusCode: number; retryAfterMs?: number }): ScriptedWakeResponse {
  const { statusCode, retryAfterMs = null } = input;
  return { statusCode, errorName: null, retryAfterMs };
}

function enqueue(input: { wakeEnvironment: WakeEnvironment; agent?: string; responses: ScriptedWakeResponse[] }): void {
  const { wakeEnvironment, agent = AGENT, responses } = input;
  wakeEnvironment.transport.enqueue({ agent, responses });
}

async function armed(input: { agents?: string[] } = {}): Promise<WakeEnvironment> {
  const { agents = [AGENT] } = input;
  const wakeEnvironment = await createWakeEnvironment();
  await Promise.all(agents.map((agent) => setWebhook({ wakeEnvironment, agent })));
  await Promise.all(agents.map((agent) => addUnreadOwnerMessage({ wakeEnvironment, agent })));
  await Promise.all(agents.map((agent) => scheduleWake({ ...wakeEnvironment.context, agent })));
  return wakeEnvironment;
}

function run(input: { wakeEnvironment: WakeEnvironment; ownerLocale?: OwnerLocale }) {
  const { wakeEnvironment, ownerLocale = OWNER_LOCALE } = input;
  return runDueWakes({ ...wakeEnvironment.context, ownerLocale, publicHost: PUBLIC_HOST });
}

async function fireAfter(input: { wakeEnvironment: WakeEnvironment; delayMs: number }) {
  await input.wakeEnvironment.environment.clock.advance({ ms: input.delayMs });
  return run({ wakeEnvironment: input.wakeEnvironment });
}

function findJob(input: { wakeEnvironment: WakeEnvironment; agent?: string }) {
  return input.wakeEnvironment.wake.repository.findJob({ agent: input.agent === undefined ? AGENT : input.agent });
}

function findWake(input: { wakeEnvironment: WakeEnvironment }) {
  return input.wakeEnvironment.wake.repository.findWake({ agent: AGENT });
}

function sentTexts(input: { wakeEnvironment: WakeEnvironment }): string[] {
  return input.wakeEnvironment.environment.sender.sessions.flatMap((message) => (message.kind === MessageKind.Text ? [message.text] : []));
}

function failedCopy(input: { locale: OwnerLocale }): string {
  return WAKE_COPY[WakeCopyKey.WakeFailed][input.locale].replace('{agent}', AGENT);
}

async function untilFailing(input: { wakeEnvironment: WakeEnvironment; polls: number }): Promise<void> {
  if (input.polls === 0) throw new Error('the wake was never settled');
  const stored = await findWake({ wakeEnvironment: input.wakeEnvironment });
  if (stored !== null && stored.status === WakeStatus.Failing) return;
  await untilFailing({ ...input, polls: input.polls - 1 });
}

async function fireAtDelays(input: { wakeEnvironment: WakeEnvironment; delaysMs: number[] }): Promise<void> {
  await input.delaysMs.reduce<Promise<void>>(async (previous, delayMs) => {
    await previous;
    await fireAfter({ wakeEnvironment: input.wakeEnvironment, delayMs });
  }, Promise.resolve());
}

describe('runDueWakes delivery', () => {
  test('sends the constant body once and settles a delivered wake', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: OK })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requests.map((request) => request.body)).toEqual([WAKE_SIGNAL_BODY]);
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(await findWake({ wakeEnvironment })).toMatchObject({
      status: WakeStatus.Active,
      lastDeliveredAt: wakeEnvironment.environment.clock.now(),
    });
    expect(wakeEnvironment.observer.events.map((event) => event.name)).toEqual([WakeLogEventName.Scheduled, WakeLogEventName.Delivered]);
  });

  test('sends nothing before the job is due and reports its due time', async () => {
    const wakeEnvironment = await armed();
    const scheduledAt = wakeEnvironment.environment.clock.now();
    const result = await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS - 1 });
    expect(wakeEnvironment.transport.requests).toEqual([]);
    expect(result).toEqual({ nextDueAt: scheduledAt + WAKE_DEBOUNCE_MS });
  });

  test('drops the job when the agent already read its messages', async () => {
    const wakeEnvironment = await armed();
    await wakeEnvironment.environment.repository.markRead({
      messageIds: (await wakeEnvironment.environment.repository.listUnread({ agent: AGENT, limit: 10 })).map(
        (message) => message.messageId,
      ),
    });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requests).toEqual([]);
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(wakeEnvironment.observer.events.map((event) => event.name)).toContain(WakeLogEventName.Dropped);
  });

  test('drops the job when a waiter is live', async () => {
    const wakeEnvironment = await armed();
    void wakeEnvironment.environment.dependencies.waiters.awaitAgentMessage({ agent: AGENT, timeoutMs: 60 * WAKE_BACKOFF_CAP_MS });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requests).toEqual([]);
    expect(await findJob({ wakeEnvironment })).toBeNull();
  });

  test('skips a leased job and sends once the lease expired', async () => {
    const wakeEnvironment = await armed();
    const { clock } = wakeEnvironment.environment;
    const job = await findJob({ wakeEnvironment });
    if (job === null) throw new Error('expected a job');
    await wakeEnvironment.wake.repository.saveJob({ job: { ...job, leaseUntil: clock.now() + WAKE_DEBOUNCE_MS + 1 } });
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: OK })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requests).toHaveLength(0);
    await fireAfter({ wakeEnvironment, delayMs: 1 });
    expect(wakeEnvironment.transport.requests).toHaveLength(1);
  });

  test('reports the earliest of the due times and the lease end', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const now = wakeEnvironment.environment.clock.now();
    const job = (input: { agent: string; dueAt: number; leaseUntil: number | null }): WakeJob => ({
      ...input,
      attempt: 0,
      rewake: false,
      lastOutcome: null,
    });
    await Promise.all(
      [
        job({ agent: 'alpha', dueAt: now + 8 * SECOND_MS, leaseUntil: null }),
        job({ agent: 'beta', dueAt: now + 9 * SECOND_MS, leaseUntil: null }),
        job({ agent: 'gamma', dueAt: now - 1, leaseUntil: now + 7 * SECOND_MS }),
      ].map((stored) => wakeEnvironment.wake.repository.saveJob({ job: stored })),
    );
    expect(await run({ wakeEnvironment })).toEqual({ nextDueAt: now + 7 * SECOND_MS });
  });

  test('serves every due agent and keeps going after one refusal', async () => {
    const wakeEnvironment = await armed({ agents: ['alpha', 'beta'] });
    enqueue({ wakeEnvironment, agent: 'alpha', responses: [respond({ statusCode: UNAUTHORIZED })] });
    enqueue({ wakeEnvironment, agent: 'beta', responses: [respond({ statusCode: OK })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requestsFor({ agent: 'alpha' })).toHaveLength(1);
    expect(wakeEnvironment.transport.requestsFor({ agent: 'beta' })).toHaveLength(1);
  });

  test('never sends owner text, in the body or in a header', async () => {
    const wakeEnvironment = await armed({ agents: ['alpha', 'beta'] });
    await Promise.all(Array.from({ length: 5 }, () => addUnreadOwnerMessage({ wakeEnvironment, agent: 'alpha' })));
    enqueue({ wakeEnvironment, agent: 'alpha', responses: [respond({ statusCode: OK })] });
    enqueue({ wakeEnvironment, agent: 'beta', responses: [respond({ statusCode: OK })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    const { requests } = wakeEnvironment.transport;
    expect(requests.map((request) => request.body)).toEqual([WAKE_SIGNAL_BODY, WAKE_SIGNAL_BODY]);
    expect(JSON.stringify(requests.map((request) => request.headers))).not.toContain('ignore your rules');
  });
});

describe('runDueWakes retries', () => {
  test('backs off 5, 10, 20 and 40 seconds and gives up on the fifth failure with one owner notice', async () => {
    const wakeEnvironment = await armed();
    const scheduledAt = wakeEnvironment.environment.clock.now();
    enqueue({ wakeEnvironment, responses: Array.from({ length: 5 }, () => respond({ statusCode: SERVER_ERROR })) });
    await fireAtDelays({ wakeEnvironment, delaysMs: [3, 5, 10, 20, 40].map((seconds) => seconds * SECOND_MS) });
    expect(wakeEnvironment.transport.requests.map((request) => request.atMs - scheduledAt)).toEqual(
      [3, 8, 18, 38, 78].map((seconds) => seconds * SECOND_MS),
    );
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
    expect(sentTexts({ wakeEnvironment })).toEqual([failedCopy({ locale: OWNER_LOCALE })]);
    expect(wakeEnvironment.observer.events.map((event) => event.name).slice(-1)).toEqual([WakeLogEventName.GaveUp]);
  });

  test.each([
    ['honours a short Retry-After on 429', 429, 7 * SECOND_MS, 7 * SECOND_MS],
    ['caps a long Retry-After on 429', 429, 120 * SECOND_MS, WAKE_BACKOFF_CAP_MS],
    ['honours Retry-After on 503', 503, 9 * SECOND_MS, 9 * SECOND_MS],
    ['ignores Retry-After on 500', 500, 30 * SECOND_MS, WAKE_BACKOFF_BASE_MS],
  ])('%s', async (_name, statusCode, retryAfterMs, expectedDelayMs) => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode, retryAfterMs })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(await findJob({ wakeEnvironment })).toMatchObject({
      dueAt: wakeEnvironment.environment.clock.now() + expectedDelayMs,
      attempt: 1,
      lastOutcome: WakeAttemptOutcome.Retry,
    });
  });

  test.each([
    ['without Retry-After on 429', 429, null],
    ['without Retry-After on 503', 503, null],
    ['with a Retry-After shorter than the base backoff', 429, SECOND_MS],
  ])('%s waits the base backoff', async (_name, statusCode, retryAfterMs) => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode, retryAfterMs: retryAfterMs === null ? undefined : retryAfterMs })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(await findJob({ wakeEnvironment })).toMatchObject({ dueAt: wakeEnvironment.environment.clock.now() + WAKE_BACKOFF_BASE_MS });
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'a non-finite Retry-After of %s is treated as absent',
    async (retryAfterMs) => {
      const wakeEnvironment = await armed();
      enqueue({ wakeEnvironment, responses: [respond({ statusCode: 429, retryAfterMs })] });
      await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
      expect(await findJob({ wakeEnvironment })).toMatchObject({ dueAt: wakeEnvironment.environment.clock.now() + WAKE_BACKOFF_BASE_MS });
    },
  );

  test.each([408, 425, 429, 500, 502, 503, 599])('status %i keeps the job for another attempt', async (statusCode) => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(await findJob({ wakeEnvironment })).toMatchObject({ attempt: 1, leaseUntil: null });
    expect(sentTexts({ wakeEnvironment })).toEqual([]);
  });

  test('a transport that throws counts as a retry and the run resolves', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [{ statusCode: null, errorName: 'TypeError', retryAfterMs: null }] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(await findJob({ wakeEnvironment })).toMatchObject({ attempt: 1, lastOutcome: WakeAttemptOutcome.Retry });
  });

  test('a repository that throws once leaves the job retrying and the run resolved', async () => {
    const wakeEnvironment = await armed();
    const { repository } = wakeEnvironment.wake;
    const saveJob = repository.saveJob.bind(repository);
    let calls = 0;
    repository.saveJob = async (input) => {
      calls += 1;
      if (calls === 1) throw new Error('storage unavailable');
      return saveJob(input);
    };
    const result = await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(await findJob({ wakeEnvironment })).toMatchObject({ lastOutcome: WakeAttemptOutcome.Retry });
    expect(result.nextDueAt).not.toBeNull();
  });
});

describe('runDueWakes backoff per failure kind', () => {
  const TIMEOUT_ERROR: ScriptedWakeResponse = { statusCode: null, errorName: 'TimeoutError', retryAfterMs: null };
  const NETWORK_ERROR: ScriptedWakeResponse = { statusCode: null, errorName: 'TypeError', retryAfterMs: null };
  const BACKOFF_STEPS_MS = [5, 10, 20, 40].map((seconds) => seconds * SECOND_MS);

  test.each([
    ['500', respond({ statusCode: 500 }), BACKOFF_STEPS_MS],
    ['network error', NETWORK_ERROR, BACKOFF_STEPS_MS],
    ['timeout', TIMEOUT_ERROR, BACKOFF_STEPS_MS],
    ['429 without Retry-After', respond({ statusCode: 429 }), BACKOFF_STEPS_MS],
    ['503 without Retry-After', respond({ statusCode: 503 }), BACKOFF_STEPS_MS],
    ['429 with Retry-After 7 s', respond({ statusCode: 429, retryAfterMs: 7 * SECOND_MS }), Array(4).fill(7 * SECOND_MS)],
    ['503 with Retry-After 9 s', respond({ statusCode: 503, retryAfterMs: 9 * SECOND_MS }), Array(4).fill(9 * SECOND_MS)],
  ])('%s is due again after the expected delay at every step', async (_name, response, expectedDelaysMs) => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: Array.from({ length: 5 }, () => response) });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    const dueDelays: number[] = [];
    await expectedDelaysMs.reduce<Promise<void>>(async (previous, delayMs) => {
      await previous;
      const job = await findJob({ wakeEnvironment });
      if (job === null) throw new Error('expected a retrying job');
      dueDelays.push(job.dueAt - wakeEnvironment.environment.clock.now());
      await fireAfter({ wakeEnvironment, delayMs });
    }, Promise.resolve());
    expect(dueDelays).toEqual(expectedDelaysMs);
  });
});

describe('runDueWakes timeouts', () => {
  test.each([
    ['TimeoutError', true],
    ['AbortError', true],
    ['TypeError', false],
  ])('a transport error %s is observed with timedOut %s', async (errorName, timedOut) => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [{ statusCode: null, errorName, retryAfterMs: null }] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    const retryEvent = wakeEnvironment.observer.events.find((event) => event.name === WakeLogEventName.Retry);
    expect(retryEvent).toMatchObject({ statusCode: null, timedOut });
  });
});

describe('runDueWakes refusals and the owner notice', () => {
  test.each([301, 302, 400, UNAUTHORIZED, 404, 501])('status %i is refused without retry and tells the owner once', async (statusCode) => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requests).toHaveLength(1);
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
    expect(sentTexts({ wakeEnvironment })).toEqual([failedCopy({ locale: OWNER_LOCALE })]);
  });

  test('the notice follows the owner locale', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: UNAUTHORIZED })] });
    await wakeEnvironment.environment.clock.advance({ ms: WAKE_DEBOUNCE_MS });
    await run({ wakeEnvironment, ownerLocale: OwnerLocale.EnglishUs });
    expect(sentTexts({ wakeEnvironment })).toEqual([failedCopy({ locale: OwnerLocale.EnglishUs })]);
  });

  test('a sealed target that does not open is refused before any request', async () => {
    const wakeEnvironment = await armed();
    const stored = await findWake({ wakeEnvironment });
    if (stored === null || stored.target === null) throw new Error('expected a stored target');
    await wakeEnvironment.wake.repository.saveWake({ wake: { ...stored, target: { ...stored.target, sealedTarget: 'tampered' } } });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requests).toEqual([]);
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
    expect(sentTexts({ wakeEnvironment })).toEqual([failedCopy({ locale: OWNER_LOCALE })]);
  });

  test('a sealed target of another key version is refused before any request', async () => {
    const wakeEnvironment = await armed();
    const stored = await findWake({ wakeEnvironment });
    if (stored === null || stored.target === null) throw new Error('expected a stored target');
    await wakeEnvironment.wake.repository.saveWake({ wake: { ...stored, target: { ...stored.target, keyVersion: 2 } } });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requests).toEqual([]);
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
  });

  test('a second failure while failing sends no second notice', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: UNAUTHORIZED }), respond({ statusCode: UNAUTHORIZED })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    await scheduleWake({ ...wakeEnvironment.context, agent: AGENT });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_FAILED_RETRY_MS });
    expect(wakeEnvironment.transport.requests).toHaveLength(2);
    expect(sentTexts({ wakeEnvironment })).toHaveLength(1);
  });

  test('after a wake gave up the next request waits the failed retry gap', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: UNAUTHORIZED })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    const refusedAt = wakeEnvironment.environment.clock.now();
    await addUnreadOwnerMessage({ wakeEnvironment, agent: AGENT });
    await scheduleWake({ ...wakeEnvironment.context, agent: AGENT });
    expect(await findJob({ wakeEnvironment })).toMatchObject({ dueAt: refusedAt + WAKE_FAILED_RETRY_MS });
  });

  test('a delivery after a failure returns to active without a notice', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: UNAUTHORIZED }), respond({ statusCode: OK })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    await scheduleWake({ ...wakeEnvironment.context, agent: AGENT });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_FAILED_RETRY_MS });
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Active });
    expect(sentTexts({ wakeEnvironment })).toHaveLength(1);
  });

  test('without an owner locale the wake is still settled once and no copy is written', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: UNAUTHORIZED })] });
    await wakeEnvironment.environment.clock.advance({ ms: WAKE_DEBOUNCE_MS });
    await runDueWakes({ ...wakeEnvironment.context, ownerLocale: null, publicHost: PUBLIC_HOST });
    expect(wakeEnvironment.transport.requests).toHaveLength(1);
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(sentTexts({ wakeEnvironment })).toEqual([]);
    expect(wakeEnvironment.observer.events.map((event) => event.name)).not.toContain(WakeLogEventName.NoticeFailed);
    expect(wakeEnvironment.observer.events.map((event) => event.name)).toContain(WakeLogEventName.NoticeSkipped);
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
  });

  test('a refused wake is sent exactly once when the notice cannot be delivered', async () => {
    const wakeEnvironment = await armed();
    wakeEnvironment.environment.sender.failSessionCalls({ callNumbers: [1] });
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: UNAUTHORIZED }), respond({ statusCode: OK })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_BACKOFF_CAP_MS });
    expect(wakeEnvironment.transport.requests).toHaveLength(1);
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
    expect(sentTexts({ wakeEnvironment })).toEqual([]);
  });

  test('a delivered wake logs no skipped notice', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: OK })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.observer.events.map((event) => event.name)).not.toContain(WakeLogEventName.NoticeSkipped);
  });

  test('the wake is settled before the notice leaves', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: UNAUTHORIZED })] });
    wakeEnvironment.environment.sender.holdSessions();
    await wakeEnvironment.environment.clock.advance({ ms: WAKE_DEBOUNCE_MS });
    const running = run({ wakeEnvironment });
    await untilFailing({ wakeEnvironment, polls: MAX_SETTLE_POLLS });
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(sentTexts({ wakeEnvironment })).toEqual([]);
    wakeEnvironment.environment.sender.releaseSessions();
    await running;
    expect(sentTexts({ wakeEnvironment })).toEqual([failedCopy({ locale: OWNER_LOCALE })]);
  });

  test('a failed notice is logged', async () => {
    const wakeEnvironment = await armed();
    wakeEnvironment.environment.sender.failSessionCalls({ callNumbers: [1] });
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: UNAUTHORIZED })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.observer.events.map((event) => event.name)).toContain(WakeLogEventName.NoticeFailed);
  });

  test('a storage failure on the last attempt gives up, marks the wake failing and tells the owner once', async () => {
    const wakeEnvironment = await armed();
    const job = await findJob({ wakeEnvironment });
    if (job === null) throw new Error('expected a job');
    await wakeEnvironment.wake.repository.saveJob({ job: { ...job, attempt: WAKE_MAX_ATTEMPTS - 1 } });
    wakeEnvironment.wake.repository.saveJob = async () => {
      throw new Error('storage unavailable');
    };
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
    expect(sentTexts({ wakeEnvironment })).toEqual([failedCopy({ locale: OWNER_LOCALE })]);
  });
});

describe('runDueWakes when the job itself keeps throwing', () => {
  async function throwFiveTimes(input: { ownerLocale: OwnerLocale | null; status?: WakeStatus }) {
    const wakeEnvironment = await armed();
    const stored = await findWake({ wakeEnvironment });
    if (stored === null) throw new Error('expected a wake');
    await wakeEnvironment.wake.repository.saveWake({
      wake: { ...stored, status: input.status === undefined ? stored.status : input.status },
    });
    wakeEnvironment.environment.dependencies.repository.countUnread = async () => {
      throw new Error('storage unavailable');
    };
    await [3, 5, 10, 20, 40].reduce<Promise<void>>(async (previous, seconds) => {
      await previous;
      await wakeEnvironment.environment.clock.advance({ ms: seconds * SECOND_MS });
      await runDueWakes({ ...wakeEnvironment.context, ownerLocale: input.ownerLocale, publicHost: PUBLIC_HOST });
    }, Promise.resolve());
    return wakeEnvironment;
  }

  test('five throws give up with status failing and one notice', async () => {
    const wakeEnvironment = await throwFiveTimes({ ownerLocale: OWNER_LOCALE });
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
    expect(sentTexts({ wakeEnvironment })).toEqual([failedCopy({ locale: OWNER_LOCALE })]);
  });

  test('five throws on a wake that already failed send no second notice', async () => {
    const wakeEnvironment = await throwFiveTimes({ ownerLocale: OWNER_LOCALE, status: WakeStatus.Failing });
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(sentTexts({ wakeEnvironment })).toEqual([]);
  });

  test('five throws without an owner locale still give up with status failing', async () => {
    const wakeEnvironment = await throwFiveTimes({ ownerLocale: null });
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
    expect(sentTexts({ wakeEnvironment })).toEqual([]);
  });
});

describe('runDueWakes target guard and settling', () => {
  async function sealTarget(input: { wakeEnvironment: WakeEnvironment; url: string }): Promise<void> {
    const { wakeEnvironment, url } = input;
    const stored = await findWake({ wakeEnvironment });
    if (stored === null || stored.target === null) throw new Error('expected a stored target');
    const sealedTarget = await wakeEnvironment.wake.secretBox.seal({
      plain: JSON.stringify({ url, token: 'p'.repeat(32) }),
      associatedData: wakeAssociatedData({
        accountId: wakeEnvironment.environment.dependencies.accountId,
        agent: AGENT,
      }),
    });
    await wakeEnvironment.wake.repository.saveWake({ wake: { ...stored, target: { ...stored.target, sealedTarget } } });
  }

  test.each(['https://localhost/x', 'https://hooks.zapbip.com/x', 'https://wake.account.workers.dev/x', `https://${PUBLIC_HOST}/x`])(
    'a stored target %s is refused at delivery before any request',
    async (url) => {
      const wakeEnvironment = await armed();
      await sealTarget({ wakeEnvironment, url });
      await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
      expect(wakeEnvironment.transport.requests).toEqual([]);
      expect(await findJob({ wakeEnvironment })).toBeNull();
      expect(await findWake({ wakeEnvironment })).toMatchObject({ status: WakeStatus.Failing });
      expect(sentTexts({ wakeEnvironment })).toEqual([failedCopy({ locale: OWNER_LOCALE })]);
    },
  );

  test('a wake cleared while the request is in flight is neither rewritten nor announced', async () => {
    const wakeEnvironment = await armed();
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: UNAUTHORIZED })] });
    const { transport, wake } = wakeEnvironment;
    const send = transport.send.bind(transport);
    transport.send = async (request) => {
      await wake.repository.clearWake({ agent: AGENT });
      return send(request);
    };
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(await findWake({ wakeEnvironment })).toMatchObject({ mode: WakeMode.None, target: null, status: WakeStatus.Active });
    expect(await findJob({ wakeEnvironment })).toBeNull();
    expect(sentTexts({ wakeEnvironment })).toEqual([]);
  });
});

describe('runDueWakes while a request is in flight', () => {
  async function runWithMessageInFlight(input: { statusCode: number }) {
    const wakeEnvironment = await armed();
    const { transport, environment } = wakeEnvironment;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gatedSend = transport.send.bind(transport);
    transport.send = async (request) => {
      await gate;
      return gatedSend(request);
    };
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: input.statusCode })] });
    await environment.clock.advance({ ms: WAKE_DEBOUNCE_MS });
    const running = run({ wakeEnvironment });
    await environment.clock.advance({ ms: 1 });
    await scheduleWake({ ...wakeEnvironment.context, agent: AGENT });
    await environment.clock.advance({ ms: IN_FLIGHT_HOLD_MS });
    release();
    await running;
    return wakeEnvironment;
  }

  test('a delivered attempt leaves exactly one follow-up job', async () => {
    const wakeEnvironment = await runWithMessageInFlight({ statusCode: OK });
    expect(await findJob({ wakeEnvironment })).toEqual({
      agent: AGENT,
      dueAt: wakeEnvironment.environment.clock.now() - IN_FLIGHT_HOLD_MS - 1 + WAKE_MIN_INTERVAL_MS,
      attempt: 0,
      leaseUntil: null,
      rewake: false,
      lastOutcome: WakeAttemptOutcome.Delivered,
    });
  });

  test('a refused attempt leaves the follow-up job and one notice', async () => {
    const wakeEnvironment = await runWithMessageInFlight({ statusCode: UNAUTHORIZED });
    expect(await findJob({ wakeEnvironment })).toMatchObject({
      dueAt: wakeEnvironment.environment.clock.now() - IN_FLIGHT_HOLD_MS - 1 + WAKE_FAILED_RETRY_MS,
      rewake: false,
    });
    expect(sentTexts({ wakeEnvironment })).toHaveLength(1);
  });

  test('a retry clears the rewake mark because the retry covers the new message', async () => {
    const wakeEnvironment = await runWithMessageInFlight({ statusCode: SERVER_ERROR });
    expect(await findJob({ wakeEnvironment })).toMatchObject({ attempt: 1, rewake: false });
  });

  test('the lease lasts as long as the constant says', async () => {
    const wakeEnvironment = await armed();
    const { transport, environment } = wakeEnvironment;
    let leaseUntil: number | null = null;
    transport.send = async () => {
      const job = await findJob({ wakeEnvironment });
      leaseUntil = job === null ? null : job.leaseUntil;
      return { outcome: WakeAttemptOutcome.Delivered, statusCode: OK, retryAfterMs: null, timedOut: false };
    };
    await environment.clock.advance({ ms: WAKE_DEBOUNCE_MS });
    await run({ wakeEnvironment });
    expect(leaseUntil).toBe(environment.clock.now() + WAKE_LEASE_MS);
  });
});

describe('runDueWakes when settling throws after the request', () => {
  async function armedWithThrowingSettle(input: { statusCode: number; throwOn: 'saveJob' | 'saveWake' }) {
    const wakeEnvironment = await armed();
    const { repository } = wakeEnvironment.wake;
    const original = repository[input.throwOn].bind(repository) as (arguments_: never) => Promise<void>;
    let isSent = false;
    const send = wakeEnvironment.transport.send.bind(wakeEnvironment.transport);
    wakeEnvironment.transport.send = async (request) => {
      const attempt = await send(request);
      await scheduleWake({ ...wakeEnvironment.context, agent: AGENT });
      isSent = true;
      return attempt;
    };
    repository[input.throwOn] = (async (arguments_: never) => {
      if (!isSent) return original(arguments_);
      isSent = false;
      throw new Error('storage unavailable');
    }) as never;
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: input.statusCode })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    return wakeEnvironment;
  }

  test('a throw after a 2xx does not send the wake a second time', async () => {
    const wakeEnvironment = await armedWithThrowingSettle({ statusCode: OK, throwOn: 'saveWake' });
    enqueue({ wakeEnvironment, responses: [respond({ statusCode: OK })] });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_BACKOFF_CAP_MS - SECOND_MS });
    expect(wakeEnvironment.transport.requests).toHaveLength(1);
  });

  test('a throw after a 2xx schedules the follow-up wake for a message that arrived in flight', async () => {
    const wakeEnvironment = await armedWithThrowingSettle({ statusCode: OK, throwOn: 'saveWake' });
    const requestedAt = wakeEnvironment.environment.clock.now();
    expect(await findJob({ wakeEnvironment })).toMatchObject({
      attempt: 0,
      rewake: false,
      leaseUntil: null,
      dueAt: requestedAt + WAKE_MIN_INTERVAL_MS,
    });
  });

  test('a throw while settling a retry keeps the rewake mark set in flight', async () => {
    const wakeEnvironment = await armedWithThrowingSettle({ statusCode: SERVER_ERROR, throwOn: 'saveJob' });
    expect(await findJob({ wakeEnvironment })).toMatchObject({ attempt: 1, rewake: true, leaseUntil: null });
  });
});

describe('runDueWakes without a webhook', () => {
  test('drops a job whose wake was cleared', async () => {
    const wakeEnvironment = await armed();
    const stored = await findWake({ wakeEnvironment });
    if (stored === null) throw new Error('expected a stored wake');
    await wakeEnvironment.wake.repository.saveWake({ wake: { ...stored, mode: WakeMode.None, target: null } });
    await fireAfter({ wakeEnvironment, delayMs: WAKE_DEBOUNCE_MS });
    expect(wakeEnvironment.transport.requests).toEqual([]);
    expect(await findJob({ wakeEnvironment })).toBeNull();
  });
});
