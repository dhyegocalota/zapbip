import { OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { BackofficeNotice } from '../../src/backoffice/backoffice-notice';
import { MetricsPeriod, type MetricsFilter } from '../../src/backoffice/metrics/metrics-filter';
import type { MetricsReport } from '../../src/backoffice/metrics/metrics-report';
import type { PageContext } from '../../src/backoffice/page-context';
import type { NumberListEntry } from '../../src/numbers/number-admin';
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
    metaAppRef: 'app_one',
    displayNumber: '+5511900000001',
    label: 'Brazil',
    verifiedAt: NOW,
    verificationSnapshot: null,
    createdAt: NOW,
    updatedAt: NOW,
    credentialsChangedAt: NOW,
    metaAppLabel: 'Main app',
    metaAppUpdatedAt: NOW,
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
