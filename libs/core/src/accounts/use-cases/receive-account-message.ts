import { AccountReplyIntent, AccountStateOutcome, ChannelInboundKind, IdPrefix, MessageKind, ReplyKind } from '@zapbip/types';
import { openWindow } from '../../inbox/use-cases/open-window';
import { deliverToOwner } from '../../inbox/use-cases/deliver-to-owner';
import { receiveChannelMessage } from '../../inbox/use-cases/receive-channel-message';
import type { ChannelInboundEntry, ReceiveResult } from '../../inbox/use-cases/types';
import type { MessageContent } from '../../inbox/message';
import { renderAccountReply } from '../account-copy';
import type { AccountCommand, AccountCommandResult, AccountReply, CommandInput } from '../account-types';
import { parseAccountCommand } from '../command';
import { ACCOUNT_MENU_QUESTION_ID } from '../constants';
import { evaluateAccountState } from '../state-gate';
import { applyOwnerCommand } from './apply-owner-command';
import { buildResult, buildTextReply } from './account-reply';
import type { ReceiveAccountMessageInput, ReceiveAccountMessageResult } from './types';

type AnswerInput = ReceiveAccountMessageInput & { prepare: () => Promise<AccountCommandResult> };

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
  const commandInput = toCommandInput(input);
  const command = parseAccountCommand(commandInput);
  if (command === null || commandInput.listReplyId === null) return command;
  return { ...command, locale: input.account.locale };
}

function toContents(input: { reply: AccountReply }): MessageContent[] {
  const { reply } = input;
  const text = renderAccountReply({ reply });
  const textContents: MessageContent[] = [{ kind: MessageKind.Text, text }];
  if (reply.kind !== ReplyKind.List) return textContents;
  const options = reply.menuRows.map((row, optionIndex) => ({ optionIndex, title: row.title, description: null }));
  return [...textContents, { kind: MessageKind.Choice, questionId: ACCOUNT_MENU_QUESTION_ID, options, selected: null }];
}

async function sendContents(input: ReceiveAccountMessageInput & { contents: MessageContent[] }): Promise<void> {
  const { dependencies, account, contents } = input;
  await contents.reduce(
    (previous, content) =>
      previous.then(async () => {
        await deliverToOwner({
          dependencies,
          ownerLocale: account.locale,
          agent: null,
          messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
          content,
          replyToMessageId: null,
        });
      }),
    Promise.resolve(),
  );
}

async function compensate(input: ReceiveAccountMessageInput & { result: AccountCommandResult }): Promise<void> {
  const { dependencies, account, result } = input;
  const { compensation } = result;
  if (compensation === null) return;
  const { agent, oldDigest, newDigest, oldInstallCode } = compensation;
  const { accountId } = account;
  if (oldDigest === null) {
    await dependencies.connections.revoke({ accountId, agent, revokedAt: dependencies.clock.now() });
    return;
  }
  await dependencies.connections.rotate({
    accountId,
    agent,
    fromDigest: newDigest,
    toDigest: oldDigest,
    installCode: oldInstallCode,
    rotatedAt: dependencies.clock.now(),
  });
}

async function tellSendFailed(input: ReceiveAccountMessageInput): Promise<void> {
  const reply = buildTextReply({ intent: AccountReplyIntent.SendFailed, locale: input.account.locale });
  try {
    await sendContents({ ...input, contents: toContents({ reply }) });
  } catch {
    return;
  }
}

async function settleRotation(input: ReceiveAccountMessageInput & { result: AccountCommandResult }): Promise<void> {
  const { dependencies, account, result } = input;
  const { compensation } = result;
  const isRotation = compensation !== null && compensation.oldDigest !== null;
  if (!isRotation) return;
  await dependencies.revocations.cancelWaiters({ accountId: account.accountId, agent: compensation.agent });
}

async function sendReplies(input: ReceiveAccountMessageInput & { result: AccountCommandResult }): Promise<void> {
  const contents = input.result.replies.flatMap((reply) => toContents({ reply }));
  try {
    await sendContents({ ...input, contents });
  } catch {
    await compensate(input);
    await tellSendFailed(input);
    return;
  }
  await settleRotation(input);
}

async function answerLocally(input: AnswerInput): Promise<ReceiveAccountMessageResult> {
  const { dependencies, channelMessageId, entry, prepare, account } = input;
  const { repository, clock } = dependencies;
  const isNewMessage = await repository.recordChannelReceipt({ wamid: channelMessageId, receivedAt: clock.now() });
  if (!isNewMessage) return DUPLICATE_RESULT;
  await openWindow({ dependencies, ownerLocale: account.locale, at: entry.at });
  const result = await prepare();
  await sendReplies({ ...input, result });
  return {
    messageId: null,
    agent: null,
    duplicate: false,
    deletionConfirmed: result.deletionConfirmed,
    commandKind: null,
    connectionId: null,
  };
}

async function handleReply(
  input: ReceiveAccountMessageInput & { intent: AccountReplyIntent | null },
): Promise<ReceiveAccountMessageResult> {
  const { intent, account } = input;
  if (intent === null) throw new Error('the state gate replied without an intent');
  const reply = buildTextReply({ intent, locale: account.locale });
  return answerLocally({ ...input, prepare: async () => buildResult({ replies: [reply] }) });
}

async function handleProceed(input: ReceiveAccountMessageInput & { command: AccountCommand | null }): Promise<ReceiveAccountMessageResult> {
  const { dependencies, account, channelMessageId, entry, publicOrigin, command } = input;
  if (command !== null) {
    return answerLocally({ ...input, prepare: () => applyOwnerCommand({ dependencies, account, publicOrigin, command }) });
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
  if (verdict.outcome === AccountStateOutcome.Reply) return handleReply({ ...input, intent: verdict.intent });
  return handleProceed({ ...input, command });
}
