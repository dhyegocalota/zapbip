import { AccountReplyIntent, AccountState, AccountStateOutcome, ChannelInboundKind, CommandKind, MessageKind } from '@zapbip/types';
import { openWindow } from '../../inbox/use-cases/open-window';
import { receiveChannelMessage } from '../../inbox/use-cases/receive-channel-message';
import type { ChannelInboundEntry, ReceiveResult } from '../../inbox/use-cases/types';
import type { AccountCommand, AccountCommandResult, CommandInput } from '../account-types';
import { parseAccountCommand } from '../command';
import { ONBOARDING_COOLDOWN_KEY, ONBOARDING_REPLY_COOLDOWN_MS } from '../constants';
import { evaluateAccountState } from '../state-gate';
import { applyOwnerCommand } from './apply-owner-command';
import { isDeletionRequestLive } from './confirm-account-deletion';
import { buildResult, buildTextReply } from './account-reply';
import { sendAccountReplies } from './send-account-replies';
import type { ReceiveAccountMessageInput, ReceiveAccountMessageResult } from './types';

type AnswerInput = ReceiveAccountMessageInput & { prepare: () => Promise<AccountCommandResult>; commandKind: CommandKind | null };

const NOT_CONFIRMED = false;

const DUPLICATE_RESULT: ReceiveAccountMessageResult = {
  messageId: null,
  agent: null,
  duplicate: true,
  deletionConfirmed: false,
  commandKind: null,
  connectionId: null,
};
const DROPPED_RESULT: ReceiveAccountMessageResult = {
  messageId: null,
  agent: null,
  duplicate: false,
  deletionConfirmed: false,
  commandKind: null,
  connectionId: null,
};

function toCommandInput(input: { entry: ChannelInboundEntry }): CommandInput {
  const { entry } = input;
  if (entry.kind !== ChannelInboundKind.Owner) return { text: null, listReplyId: null, isQuoting: false };
  const { content, replyToChannelMessageId } = entry;
  return {
    text: content.kind === MessageKind.Text ? content.text : null,
    listReplyId: content.kind === MessageKind.Choice ? content.optionId : null,
    isQuoting: replyToChannelMessageId !== null,
  };
}

function parseCommand(input: ReceiveAccountMessageInput): AccountCommand | null {
  const { entry } = input;
  const isForwarded = entry.kind === ChannelInboundKind.Owner && entry.forwarded;
  if (isForwarded) return null;
  const commandInput = toCommandInput(input);
  const command = parseAccountCommand(commandInput);
  if (command === null || commandInput.listReplyId === null) return command;
  return { ...command, locale: input.account.locale };
}

async function answerLocally(input: AnswerInput): Promise<ReceiveAccountMessageResult> {
  const { dependencies, channelMessageId, entry, prepare, account } = input;
  const { repository, clock } = dependencies;
  const isNewMessage = await repository.recordChannelReceipt({ wamid: channelMessageId, receivedAt: clock.now() });
  if (!isNewMessage) return DUPLICATE_RESULT;
  await openWindow({ dependencies, ownerLocale: account.locale, at: entry.at });
  const result = await prepare();
  await sendAccountReplies({ ...input, result });
  return {
    messageId: null,
    agent: null,
    duplicate: false,
    deletionConfirmed: result.deletionConfirmed,
    commandKind: input.commandKind,
    connectionId: result.connectionId,
  };
}

async function handleReply(
  input: ReceiveAccountMessageInput & { intent: AccountReplyIntent | null },
): Promise<ReceiveAccountMessageResult> {
  const { intent, account } = input;
  if (intent === null) throw new Error('the state gate replied without an intent');
  const reply = buildTextReply({ intent, locale: account.locale });
  return answerLocally({ ...input, commandKind: null, prepare: async () => buildResult({ replies: [reply] }) });
}

async function handleOnboardingReply(input: ReceiveAccountMessageInput): Promise<ReceiveAccountMessageResult> {
  const { dependencies } = input;
  const { approvalCooldowns, clock } = dependencies;
  const isCoolingDown = await approvalCooldowns.isCoolingDown({ key: ONBOARDING_COOLDOWN_KEY, now: clock.now() });
  if (isCoolingDown) return DROPPED_RESULT;
  const result = await handleReply({ ...input, intent: AccountReplyIntent.Waitlisted });
  if (!result.duplicate) await approvalCooldowns.start({ key: ONBOARDING_COOLDOWN_KEY, until: clock.now() + ONBOARDING_REPLY_COOLDOWN_MS });
  return result;
}

async function readRequestLiveness(input: ReceiveAccountMessageInput & { command: AccountCommand }): Promise<boolean> {
  const { dependencies, command } = input;
  if (command.kind !== CommandKind.ConfirmDeletion) return false;
  return isDeletionRequestLive({ dependencies });
}

async function beginConfirmedDeletion(input: ReceiveAccountMessageInput & { isRequestLive: boolean }): Promise<void> {
  const { dependencies, account, isRequestLive } = input;
  if (!isRequestLive) return;
  await dependencies.accounts.setState({ accountId: account.accountId, state: AccountState.Deleting });
}

async function handleProceed(input: ReceiveAccountMessageInput & { command: AccountCommand | null }): Promise<ReceiveAccountMessageResult> {
  const { dependencies, account, channelMessageId, entry, publicOrigin, appOrigin, command } = input;
  if (command !== null) {
    const isRequestLive = await readRequestLiveness({ ...input, command });
    await beginConfirmedDeletion({ ...input, isRequestLive });
    return answerLocally({
      ...input,
      commandKind: command.kind,
      prepare: () => applyOwnerCommand({ dependencies, account, publicOrigin, appOrigin, command, isRequestLive }),
    });
  }
  const result: ReceiveResult = await receiveChannelMessage({ dependencies, ownerLocale: account.locale, channelMessageId, entry });
  return { ...result, deletionConfirmed: NOT_CONFIRMED, commandKind: null, connectionId: null };
}

export async function receiveAccountMessage(input: ReceiveAccountMessageInput): Promise<ReceiveAccountMessageResult> {
  const { dependencies, account, channelMessageId, entry } = input;
  const isFirstMessage = await dependencies.firstMessage.claim({ channelMessageId });
  const command = parseCommand(input);
  const verdict = evaluateAccountState({
    state: account.state,
    command,
    isFirstMessage,
    isText: entry.kind === ChannelInboundKind.Owner && entry.content.kind === MessageKind.Text,
  });
  if (verdict.outcome === AccountStateOutcome.Drop) return DROPPED_RESULT;
  const isOnboardingReply = verdict.outcome === AccountStateOutcome.Reply && verdict.intent === AccountReplyIntent.Waitlisted;
  if (isOnboardingReply) return handleOnboardingReply(input);
  if (verdict.outcome === AccountStateOutcome.Reply) return handleReply({ ...input, intent: verdict.intent });
  return handleProceed({ ...input, command });
}
