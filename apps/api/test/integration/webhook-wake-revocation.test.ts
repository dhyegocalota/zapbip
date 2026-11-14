import { WakeMode, WakeStatus } from '@zapbip/types';
import { reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPlatformClock } from '../../src/adapters/platform/clock';
import { createSqliteWakeRepository } from '../../src/adapters/sqlite/sqlite-wake-repository';
import { advanceClock, receiveOwnerText } from '../support/inbox-session';
import {
  ACCEPTED,
  DEBOUNCE_ADVANCE_MS,
  WAKE_AGENT,
  enablePinnedWake,
  mentionText,
  expectOk,
  readRequests,
  readWakeJobs,
  readWakeRow,
  wakeStub,
  applyWakeDirectory,
} from '../support/wake-session';

const OTHER_AGENT = 'beta';
const POLLED_AT = 1_000;
const LATER_ADVANCE_MS = 60_000;

let stub: DurableObjectStub<DevAccountInbox>;

function withWakeRepository<Result>(input: { run: (repository: ReturnType<typeof createSqliteWakeRepository>) => Promise<Result> }) {
  return runInDurableObject(stub, (_instance, state) =>
    input.run(createSqliteWakeRepository({ storage: state.storage, clock: createPlatformClock() })),
  );
}

afterEach(async () => {
  await reset();
});

beforeEach(applyWakeDirectory);

beforeEach(() => {
  stub = wakeStub({});
});

describe('clearWake', () => {
  beforeEach(async () => {
    await enablePinnedWake({ stub });
    expectOk(await receiveOwnerText({ stub, text: mentionText({ text: 'oi' }) }));
  });

  it('clears the target, the failure and the pending job', async () => {
    expect(await readWakeJobs({ stub })).toHaveLength(1);
    await withWakeRepository({ run: (repository) => repository.clearWake({ agent: WAKE_AGENT }) });
    const stored = await withWakeRepository({ run: (repository) => repository.findWake({ agent: WAKE_AGENT }) });
    expect(stored).toMatchObject({ mode: WakeMode.None, target: null, status: WakeStatus.Active });
    expect(await readWakeJobs({ stub })).toEqual([]);
  });

  it('sends no request for a later owner message', async () => {
    await stub.devScriptWake({ agent: WAKE_AGENT, responses: [ACCEPTED] });
    await withWakeRepository({ run: (repository) => repository.clearWake({ agent: WAKE_AGENT }) });
    expectOk(await receiveOwnerText({ stub, text: mentionText({ text: 'de novo' }) }));
    await advanceClock({ stub, advanceMs: DEBOUNCE_ADVANCE_MS });
    await runDurableObjectAlarm(stub);
    expect(await readRequests({ stub })).toEqual([]);
  });
});

describe('recordRevocation', () => {
  it('deletes the pending wake job and sends no request', async () => {
    await enablePinnedWake({ stub });
    await stub.devScriptWake({ agent: WAKE_AGENT, responses: [ACCEPTED] });
    expectOk(await receiveOwnerText({ stub, text: mentionText({ text: 'oi' }) }));
    expect(await readWakeJobs({ stub })).toHaveLength(1);
    await stub.recordRevocation({ agent: WAKE_AGENT });
    expect(await readWakeJobs({ stub })).toEqual([]);
    await advanceClock({ stub, advanceMs: DEBOUNCE_ADVANCE_MS });
    await runDurableObjectAlarm(stub);
    expect(await readRequests({ stub })).toEqual([]);
  });
});

describe('wake storage', () => {
  it('resolves clearWake for an agent with no wake', async () => {
    await expect(withWakeRepository({ run: (repository) => repository.clearWake({ agent: OTHER_AGENT }) })).resolves.toBeUndefined();
    expect(await withWakeRepository({ run: (repository) => repository.findWake({ agent: OTHER_AGENT }) })).toBeNull();
  });

  it('keeps last_polled_at when set_wake saves after a poll', async () => {
    await enablePinnedWake({ stub });
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec('UPDATE agent_wake SET last_polled_at = ? WHERE agent = ?', POLLED_AT, WAKE_AGENT);
    });
    const startedAt = Date.now();
    const offsetMs = await advanceClock({ stub, advanceMs: LATER_ADVANCE_MS });
    await enablePinnedWake({ stub });
    const row = await readWakeRow({ stub });
    expect(row.last_polled_at).toBe(POLLED_AT);
    expect(row.updated_at).toBeGreaterThanOrEqual(startedAt + offsetMs);
  });

  it('reports the later of the due time and the lease end as the next due time', async () => {
    await withWakeRepository({
      run: async (repository) => {
        await repository.saveJob({ job: { agent: WAKE_AGENT, dueAt: 100, attempt: 0, leaseUntil: 500, rewake: false, lastOutcome: null } });
        await repository.saveJob({
          job: { agent: OTHER_AGENT, dueAt: 300, attempt: 0, leaseUntil: null, rewake: false, lastOutcome: null },
        });
      },
    });
    expect(await withWakeRepository({ run: (repository) => repository.findNextDueAt() })).toBe(300);
  });

  it('lists every job due at or before the time, leased or not, oldest first', async () => {
    await withWakeRepository({
      run: async (repository) => {
        await repository.saveJob({ job: { agent: WAKE_AGENT, dueAt: 200, attempt: 0, leaseUntil: 900, rewake: true, lastOutcome: null } });
        await repository.saveJob({
          job: { agent: OTHER_AGENT, dueAt: 100, attempt: 2, leaseUntil: null, rewake: false, lastOutcome: null },
        });
      },
    });
    const due = await withWakeRepository({ run: (repository) => repository.listDueJobs({ now: 200 }) });
    expect(due.map((job) => job.agent)).toEqual([OTHER_AGENT, WAKE_AGENT]);
    expect(due[1]).toMatchObject({ rewake: true, leaseUntil: 900 });
  });

  it('reports no next due time without jobs', async () => {
    expect(await withWakeRepository({ run: (repository) => repository.findNextDueAt() })).toBeNull();
  });
});
