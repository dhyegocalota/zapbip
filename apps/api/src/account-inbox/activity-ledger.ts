import type { ActivityMetric } from '../contract/activity-metric';

const RECORD_STATEMENT = `INSERT INTO activity_meter (day, metric, count, flushed_count, recorded_at, last_flushed_at)
  VALUES (?, ?, 1, 0, ?, NULL)
  ON CONFLICT (day, metric) DO UPDATE SET count = count + 1`;

export function recordActivity(input: { storage: DurableObjectStorage; day: string; metric: ActivityMetric; now: number }): void {
  input.storage.sql.exec(RECORD_STATEMENT, input.day, input.metric, input.now);
}
