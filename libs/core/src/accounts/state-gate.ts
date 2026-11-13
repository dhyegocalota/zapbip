import { AccountReplyIntent, AccountState, AccountStateOutcome, CommandKind } from '@zapbip/types';
import type { AccountCommand, AccountStateVerdict } from './account-types';

type StateGateInput = {
  state: AccountState;
  command: AccountCommand | null;
  isFirstMessage: boolean;
  isText: boolean;
};

const WAITLISTED_COMMAND_KINDS: ReadonlySet<CommandKind> = new Set([
  CommandKind.Help,
  CommandKind.Login,
  CommandKind.RequestDeletion,
  CommandKind.ConfirmDeletion,
]);

const PROCEED: AccountStateVerdict = { outcome: AccountStateOutcome.Proceed, intent: null };
const DROP: AccountStateVerdict = { outcome: AccountStateOutcome.Drop, intent: null };

function replyWith(input: { intent: AccountReplyIntent }): AccountStateVerdict {
  return { outcome: AccountStateOutcome.Reply, intent: input.intent };
}

function evaluateWaitlisted(input: StateGateInput): AccountStateVerdict {
  const { command } = input;
  const isAllowedCommand = command !== null && WAITLISTED_COMMAND_KINDS.has(command.kind);
  if (isAllowedCommand) return PROCEED;
  return replyWith({ intent: AccountReplyIntent.Waitlisted });
}

function evaluateActive(input: StateGateInput): AccountStateVerdict {
  const isUnreadableFirstMessage = input.isFirstMessage && !input.isText;
  if (isUnreadableFirstMessage) return replyWith({ intent: AccountReplyIntent.Unknown });
  return PROCEED;
}

const STATE_EVALUATORS: Record<AccountState, (input: StateGateInput) => AccountStateVerdict> = {
  [AccountState.Waitlisted]: evaluateWaitlisted,
  [AccountState.Active]: evaluateActive,
  [AccountState.Suspended]: () => replyWith({ intent: AccountReplyIntent.Suspended }),
  [AccountState.Deleting]: () => DROP,
};

export function evaluateAccountState(input: StateGateInput): AccountStateVerdict {
  return STATE_EVALUATORS[input.state](input);
}
