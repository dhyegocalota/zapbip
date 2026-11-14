import type { AccountState, WebLocale } from '@zapbip/types';
import type { ActivityMetric } from '../../contract/activity-metric';

export type DayTotal = { day: string; total: number };
export type ActivityTotal = { day: string; metric: ActivityMetric; total: number };
export type NumberOption = { numberId: string; label: string };
export type AccountStateTotal = { state: AccountState; total: number };
export type NumberAccountTotal = NumberOption & { total: number };
export type ClientTotal = { clientName: string | null; total: number };
export type AgentTotals = { active: number; connected: number };
export type RestrictedNumber = NumberOption & { restrictedAt: number };

export type LocaleTotal = { locale: WebLocale; total: number };
export type InviteTotals = { issued: number; used: number };
export type ReleaseTotals = { released: number; connected: number };
export type AccessReport = {
  waitlistByLocale: LocaleTotal[];
  waitlistJoined: DayTotal[];
  invitesIssued: DayTotal[];
  invitesUsed: DayTotal[];
  inviteTotals: InviteTotals;
  releasedAllTime: ReleaseTotals;
  releasedThirtyDays: ReleaseTotals;
  releasedSevenDays: ReleaseTotals;
  activity: ActivityTotal[];
};

export type MetricsReport = {
  numbers: NumberOption[];
  accountsByState: AccountStateTotal[];
  accountsPerNumber: NumberAccountTotal[];
  newAccounts: DayTotal[];
  agents: AgentTotals;
  agentsByClient: ClientTotal[];
  agentsCreated: DayTotal[];
  agentsRevoked: DayTotal[];
  activity: ActivityTotal[];
  budgetDays: DayTotal[];
  blockedPhones: number;
  restricted: RestrictedNumber[];
  access: AccessReport;
};
