import { AccountReplyIntent } from '@zapbip/types';
import type { AgentName } from '../../inbox/connection';
import type { ConnectionRecord } from '../account-types';
import { isReservedAgentName, normalizeAgentName } from '../agent-name';
import type { AccountDependencies } from '../ports';

export type NewAgentNameCheck = { agent: AgentName; refusal: null } | { agent: AgentName | null; refusal: AccountReplyIntent };

export type ExistingAgentCheck =
  | { agent: AgentName; existing: ConnectionRecord; refusal: null }
  | { agent: AgentName | null; existing: null; refusal: AccountReplyIntent };

export function checkNewAgentName(input: { rawName: string }): NewAgentNameCheck {
  const agent = normalizeAgentName({ rawName: input.rawName });
  if (agent === null) return { agent, refusal: AccountReplyIntent.InvalidName };
  if (isReservedAgentName({ name: agent })) return { agent, refusal: AccountReplyIntent.ReservedName };
  return { agent, refusal: null };
}

export async function checkExistingAgent(input: {
  dependencies: AccountDependencies;
  accountId: string;
  rawName: string;
}): Promise<ExistingAgentCheck> {
  const { dependencies, accountId } = input;
  const agent = normalizeAgentName({ rawName: input.rawName });
  const notFound = { agent, existing: null, refusal: AccountReplyIntent.NotFound } as const;
  if (agent === null || isReservedAgentName({ name: agent })) return notFound;
  const existing = await dependencies.connections.findActiveByAgent({ accountId, agent });
  if (existing === null) return notFound;
  return { agent, existing, refusal: null };
}
