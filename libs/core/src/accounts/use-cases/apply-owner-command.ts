import { AccountReplyIntent, CommandKind } from '@zapbip/types';
import type { AccountCommand, AccountCommandResult } from '../account-types';
import { buildMenuReply, buildResult, buildTextReply } from './account-reply';
import { confirmAccountDeletion } from './confirm-account-deletion';
import { createAgentConnection } from './create-agent-connection';
import { issueSignInLink } from './issue-sign-in-link';
import { listAgentConnections } from './list-agent-connections';
import { requestAccountDeletion } from './request-account-deletion';
import { revokeAgentConnection } from './revoke-agent-connection';
import { rotateAgentConnection } from './rotate-agent-connection';
import type { ApplyOwnerCommandInput, OwnerAccountInput } from './types';

type CommandHandler = (input: OwnerAccountInput & { command: AccountCommand; isRequestLive: boolean }) => Promise<AccountCommandResult>;

const MISSING_NAME = '';

function nameOf(input: { command: AccountCommand }): string {
  const { rawName } = input.command;
  if (rawName === null) return MISSING_NAME;
  return rawName;
}

const COMMAND_HANDLERS: Record<CommandKind, CommandHandler> = {
  [CommandKind.CreateAgent]: (input) => createAgentConnection({ ...input, rawName: nameOf(input) }),
  [CommandKind.ListAgents]: listAgentConnections,
  [CommandKind.RevokeAgent]: (input) => revokeAgentConnection({ ...input, rawName: nameOf(input) }),
  [CommandKind.RotateAgent]: (input) => rotateAgentConnection({ ...input, rawName: nameOf(input) }),
  [CommandKind.Help]: async ({ account }) =>
    buildResult({ replies: [buildMenuReply({ intent: AccountReplyIntent.Menu, locale: account.locale })] }),
  [CommandKind.RequestDeletion]: requestAccountDeletion,
  [CommandKind.ConfirmDeletion]: confirmAccountDeletion,
  [CommandKind.Login]: issueSignInLink,
  [CommandKind.Unknown]: async ({ account }) =>
    buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.Unknown, locale: account.locale })] }),
};

export function applyOwnerCommand(input: ApplyOwnerCommandInput): Promise<AccountCommandResult> {
  const { command, account } = input;
  const isMenu = command.kind === CommandKind.Help;
  const localizedAccount = isMenu ? account : { ...account, locale: command.locale };
  return COMMAND_HANDLERS[command.kind]({ ...input, account: localizedAccount });
}
