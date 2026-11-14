import { AccountReplyIntent, AccountReplyParameter, AccountState, AgentCommandRecipient, CommandKind } from '@zapbip/types';
import { isOwnerWindowOpen } from '../../inbox/window';
import { firstReplyOf, parameterOf } from './account-reply';
import { applyOwnerCommand } from './apply-owner-command';
import { loadOwnerAccount } from './load-owner-account';
import { sendAccountReplies } from './send-account-replies';
import type { AgentCommandResult, ApplyAgentCommandInput } from './types';

const INACTIVE_INTENTS: Record<Exclude<AccountState, AccountState.Active>, AccountReplyIntent> = {
  [AccountState.Waitlisted]: AccountReplyIntent.Waitlisted,
  [AccountState.Suspended]: AccountReplyIntent.Suspended,
  [AccountState.Deleting]: AccountReplyIntent.Suspended,
};

const SECRET_COMMAND_KINDS: ReadonlySet<CommandKind> = new Set([CommandKind.Login, CommandKind.CreateAgent]);

function refusal(input: { intent: AccountReplyIntent }): AgentCommandResult {
  return { intent: input.intent, installPrompt: null };
}

export async function applyAgentCommand(input: ApplyAgentCommandInput): Promise<AgentCommandResult> {
  const { dependencies, connection, command, recipient, publicOrigin, appOrigin } = input;
  const account = await loadOwnerAccount({ dependencies, accountId: connection.accountId });
  if (account.state !== AccountState.Active) return refusal({ intent: INACTIVE_INTENTS[account.state] });
  const isDeliveredToOwner = recipient === AgentCommandRecipient.Owner;
  if (isDeliveredToOwner && SECRET_COMMAND_KINDS.has(command.kind)) {
    const window = await dependencies.repository.findWindow();
    if (!isOwnerWindowOpen({ window, now: dependencies.clock.now() })) return refusal({ intent: AccountReplyIntent.WindowClosed });
  }
  const result = await applyOwnerCommand({ dependencies, account, publicOrigin, appOrigin, command, isRequestLive: false });
  const reply = firstReplyOf({ result });
  if (!isDeliveredToOwner) {
    return { intent: reply.intent, installPrompt: parameterOf({ reply, name: AccountReplyParameter.InstallPrompt }) };
  }
  const isDelivered = await sendAccountReplies({ dependencies, account, result });
  if (!isDelivered) return refusal({ intent: AccountReplyIntent.SendFailed });
  return refusal({ intent: reply.intent });
}
