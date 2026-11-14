import { AccountReplyIntent, AccountReplyParameter, CommandKind } from '@zapbip/types';
import type { AccountCommandResult } from '../account-types';
import { buildResult, buildTextReply } from './account-reply';
import { checkExistingAgent } from './check-agent-name';
import type { RevokeAgentConnectionInput } from './types';
import { buildUsageReply } from './usage-reply';

export async function revokeAgentConnection(input: RevokeAgentConnectionInput): Promise<AccountCommandResult> {
  const { dependencies, account, rawName } = input;
  const { locale, accountId } = account;
  const notFound = buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.NotFound, locale })] });
  if (rawName.trim() === '') return buildResult({ replies: [buildUsageReply({ kind: CommandKind.RevokeAgent, locale })] });
  const { agent, existing, refusal } = await checkExistingAgent({ dependencies, accountId, rawName });
  if (refusal !== null) return notFound;
  const isRevoked = await dependencies.connections.revoke({ accountId, agent, revokedAt: dependencies.clock.now() });
  if (!isRevoked) return notFound;
  await dependencies.revocations.recordRevocation({ accountId, agent });
  const parameters = { [AccountReplyParameter.AgentName]: agent };
  return buildResult({
    replies: [buildTextReply({ intent: AccountReplyIntent.Revoked, locale, parameters })],
    connectionId: existing.connectionId,
  });
}
