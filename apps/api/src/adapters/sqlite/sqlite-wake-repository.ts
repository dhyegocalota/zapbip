import type { Clock, PollState, ScheduledWake, StoredWake, WakeJob, WakeRepository } from '@zapbip/core';
import { WakeMode, WakeStatus, type OwnerLocale, type WakeAttemptOutcome, type WakeProvider } from '@zapbip/types';

type WakeRow = {
  agent: string;
  mode: WakeMode;
  provider: WakeProvider | null;
  host: string | null;
  sealed_target: string | null;
  key_version: number | null;
  status: WakeStatus;
  last_delivered_at: number | null;
  interval_minutes: number | null;
  standby_agent: string | null;
  owner_locale: OwnerLocale | null;
};

type PollRow = WakeRow & {
  last_polled_at: number;
  has_polled: number;
  poller_stale_notified: number;
};

type JobRow = {
  agent: string;
  due_at: number;
  attempt: number;
  lease_until: number | null;
  rewake: number;
  last_outcome: WakeAttemptOutcome | null;
};

const WAKE_COLUMNS =
  'agent, mode, provider, host, sealed_target, key_version, status, last_delivered_at, interval_minutes, standby_agent, owner_locale';
const POLL_COLUMNS = 'last_polled_at, has_polled, poller_stale_notified';
const SELECT_WAKE = `SELECT ${WAKE_COLUMNS} FROM agent_wake WHERE agent = ?`;
const SELECT_POLL_STATE = `SELECT ${POLL_COLUMNS} FROM agent_wake WHERE agent = ?`;
const SELECT_SCHEDULED_WAKES = `SELECT ${WAKE_COLUMNS}, ${POLL_COLUMNS} FROM agent_wake WHERE mode = ? ORDER BY agent`;
const SAVE_WAKE_STATEMENT =
  'UPDATE agent_wake SET mode = ?, provider = ?, host = ?, sealed_target = ?, key_version = ?, status = ?, last_delivered_at = ?, interval_minutes = ?, standby_agent = ?, owner_locale = COALESCE(?, owner_locale), updated_at = ? WHERE agent = ?';
const RECORD_POLL_STATEMENT =
  'UPDATE agent_wake SET last_polled_at = ?, has_polled = 1, owner_locale = ?, poller_stale_notified = 0 WHERE agent = ?';
const MARK_STALE_NOTIFIED_STATEMENT = 'UPDATE agent_wake SET poller_stale_notified = 1 WHERE agent = ?';
const CLEAR_WAKE_STATEMENT =
  'UPDATE agent_wake SET mode = ?, provider = NULL, host = NULL, sealed_target = NULL, key_version = NULL, status = ?, updated_at = ? WHERE agent = ?';
const SELECT_JOB = 'SELECT agent, due_at, attempt, lease_until, rewake, last_outcome FROM wake_jobs ';
const SAVE_JOB_STATEMENT =
  'INSERT INTO wake_jobs (agent, due_at, attempt, lease_until, rewake, last_outcome) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (agent) DO UPDATE SET due_at = excluded.due_at, attempt = excluded.attempt, lease_until = excluded.lease_until, rewake = excluded.rewake, last_outcome = excluded.last_outcome';
const SELECT_NEXT_DUE_AT =
  'SELECT MIN(CASE WHEN lease_until IS NULL THEN due_at ELSE MAX(due_at, lease_until) END) AS next_due_at FROM wake_jobs';

function toStoredWake(row: WakeRow): StoredWake {
  if (row.mode === WakeMode.Scheduled && row.interval_minutes === null)
    throw new Error(`scheduled wake of ${row.agent} has no interval_minutes`);
  if (row.mode === WakeMode.Scheduled && row.owner_locale === null) throw new Error(`scheduled wake of ${row.agent} has no owner_locale`);
  if (row.mode === WakeMode.Standby && row.standby_agent === null) throw new Error(`standby wake of ${row.agent} has no standby_agent`);
  const { provider, host, sealed_target: sealedTarget, key_version: keyVersion } = row;
  const isTargetStored = provider !== null && host !== null && sealedTarget !== null && keyVersion !== null;
  return {
    agent: row.agent,
    mode: row.mode,
    target: isTargetStored ? { provider, host, sealedTarget, keyVersion } : null,
    status: row.status,
    lastDeliveredAt: row.last_delivered_at,
    intervalMinutes: row.interval_minutes,
    standbyAgent: row.standby_agent,
    ownerLocale: row.owner_locale,
  };
}

function toPollState(row: PollRow): PollState {
  return {
    lastPolledAt: row.last_polled_at,
    hasPolled: row.has_polled === 1,
    pollerStaleNotified: row.poller_stale_notified === 1,
  };
}

function toJob(row: JobRow): WakeJob {
  return {
    agent: row.agent,
    dueAt: row.due_at,
    attempt: row.attempt,
    leaseUntil: row.lease_until,
    rewake: row.rewake === 1,
    lastOutcome: row.last_outcome,
  };
}

export function createSqliteWakeRepository(input: { storage: DurableObjectStorage; clock: Clock }): WakeRepository {
  const { sql } = input.storage;

  function rows<Row extends Record<string, SqlStorageValue>>(statement: string, ...bindings: unknown[]): Row[] {
    return sql.exec<Row>(statement, ...bindings).toArray();
  }

  return {
    async findWake({ agent }) {
      const [row] = rows<WakeRow>(SELECT_WAKE, agent);
      return row === undefined ? null : toStoredWake(row);
    },

    async saveWake({ wake }) {
      const { target } = wake;
      const cursor = sql.exec(
        SAVE_WAKE_STATEMENT,
        wake.mode,
        target === null ? null : target.provider,
        target === null ? null : target.host,
        target === null ? null : target.sealedTarget,
        target === null ? null : target.keyVersion,
        wake.status,
        wake.lastDeliveredAt,
        wake.intervalMinutes,
        wake.standbyAgent,
        wake.ownerLocale,
        input.clock.now(),
        wake.agent,
      );
      if (cursor.rowsWritten === 0) throw new Error(`no agent_wake row for ${wake.agent}`);
    },

    async clearWake({ agent }) {
      input.storage.transactionSync(() => {
        sql.exec(CLEAR_WAKE_STATEMENT, WakeMode.None, WakeStatus.Active, input.clock.now(), agent);
        sql.exec('DELETE FROM wake_jobs WHERE agent = ?', agent);
      });
    },

    async findJob({ agent }) {
      const [row] = rows<JobRow>(`${SELECT_JOB}WHERE agent = ?`, agent);
      return row === undefined ? null : toJob(row);
    },

    async saveJob({ job }) {
      sql.exec(SAVE_JOB_STATEMENT, job.agent, job.dueAt, job.attempt, job.leaseUntil, job.rewake ? 1 : 0, job.lastOutcome);
    },

    async deleteJob({ agent }) {
      sql.exec('DELETE FROM wake_jobs WHERE agent = ?', agent);
    },

    async listDueJobs({ now }) {
      return rows<JobRow>(`${SELECT_JOB}WHERE due_at <= ? ORDER BY due_at, agent`, now).map(toJob);
    },

    async findNextDueAt() {
      const [row] = rows<{ next_due_at: number | null }>(SELECT_NEXT_DUE_AT);
      return row === undefined ? null : row.next_due_at;
    },

    async findPollState({ agent }) {
      const [row] = rows<PollRow>(SELECT_POLL_STATE, agent);
      return row === undefined ? null : toPollState(row);
    },

    async recordPoll({ agent, polledAt, ownerLocale }) {
      const cursor = sql.exec(RECORD_POLL_STATEMENT, polledAt, ownerLocale, agent);
      if (cursor.rowsWritten === 0) throw new Error(`no agent_wake row for ${agent}`);
    },

    async listScheduledWakes() {
      return rows<PollRow>(SELECT_SCHEDULED_WAKES, WakeMode.Scheduled).map((row): ScheduledWake => ({
        ...toStoredWake(row),
        ...toPollState(row),
      }));
    },

    async markStaleNotified({ agent }) {
      const cursor = sql.exec(MARK_STALE_NOTIFIED_STATEMENT, agent);
      if (cursor.rowsWritten === 0) throw new Error(`no agent_wake row for ${agent}`);
    },
  };
}
