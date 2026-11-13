import { AccountPlan, PRICING_FREE_MESSAGES, type AccountState } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import type { AgentRecord } from '../inbox/inbox-records';
import type { AccountRecord, ConnectionRecord } from './account-types';
import { maskedPhoneOf } from './masked-phone';

export type AgentSummary = { agent: AgentName; clientName: string | null; createdAt: number; lastSeenAt: number | null };

export type AccountOverview = { state: AccountState; phone: string; plan: AccountPlan; freeMessages: number; agents: AgentSummary[] };

export function buildAccountOverview(input: {
  account: Pick<AccountRecord, 'state' | 'waId'>;
  connections: ConnectionRecord[];
  activity: AgentRecord[];
}): AccountOverview {
  throw new Error('buildAccountOverview is not implemented');
}
