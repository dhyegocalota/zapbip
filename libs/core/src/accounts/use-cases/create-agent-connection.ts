import { AccountReplyIntent, AccountReplyParameter, CommandKind, IdPrefix, RegisterOutcome } from '@zapbip/types';
import type { AccountCommandResult } from '../account-types';
import { isReservedAgentName, normalizeAgentName } from '../agent-name';
import { AGENTS_PER_ACCOUNT_LIMIT, NO_INSTALL_CODE } from '../constants';
import { buildResult, buildTextReply } from './account-reply';
import { buildInstallPromptReply } from './install-prompt-reply';
import { sealInstallCode } from './seal-install-code';
import type { CreateAgentConnectionInput } from './types';
import { buildUsageReply } from './usage-reply';

export async function createAgentConnection(input: CreateAgentConnectionInput): Promise<AccountCommandResult> {
  const { dependencies, account, rawName } = input;
  const { locale, accountId } = account;
  const refuse = (refusal: { intent: AccountReplyIntent; agent?: string }): AccountCommandResult => {
    const parameters = refusal.agent === undefined ? {} : { [AccountReplyParameter.AgentName]: refusal.agent };
    return buildResult({ replies: [buildTextReply({ intent: refusal.intent, locale, parameters })] });
  };
  if (rawName.trim() === '') return buildResult({ replies: [buildUsageReply({ kind: CommandKind.CreateAgent, locale })] });
  const agent = normalizeAgentName({ rawName });
  if (agent === null) return refuse({ intent: AccountReplyIntent.InvalidName });
  if (isReservedAgentName({ name: agent })) return refuse({ intent: AccountReplyIntent.ReservedName });
  const existing = await dependencies.connections.findActiveByAgent({ accountId, agent });
  if (existing !== null) return refuse({ intent: AccountReplyIntent.NameTaken, agent });
  const issued = await dependencies.connectionSecrets.issue();
  const { installCode, columns } = await sealInstallCode({ dependencies, secret: issued.secret });
  const connection = {
    connectionId: dependencies.ids.next({ prefix: IdPrefix.Connection }),
    accountId,
    agent,
    secretDigest: issued.digest,
    createdAt: dependencies.clock.now(),
    ...columns,
  };
  const outcome = await dependencies.connections.register({ connection, activeLimit: AGENTS_PER_ACCOUNT_LIMIT });
  if (outcome === RegisterOutcome.NameTaken) return refuse({ intent: AccountReplyIntent.NameTaken, agent });
  if (outcome === RegisterOutcome.LimitReached) {
    const parameters = { [AccountReplyParameter.Limit]: String(AGENTS_PER_ACCOUNT_LIMIT) };
    return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.LimitReached, locale, parameters })] });
  }
  await dependencies.revocations.recordCreation({ accountId, agent, secretDigest: issued.digest });
  const reply = buildInstallPromptReply({ ...input, intent: AccountReplyIntent.Created, agent, installCode });
  const compensation = {
    connectionId: connection.connectionId,
    agent,
    oldDigest: null,
    newDigest: issued.digest,
    oldInstallCode: NO_INSTALL_CODE,
  };
  return buildResult({ replies: [reply], compensation });
}
