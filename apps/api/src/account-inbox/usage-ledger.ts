import { usageFlushDueAt } from './usage-meter';

const RECORD_STATEMENT = `INSERT INTO usage_meter (day, gigabyte_seconds, flushed_gigabyte_seconds, recorded_at, last_flushed_at)
  VALUES (?, ?, 0, ?, NULL)
  ON CONFLICT (day) DO UPDATE SET gigabyte_seconds = gigabyte_seconds + excluded.gigabyte_seconds`;
const LIST_UNFLUSHED_STATEMENT = `SELECT day, gigabyte_seconds AS gigabyteSeconds, recorded_at AS recordedAt, last_flushed_at AS lastFlushedAt
  FROM usage_meter WHERE gigabyte_seconds > flushed_gigabyte_seconds`;
const MARK_FLUSHED_STATEMENT = 'UPDATE usage_meter SET flushed_gigabyte_seconds = ?, last_flushed_at = ? WHERE day = ?';

type UnflushedRow = { day: string; gigabyteSeconds: number; recordedAt: number; lastFlushedAt: number | null };

export type UnflushedUsage = { day: string; gigabyteSeconds: number; dueAt: number };

export function recordUsage(input: { storage: DurableObjectStorage; day: string; gigabyteSeconds: number; now: number }): void {
  input.storage.sql.exec(RECORD_STATEMENT, input.day, input.gigabyteSeconds, input.now);
}

export function listUnflushedUsage(input: { storage: DurableObjectStorage }): UnflushedUsage[] {
  return input.storage.sql
    .exec<UnflushedRow>(LIST_UNFLUSHED_STATEMENT)
    .toArray()
    .map((row) => ({
      day: row.day,
      gigabyteSeconds: row.gigabyteSeconds,
      dueAt: usageFlushDueAt({ lastFlushedAt: row.lastFlushedAt, now: row.recordedAt }),
    }));
}

export function markUsageFlushed(input: { storage: DurableObjectStorage; day: string; gigabyteSeconds: number; now: number }): void {
  input.storage.sql.exec(MARK_FLUSHED_STATEMENT, input.gigabyteSeconds, input.now, input.day);
}
