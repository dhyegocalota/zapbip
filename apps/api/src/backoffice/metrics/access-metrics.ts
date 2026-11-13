import { ActivityMetric } from '../../contract/activity-metric';
import { ACCESS_MONTH_DAYS, ACCESS_WEEK_DAYS, lastDays } from './metrics-filter';
import type { AccessReport, DayTotal, ReleaseTotals } from './metrics-report';
import { activitySeries, dailySeries, sumOf } from './metrics-series';

export type AccessWindowFigures = {
  joins: number;
  invited: number;
  used: number;
  released: number;
  releasedConnected: number;
  messages: number;
  questions: number;
};

export type AccessWindow = { dayCount: number; released: ReleaseTotals };

function totalIn(input: { days: string[]; rows: DayTotal[] }): number {
  return sumOf({ values: dailySeries(input) });
}

export function accessWindowOf(input: { access: AccessReport; dayCount: number }): AccessWindow {
  const { access, dayCount } = input;
  const released = dayCount === ACCESS_WEEK_DAYS ? access.releasedSevenDays : access.releasedThirtyDays;
  return { dayCount, released };
}

export function accessWindowFigures(input: { access: AccessReport; now: number; window: AccessWindow }): AccessWindowFigures {
  const { access, now, window } = input;
  const days = lastDays({ now, count: window.dayCount });
  const activityIn = (metric: ActivityMetric): number => sumOf({ values: activitySeries({ days, rows: access.activity, metric }) });
  return {
    joins: totalIn({ days, rows: access.waitlistJoined }),
    invited: totalIn({ days, rows: access.invitesIssued }),
    used: totalIn({ days, rows: access.invitesUsed }),
    released: window.released.released,
    releasedConnected: window.released.connected,
    messages: activityIn(ActivityMetric.MessagesIn) + activityIn(ActivityMetric.MessagesOut),
    questions: activityIn(ActivityMetric.QuestionsAnswered),
  };
}

export function accessMonthSeries(input: { access: AccessReport; now: number }): {
  joins: number[];
  messages: number[];
  questions: number[];
} {
  const { access, now } = input;
  const days = lastDays({ now, count: ACCESS_MONTH_DAYS });
  const messageMetrics: ActivityMetric[] = [ActivityMetric.MessagesIn, ActivityMetric.MessagesOut];
  return {
    joins: dailySeries({ days, rows: access.waitlistJoined }),
    messages: dailySeries({ days, rows: access.activity.filter((row) => messageMetrics.includes(row.metric)) }),
    questions: activitySeries({ days, rows: access.activity, metric: ActivityMetric.QuestionsAnswered }),
  };
}

export function waitlistTotalOf(input: { access: AccessReport }): number {
  return sumOf({ values: input.access.waitlistByLocale.map((entry) => entry.total) });
}
