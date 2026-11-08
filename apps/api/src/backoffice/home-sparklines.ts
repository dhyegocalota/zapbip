import type { NumberStateCounts } from './views/home';

export enum SparklineMetric {
  Numbers = 'numbers',
  Messages = 'messages',
  Audit = 'audit',
}

export type HomeOverview = { counts: NumberStateCounts; series: Record<SparklineMetric, number[]> };

export function readHomeOverview(_input: { database: D1Database; now: number }): Promise<HomeOverview> {
  throw new Error('readHomeOverview is not implemented');
}
