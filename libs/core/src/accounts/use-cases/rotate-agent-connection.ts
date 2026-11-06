import { AccountReplyIntent, CommandKind } from '@zapbip/types';
import type { AccountCommandResult } from '../account-types';
import { isReservedAgentName, normalizeAgentName } from '../agent-name';
import { buildResult, buildTextReply } from './account-reply';
import { buildInstallPromptReply } from './install-prompt-reply';
import type { RotateAgentConnectionInput } from './types';
import { buildUsageReply } from './usage-reply';

export async function rotateAgentConnection(input: RotateAgentConnectionInput): Promise<AccountCommandResult> {
  const { dependencies, account, rawName } = input;
  const { locale, accountId } = account;
  const notFound = buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.NotFound, locale })] });
  if (rawName.trim() === '') return buildResult({ replies: [buildUsageReply({ kind: CommandKind.RotateAgent, locale })] });
  const agent = normalizeAgentName({ rawName });
  if (agent === null || isReservedAgentName({ name: agent })) return notFound;
  const current = await dependencies.connections.findActiveByAgent({ accountId, agent });
  if (current === null) return notFound;
  const issued = await dependencies.connectionSecrets.issue();
  const isRotated = await dependencies.connections.rotate({
    accountId,
    agent,
    fromDigest: current.secretDigest,
    toDigest: issued.digest,
    rotatedAt: dependencies.clock.now(),
  });
  if (!isRotated) return notFound;
  const reply = await buildInstallPromptReply({ ...input, intent: AccountReplyIntent.Rotated, agent, secret: issued.secret });
  const compensation = { connectionId: current.connectionId, agent, oldDigest: current.secretDigest, newDigest: issued.digest };
  return buildResult({ replies: [reply], compensation });
}
