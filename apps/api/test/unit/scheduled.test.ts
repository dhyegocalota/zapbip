import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Bindings } from '../../src/contract/env';
import { LogEvent } from '../../src/contract/log';
import { SCHEDULED_CRON } from '../../src/operations/constants';
import { runScheduled } from '../../src/operations/scheduled';

const NOW = Date.UTC(2026, 10, 6, 12);
const HALF_PAST_NOON = Date.UTC(2026, 10, 6, 12, 30);
const RETENTION_TICK = Date.UTC(2026, 10, 6, 3);
const HALF_PAST_RETENTION_HOUR = Date.UTC(2026, 10, 6, 3, 30);
const AFTER_RETENTION_HOUR = Date.UTC(2026, 10, 6, 4);
const TODAY = '2026-11-06';
const WARNING_TOTAL = 10_400;
const SAFE_TOTAL = 10_000;
const UNKNOWN_CRON = '*/5 * * * *';

function createFakeEnvironment(input: { total: number }) {
  const prepare = vi.fn(() => ({ bind: () => ({ first: async () => ({ total: input.total }) }) }));
  const list = vi.fn(async () => ({ objects: [], truncated: false }));
  const remove = vi.fn(async () => undefined);
  const env = { CONNECTIONS: { prepare }, MEDIA: { list, delete: remove } } as unknown as Bindings;
  return { env, prepare, list };
}

function loggedEvents(input: { logSpy: MockInstance<typeof console.log> }): Record<string, unknown>[] {
  return input.logSpy.mock.calls.map(([line]) => JSON.parse(String(line)));
}

let logSpy: MockInstance<typeof console.log>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('scheduled budget check', () => {
  it('logs budget.warning with the day and the total, then fails the run, at the threshold', async () => {
    const { env } = createFakeEnvironment({ total: WARNING_TOTAL });
    await expect(runScheduled({ cron: SCHEDULED_CRON, now: NOW, env })).rejects.toThrow(TODAY);
    expect(loggedEvents({ logSpy })).toContainEqual({ event: LogEvent.BudgetWarning, day: TODAY, gigabyteSeconds: WARNING_TOTAL });
  });

  it('stays quiet under the threshold', async () => {
    const { env } = createFakeEnvironment({ total: SAFE_TOTAL });
    await expect(runScheduled({ cron: SCHEDULED_CRON, now: NOW, env })).resolves.toBeUndefined();
    expect(loggedEvents({ logSpy })).toEqual([]);
  });

  it('reads one total with a single query', async () => {
    const { env, prepare } = createFakeEnvironment({ total: SAFE_TOTAL });
    await runScheduled({ cron: SCHEDULED_CRON, now: NOW, env });
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});

describe('scheduled dispatch', () => {
  it('runs the budget check and not the retention at minute zero outside the retention hour', async () => {
    const { env, prepare, list } = createFakeEnvironment({ total: SAFE_TOTAL });
    await runScheduled({ cron: SCHEDULED_CRON, now: NOW, env });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();
  });

  it.each([
    ['half past noon', HALF_PAST_NOON],
    ['half past the retention hour', HALF_PAST_RETENTION_HOUR],
  ])('runs no job at %s', async (_name, now) => {
    const { env, prepare, list } = createFakeEnvironment({ total: SAFE_TOTAL });
    await runScheduled({ cron: SCHEDULED_CRON, now, env });
    expect(prepare).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('runs both the budget check and the retention at the 03:00 UTC tick', async () => {
    const { env, prepare, list } = createFakeEnvironment({ total: SAFE_TOTAL });
    await runScheduled({ cron: SCHEDULED_CRON, now: RETENTION_TICK, env });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('does not run the retention an hour after its tick', async () => {
    const { env, list } = createFakeEnvironment({ total: SAFE_TOTAL });
    await runScheduled({ cron: SCHEDULED_CRON, now: AFTER_RETENTION_HOUR, env });
    expect(list).not.toHaveBeenCalled();
  });

  it('rejects an unknown cron naming it and runs nothing', async () => {
    const { env, prepare, list } = createFakeEnvironment({ total: SAFE_TOTAL });
    await expect(runScheduled({ cron: UNKNOWN_CRON, now: RETENTION_TICK, env })).rejects.toThrow(UNKNOWN_CRON);
    expect(prepare).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it('runs the retention in the same tick after the budget check failed, then re-throws the first error', async () => {
    const { env, list } = createFakeEnvironment({ total: WARNING_TOTAL });
    await expect(runScheduled({ cron: SCHEDULED_CRON, now: RETENTION_TICK, env })).rejects.toThrow(TODAY);
    expect(list).toHaveBeenCalledTimes(1);
  });
});
