import { AccountReplyIntent, DeliveryState, IdPrefix, MessageKind, ReplyKind } from '@zapbip/types';
import { deliverToOwner } from '../../inbox/use-cases/deliver-to-owner';
import type { MessageContent } from '../../inbox/message';
import { renderAccountReply } from '../account-copy';
import type { AccountCommandResult, AccountReply } from '../account-types';
import { ACCOUNT_MENU_QUESTION_ID } from '../constants';
import { buildTextReply } from './account-reply';
import type { AccountRepliesInput } from './types';

function toContents(input: { reply: AccountReply }): MessageContent[] {
  const { reply } = input;
  const text = renderAccountReply({ reply });
  const textContents: MessageContent[] = [{ kind: MessageKind.Text, text }];
  if (reply.kind !== ReplyKind.List) return textContents;
  const options = reply.menuRows.map((row, optionIndex) => ({ optionIndex, title: row.title, description: null, rowId: row.id }));
  return [...textContents, { kind: MessageKind.Choice, questionId: ACCOUNT_MENU_QUESTION_ID, options, selected: null }];
}

async function sendContents(input: AccountRepliesInput & { contents: MessageContent[]; messageIds: string[] }): Promise<void> {
  const { dependencies, account, contents, messageIds } = input;
  await contents.reduce(
    (previous, content, index) =>
      previous.then(async () => {
        await deliverToOwner({
          dependencies,
          ownerLocale: account.locale,
          agent: null,
          messageId: messageIds[index]!,
          content,
          replyToMessageId: null,
        });
      }),
    Promise.resolve(),
  );
}

function newMessageIds(input: AccountRepliesInput & { contents: MessageContent[] }): string[] {
  return input.contents.map(() => input.dependencies.ids.next({ prefix: IdPrefix.Message }));
}

async function redactSentMessages(input: AccountRepliesInput & { messageIds: string[] }): Promise<void> {
  const { dependencies, messageIds } = input;
  const messages = await Promise.all(messageIds.map((messageId) => dependencies.repository.findMessage({ messageId })));
  const sentMessageIds = messages.flatMap((message) =>
    message !== null && message.delivery === DeliveryState.Sent ? [message.messageId] : [],
  );
  await dependencies.installLinkRedaction.redact({ messageIds: sentMessageIds });
}

async function compensate(input: AccountRepliesInput & { result: AccountCommandResult }): Promise<void> {
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

async function tellSendFailed(input: AccountRepliesInput): Promise<void> {
  const reply = buildTextReply({ intent: AccountReplyIntent.SendFailed, locale: input.account.locale });
  try {
    const contents = toContents({ reply });
    await sendContents({ ...input, contents, messageIds: newMessageIds({ ...input, contents }) });
  } catch {
    return;
  }
}

async function settleRotation(input: AccountRepliesInput & { result: AccountCommandResult }): Promise<void> {
  const { dependencies, account, result } = input;
  const { compensation } = result;
  const isRotation = compensation !== null && compensation.oldDigest !== null;
  if (!isRotation) return;
  const { accountId } = account;
  await dependencies.revocations.cancelWaiters({ accountId, agent: compensation.agent });
  await dependencies.revocations.recordRotation({ accountId, agent: compensation.agent, secretDigest: compensation.newDigest });
}

export async function sendAccountReplies(input: AccountRepliesInput & { result: AccountCommandResult }): Promise<boolean> {
  const contents = input.result.replies.flatMap((reply) => toContents({ reply }));
  const messageIds = newMessageIds({ ...input, contents });
  try {
    await sendContents({ ...input, contents, messageIds });
  } catch {
    await compensate(input);
    await tellSendFailed(input);
    return false;
  } finally {
    await redactSentMessages({ ...input, messageIds });
  }
  await settleRotation(input);
  return true;
}
