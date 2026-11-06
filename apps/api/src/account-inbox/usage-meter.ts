import { HOUR_MS, SECOND_MS } from '@zapbip/types';
import {
  DAILY_BUDGET_WARNING_RATIO,
  DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS,
  DURABLE_OBJECT_MEMORY_GIGABYTES,
} from '../operations/constants';

const USAGE_FLUSH_INTERVAL_MS = HOUR_MS;
const ISO_DAY_LENGTH = 'YYYY-MM-DD'.length;

export function gigabyteSecondsForDuration(input: { durationMs: number }): number {
  if (input.durationMs < 0) throw new Error('durationMs must not be negative');
  return (input.durationMs / SECOND_MS) * DURABLE_OBJECT_MEMORY_GIGABYTES;
}

export function isBudgetWarning(input: { gigabyteSeconds: number }): boolean {
  return input.gigabyteSeconds >= DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS * DAILY_BUDGET_WARNING_RATIO;
}

export function usageFlushDueAt(input: { lastFlushedAt: number | null; now: number }): number {
  const flushBaseline = input.lastFlushedAt === null ? input.now : input.lastFlushedAt;
  return flushBaseline + USAGE_FLUSH_INTERVAL_MS;
}

export function utcDay(input: { now: number }): string {
  return new Date(input.now).toISOString().slice(0, ISO_DAY_LENGTH);
}
