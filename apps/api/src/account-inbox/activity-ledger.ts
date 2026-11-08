import type { ActivityMetric } from '../contract/activity-metric';
import { usageFlushDueAt } from './usage-meter';

const RECORD_STATEMENT = `INSERT INTO activity_meter (day, metric, count, flushed_count, recorded_at, last_flushed_at)
  VALUES (?, ?, 1, 0, ?, NULL)
  ON CONFLICT (day, metric) DO UPDATE SET count = count + 1`;
const LIST_UNFLUSHED_STATEMENT = `SELECT day, metric, count, recorded_at AS recordedAt, last_flushed_at AS lastFlushedAt
  FROM activity_meter WHERE count > flushed_count`;
const MARK_FLUSHED_STATEMENT = 'UPDATE activity_meter SET flushed_count = ?, last_flushed_at = ? WHERE day = ? AND metric = ?';
const PRUNE_STATEMENT = 'DELETE FROM activity_meter WHERE day < ? AND count <= flushed_count';

type UnflushedRow = { day: string; metric: ActivityMetric; count: number; recordedAt: number; lastFlushedAt: number | null };

export type UnflushedActivity = { day: string; metric: ActivityMetric; count: number; dueAt: number };

export function recordActivity(input: { storage: DurableObjectStorage; day: string; metric: ActivityMetric; now: number }): void {
  input.storage.sql.exec(RECORD_STATEMENT, input.day, input.metric, input.now);
}

export function listUnflushedActivity(input: { storage: DurableObjectStorage }): UnflushedActivity[] {
  return input.storage.sql
    .exec<UnflushedRow>(LIST_UNFLUSHED_STATEMENT)
    .toArray()
    .map((row) => ({
      day: row.day,
      metric: row.metric,
      count: row.count,
      dueAt: usageFlushDueAt({ lastFlushedAt: row.lastFlushedAt, now: row.recordedAt }),
    }));
}

export function markActivityFlushed(input: { storage: DurableObjectStorage; activity: UnflushedActivity; now: number }): void {
  const { activity, now } = input;
  input.storage.sql.exec(MARK_FLUSHED_STATEMENT, activity.count, now, activity.day, activity.metric);
}

export function pruneActivity(input: { storage: DurableObjectStorage; beforeDay: string }): void {
  input.storage.sql.exec(PRUNE_STATEMENT, input.beforeDay);
}
