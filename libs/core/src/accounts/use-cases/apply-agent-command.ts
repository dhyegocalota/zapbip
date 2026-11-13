import { AccountReplyIntent, AccountReplyParameter, AgentCommandRecipient } from '@zapbip/types';
import { firstReplyOf, parameterOf } from './account-reply';
import { applyOwnerCommand } from './apply-owner-command';
import { loadOwnerAccount } from './load-owner-account';
import { sendAccountReplies } from './send-account-replies';
import type { AgentCommandResult, ApplyAgentCommandInput } from './types';

export async function applyAgentCommand(input: ApplyAgentCommandInput): Promise<AgentCommandResult> {
  const { dependencies, connection, command, recipient, publicOrigin, appOrigin } = input;
  const account = await loadOwnerAccount({ dependencies, accountId: connection.accountId });
  const result = await applyOwnerCommand({ dependencies, account, publicOrigin, appOrigin, command, isRequestLive: false });
  const reply = firstReplyOf({ result });
  if (recipient === AgentCommandRecipient.Agent) {
    return { intent: reply.intent, installPrompt: parameterOf({ reply, name: AccountReplyParameter.InstallPrompt }) };
  }
  const isDelivered = await sendAccountReplies({ dependencies, account, result });
  if (!isDelivered) return { intent: AccountReplyIntent.SendFailed, installPrompt: null };
  return { intent: reply.intent, installPrompt: null };
}
