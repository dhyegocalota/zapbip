import { AccountReplyIntent, CommandKind } from '@zapbip/types';
import type { AccountCommandResult } from '../account-types';
import { isReservedAgentName, normalizeAgentName } from '../agent-name';
import { buildResult, buildTextReply } from './account-reply';
import { buildInstallPromptReply } from './install-prompt-reply';
import { sealInstallCode } from './seal-install-code';
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
  const { installCode, columns } = await sealInstallCode({ dependencies, secret: issued.secret });
  const isRotated = await dependencies.connections.rotate({
    accountId,
    agent,
    fromDigest: current.secretDigest,
    toDigest: issued.digest,
    installCode: columns,
    rotatedAt: dependencies.clock.now(),
  });
  if (!isRotated) return notFound;
  const reply = buildInstallPromptReply({ ...input, intent: AccountReplyIntent.Rotated, agent, installCode });
  const oldInstallCode = {
    installCodeDigest: current.installCodeDigest,
    installCodeSealedSecret: current.installCodeSealedSecret,
    installCodeExpiresAt: current.installCodeExpiresAt,
  };
  const compensation = {
    connectionId: current.connectionId,
    agent,
    oldDigest: current.secretDigest,
    newDigest: issued.digest,
    oldInstallCode,
  };
  return buildResult({ replies: [reply], compensation });
}
