import { AccountPlan, PRICING_FREE_MESSAGES, type AccountState } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import type { AgentRecord } from '../inbox/inbox-records';
import type { AccountRecord, ConnectionRecord } from './account-types';
import { maskedPhoneOf } from './masked-phone';

export type AgentSummary = { agent: AgentName; clientName: string | null; createdAt: number; lastSeenAt: number | null };

export type AccountOverview = { state: AccountState; phone: string; plan: AccountPlan; freeMessages: number; agents: AgentSummary[] };

function summaryOf(input: { connection: ConnectionRecord; lastSeenAt: Map<AgentName, number> }): AgentSummary {
  const { connection, lastSeenAt } = input;
  const seenAt = lastSeenAt.get(connection.agent);
  return {
    agent: connection.agent,
    clientName: connection.clientName,
    createdAt: connection.createdAt,
    lastSeenAt: seenAt === undefined ? null : seenAt,
  };
}

export function buildAccountOverview(input: {
  account: Pick<AccountRecord, 'state' | 'waId'>;
  connections: ConnectionRecord[];
  activity: AgentRecord[];
}): AccountOverview {
  const { account, connections, activity } = input;
  const lastSeenAt = new Map(activity.map((entry) => [entry.agent, entry.lastSeenAt]));
  return {
    state: account.state,
    phone: maskedPhoneOf({ waId: account.waId }),
    plan: AccountPlan.Free,
    freeMessages: PRICING_FREE_MESSAGES,
    agents: connections.map((connection) => summaryOf({ connection, lastSeenAt })),
  };
}
