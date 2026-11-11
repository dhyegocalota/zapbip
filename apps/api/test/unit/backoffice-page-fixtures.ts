import { AccountState, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { SPARKLINE_DAYS } from '../../src/backoffice/backoffice-constants';
import { BackofficeNotice } from '../../src/backoffice/backoffice-notice';
import { type HomeOverview, SparklineMetric } from '../../src/backoffice/home-sparklines';
import { MetricsPeriod, type MetricsFilter } from '../../src/backoffice/metrics/metrics-filter';
import type { MetricsReport } from '../../src/backoffice/metrics/metrics-report';
import type { PageContext } from '../../src/backoffice/page-context';
import type { NumberStateCounts } from '../../src/backoffice/views/home';
import type { NumberListEntry } from '../../src/numbers/number-admin';
import { ActivityMetric } from '../../src/contract/activity-metric';
import { DeployEnvironment } from '../../src/contract/deploy-environment';

export const NOW = Date.UTC(2026, 10, 7, 12);

export const PAGE: PageContext = {
  locale: OwnerLocale.EnglishUs,
  environment: DeployEnvironment.Production,
  stylesheetHref: '/assets/backoffice.css?v=1',
  csrfToken: 'token',
  notice: null,
};

export function pageIn(input: { locale: OwnerLocale; notice?: BackofficeNotice }): PageContext {
  const { notice = null } = input;
  return { ...PAGE, locale: input.locale, notice };
}

export function numberEntry(input: Partial<NumberListEntry>): NumberListEntry {
  return {
    numberId: 'num_one',
    phoneNumberId: '1000000000001',
    wabaId: '3000000000001',
    state: WhatsAppNumberState.Active,
    displayNumber: '+5511900000001',
    label: 'Brazil',
    verifiedAt: NOW,
    verificationSnapshot: null,
    createdAt: NOW,
    updatedAt: NOW,
    credentialsChangedAt: NOW,
    accountCount: 2,
    ...input,
  };
}

export const METRICS_FILTER: MetricsFilter = { numberId: null, period: MetricsPeriod.Week };

export const EMPTY_REPORT: MetricsReport = {
  numbers: [],
  accountsByState: [],
  accountsPerNumber: [],
  newAccounts: [],
  agents: { active: 0, connected: 0 },
  agentsByClient: [],
  agentsCreated: [],
  agentsRevoked: [],
  activity: [],
  budgetDays: [],
  blockedPhones: 0,
  restricted: [],
};

export const TODAY = '2026-11-07';

export const DATA_REPORT: MetricsReport = {
  numbers: [{ numberId: 'num_one', label: 'Brazil' }],
  accountsByState: [{ state: AccountState.Active, total: 3 }],
  accountsPerNumber: [{ numberId: 'num_one', label: 'Brazil', total: 3 }],
  newAccounts: [{ day: TODAY, total: 2 }],
  agents: { active: 2, connected: 1 },
  agentsByClient: [{ clientName: 'agent-one', total: 2 }],
  agentsCreated: [{ day: TODAY, total: 2 }],
  agentsRevoked: [{ day: TODAY, total: 1 }],
  activity: [
    { day: TODAY, metric: ActivityMetric.MessagesIn, total: 4 },
    { day: TODAY, metric: ActivityMetric.MessagesOut, total: 3 },
    { day: TODAY, metric: ActivityMetric.WakesWoken, total: 3 },
    { day: TODAY, metric: ActivityMetric.WakesUnreached, total: 1 },
  ],
  budgetDays: [{ day: TODAY, total: 10_600 }],
  blockedPhones: 1,
  restricted: [{ numberId: 'num_one', label: 'Brazil', restrictedAt: NOW }],
};

const RISING_SERIES = Array.from({ length: SPARKLINE_DAYS }, (_, index) => index);
const SILENT_SERIES = new Array<number>(SPARKLINE_DAYS).fill(0);

export function homeOverview(input: { counts: NumberStateCounts }): HomeOverview {
  return {
    counts: input.counts,
    series: { [SparklineMetric.Numbers]: RISING_SERIES, [SparklineMetric.Messages]: RISING_SERIES, [SparklineMetric.Audit]: SILENT_SERIES },
  };
}
