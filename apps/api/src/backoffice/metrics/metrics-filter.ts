import { DAY_MS } from '@zapbip/types';
import { utcDay } from '../../account-inbox/usage-meter';

export enum MetricsPeriod {
  Week = '7',
  Month = '30',
}

export type MetricsFilter = { numberId: string | null; period: MetricsPeriod };

export const NUMBER_QUERY = 'number';
export const PERIOD_QUERY = 'period';

const DEFAULT_PERIOD = MetricsPeriod.Month;
const PERIOD_DAYS: Record<MetricsPeriod, number> = {
  [MetricsPeriod.Week]: 7,
  [MetricsPeriod.Month]: 30,
};

function periodOf(input: { value: string | undefined }): MetricsPeriod {
  const period = Object.values(MetricsPeriod).find((candidate) => candidate === input.value);
  if (period === undefined) return DEFAULT_PERIOD;
  return period;
}

export function parseMetricsFilter(input: { numberId: string | undefined; period: string | undefined }): MetricsFilter {
  const period = periodOf({ value: input.period });
  if (input.numberId === undefined || input.numberId === '') return { numberId: null, period };
  return { numberId: input.numberId, period };
}

export function periodDays(input: { period: MetricsPeriod }): number {
  return PERIOD_DAYS[input.period];
}

export function windowDays(input: { now: number; period: MetricsPeriod }): string[] {
  const count = periodDays({ period: input.period });
  return Array.from({ length: count }, (_, offset) => utcDay({ now: input.now - (count - 1 - offset) * DAY_MS }));
}
