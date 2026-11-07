import { describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../../src/contract/env';
import { runScheduled, type ScheduledJob } from '../../src/operations/scheduled';

const NOW = 1_000;
const CRON = '*/30 * * * *';
const environment = {} as Bindings;

function jobOf(input: { isDue?: boolean; error?: Error }): ScheduledJob & { run: ReturnType<typeof vi.fn> } {
  const { isDue = true, error } = input;
  return {
    isDue: () => isDue,
    run: vi.fn(async () => {
      if (error !== undefined) throw error;
    }),
  };
}

describe('runScheduled dispatch', () => {
  it('runs every job that is due on the tick with the scheduled time', async () => {
    const first = jobOf({});
    const second = jobOf({});
    await runScheduled({ cron: CRON, now: NOW, env: environment, jobs: { first, second } });
    expect(first.run).toHaveBeenCalledWith({ env: environment, now: NOW });
    expect(second.run).toHaveBeenCalledWith({ env: environment, now: NOW });
  });

  it('skips a job that is not due', async () => {
    const due = jobOf({});
    const notDue = jobOf({ isDue: false });
    await runScheduled({ cron: CRON, now: NOW, env: environment, jobs: { due, notDue } });
    expect(due.run).toHaveBeenCalledTimes(1);
    expect(notDue.run).not.toHaveBeenCalled();
  });

  it('asks each job about the scheduled time', async () => {
    const isDue = vi.fn(() => false);
    await runScheduled({ cron: CRON, now: NOW, env: environment, jobs: { only: { isDue, run: vi.fn() } } });
    expect(isDue).toHaveBeenCalledWith({ now: NOW });
  });

  it('runs the jobs after a failing one and rethrows the first failure', async () => {
    const failing = jobOf({ error: new Error('first failed') });
    const alsoFailing = jobOf({ error: new Error('second failed') });
    const healthy = jobOf({});
    await expect(runScheduled({ cron: CRON, now: NOW, env: environment, jobs: { failing, alsoFailing, healthy } })).rejects.toThrow(
      'first failed',
    );
    expect(healthy.run).toHaveBeenCalledTimes(1);
    expect(alsoFailing.run).toHaveBeenCalledTimes(1);
  });

  it('resolves when no job is due', async () => {
    await expect(
      runScheduled({ cron: CRON, now: NOW, env: environment, jobs: { idle: jobOf({ isDue: false }) } }),
    ).resolves.toBeUndefined();
  });
});
