import { DAY_MS } from '@zapbip/types';
import { BackofficeNotice } from '../backoffice-notice';
import type { NumberOption } from './metrics-report';
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

export type MetricsFilterParse = { filter: MetricsFilter } | { notice: BackofficeNotice };

export function parseMetricsFilter(input: { numberId: string | undefined; period: string | undefined }): MetricsFilterParse {
  const numberId = input.numberId === undefined || input.numberId === '' ? null : input.numberId;
  if (input.period === undefined) return { filter: { numberId, period: DEFAULT_PERIOD } };
  const period = Object.values(MetricsPeriod).find((candidate) => candidate === input.period);
  if (period === undefined) return { notice: BackofficeNotice.MetricsPeriodInvalid };
  return { filter: { numberId, period } };
}

export function periodDays(input: { period: MetricsPeriod }): number {
  return PERIOD_DAYS[input.period];
}

export function windowDays(input: { now: number; period: MetricsPeriod }): string[] {
  const count = periodDays({ period: input.period });
  return Array.from({ length: count }, (_, offset) => utcDay({ now: input.now - (count - 1 - offset) * DAY_MS }));
}

export function isKnownMetricsNumber(input: { filter: MetricsFilter; numbers: NumberOption[] }): boolean {
  const { numberId } = input.filter;
  if (numberId === null) return true;
  return input.numbers.some((option) => option.numberId === numberId);
}
