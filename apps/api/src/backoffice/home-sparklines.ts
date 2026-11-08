import { DAY_MS, WhatsAppNumberState } from '@zapbip/types';
import { utcDay } from '../account-inbox/usage-meter';
import { ActivityMetric } from '../contract/activity-metric';
import { SPARKLINE_DAYS } from './backoffice-constants';
import { lastDays } from './metrics/metrics-filter';
import type { DayTotal } from './metrics/metrics-report';
import { dailySeries } from './metrics/metrics-series';
import type { NumberStateCounts } from './views/home';

export enum SparklineMetric {
  Numbers = 'numbers',
  Messages = 'messages',
  Audit = 'audit',
}

export type HomeOverview = { counts: NumberStateCounts; series: Record<SparklineMetric, number[]> };

enum HomeQuery {
  StateCounts,
  NumbersRegistered,
  Messages,
  AuditEntries,
}

const REGISTERED_DAY = "strftime('%Y-%m-%d', created_at / 1000, 'unixepoch')";
const AUDIT_DAY = "strftime('%Y-%m-%d', at / 1000, 'unixepoch')";
const STATE_COUNTS_STATEMENT = 'SELECT state, COUNT(*) AS total FROM whatsapp_numbers GROUP BY state';
const NUMBERS_REGISTERED_STATEMENT =
  'SELECT ' + REGISTERED_DAY + ' AS day, COUNT(*) AS total FROM whatsapp_numbers WHERE created_at >= ?1 GROUP BY day';
const MESSAGES_STATEMENT = 'SELECT day, SUM(count) AS total FROM activity_daily WHERE day >= ?1 AND metric IN (?2, ?3) GROUP BY day';
const AUDIT_ENTRIES_STATEMENT = 'SELECT ' + AUDIT_DAY + ' AS day, COUNT(*) AS total FROM backoffice_audit WHERE at >= ?1 GROUP BY day';
const EMPTY_COUNTS: NumberStateCounts = {
  [WhatsAppNumberState.Pending]: 0,
  [WhatsAppNumberState.Active]: 0,
  [WhatsAppNumberState.Closed]: 0,
  [WhatsAppNumberState.Disabled]: 0,
};

function resultRows<Row>(input: { results: D1Result[]; query: HomeQuery }): Row[] {
  const result = input.results[input.query];
  if (result === undefined) throw new Error(`the home batch returned no result for ${HomeQuery[input.query]}`);
  return result.results as Row[];
}

export async function readHomeOverview(input: { database: D1Database; now: number }): Promise<HomeOverview> {
  const { database, now } = input;
  const sinceDay = utcDay({ now: now - (SPARKLINE_DAYS - 1) * DAY_MS });
  const sinceAt = Date.parse(sinceDay);
  const results = await database.batch([
    database.prepare(STATE_COUNTS_STATEMENT),
    database.prepare(NUMBERS_REGISTERED_STATEMENT).bind(sinceAt),
    database.prepare(MESSAGES_STATEMENT).bind(sinceDay, ActivityMetric.MessagesIn, ActivityMetric.MessagesOut),
    database.prepare(AUDIT_ENTRIES_STATEMENT).bind(sinceAt),
  ]);
  const days = lastDays({ now, count: SPARKLINE_DAYS });
  const seriesOf = (query: HomeQuery): number[] => dailySeries({ days, rows: resultRows<DayTotal>({ results, query }) });
  const counts = resultRows<{ state: WhatsAppNumberState; total: number }>({
    results,
    query: HomeQuery.StateCounts,
  }).reduce<NumberStateCounts>((current, row) => ({ ...current, [row.state]: row.total }), EMPTY_COUNTS);
  return {
    counts,
    series: {
      [SparklineMetric.Numbers]: seriesOf(HomeQuery.NumbersRegistered),
      [SparklineMetric.Messages]: seriesOf(HomeQuery.Messages),
      [SparklineMetric.Audit]: seriesOf(HomeQuery.AuditEntries),
    },
  };
}
