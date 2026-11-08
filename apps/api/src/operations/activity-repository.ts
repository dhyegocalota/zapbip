import type { ActivityMetric } from '../contract/activity-metric';

export type ActivityEntry = { day: string; metric: ActivityMetric; count: number };

export interface ActivityRepository {
  reportActivity(input: { accountId: string; entries: ActivityEntry[] }): Promise<void>;
}
