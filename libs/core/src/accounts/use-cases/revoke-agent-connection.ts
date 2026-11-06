import { AccountReplyIntent, AccountReplyParameter, CommandKind } from '@zapbip/types';
import type { AccountCommandResult } from '../account-types';
import { isReservedAgentName, normalizeAgentName } from '../agent-name';
import { buildResult, buildTextReply } from './account-reply';
import type { RevokeAgentConnectionInput } from './types';
import { buildUsageReply } from './usage-reply';

export async function revokeAgentConnection(input: RevokeAgentConnectionInput): Promise<AccountCommandResult> {
  const { dependencies, account, rawName } = input;
  const { locale, accountId } = account;
  const notFound = buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.NotFound, locale })] });
  if (rawName.trim() === '') return buildResult({ replies: [buildUsageReply({ kind: CommandKind.RevokeAgent, locale })] });
  const agent = normalizeAgentName({ rawName });
  if (agent === null || isReservedAgentName({ name: agent })) return notFound;
  const isRevoked = await dependencies.connections.revoke({ accountId, agent, revokedAt: dependencies.clock.now() });
  if (!isRevoked) return notFound;
  await dependencies.revocations.recordRevocation({ accountId, agent });
  const parameters = { [AccountReplyParameter.AgentName]: agent };
  return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.Revoked, locale, parameters })] });
}
