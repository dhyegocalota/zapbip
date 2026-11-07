import { PERCENT_MULTIPLIER } from '@zapbip/types';
import { ActivityMetric } from '../../contract/activity-metric';
import type { ActivityTotal, DayTotal } from './metrics-report';

export type WakeDay = { woken: number; unreached: number };

export function sumOf(input: { values: number[] }): number {
  return input.values.reduce((total, value) => total + value, 0);
}

export function dailySeries(input: { days: string[]; rows: DayTotal[] }): number[] {
  return input.days.map((day) => sumOf({ values: input.rows.filter((row) => row.day === day).map((row) => row.total) }));
}

export function activitySeries(input: { days: string[]; rows: ActivityTotal[]; metric: ActivityMetric }): number[] {
  const metricRows = input.rows.filter((row) => row.metric === input.metric);
  return dailySeries({ days: input.days, rows: metricRows });
}

export function wakeDays(input: { days: string[]; rows: ActivityTotal[] }): WakeDay[] {
  return input.days.map((day) => {
    const dayRows = input.rows.filter((row) => row.day === day);
    return {
      woken: sumOf({ values: dayRows.filter((row) => row.metric === ActivityMetric.WakesWoken).map((row) => row.total) }),
      unreached: sumOf({ values: dayRows.filter((row) => row.metric === ActivityMetric.WakesUnreached).map((row) => row.total) }),
    };
  });
}

export function wakeSuccessPercent(input: WakeDay): number | null {
  const attempts = input.woken + input.unreached;
  if (attempts === 0) return null;
  return (input.woken / attempts) * PERCENT_MULTIPLIER;
}
