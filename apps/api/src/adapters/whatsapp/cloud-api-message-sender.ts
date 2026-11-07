import { ChannelError, type Clock, type MediaStore, type Message, type MessageSender } from '@zapbip/core';
import { ChannelErrorKind, MessageKind, type InboxErrorCode } from '@zapbip/types';
import { z } from 'zod';
import type { ChannelRestrictions } from '../d1/d1-channel-restrictions';
import type { D1MessageIndex } from '../d1/d1-message-index';
import type { OwnerRecipient } from '../d1/d1-owner-directory';
import type { OutboundNumber } from '../../numbers/number-registry';
import { mapGraphErrorToChannelError } from './channel-error-mapping';
import { GraphRequestError, type GraphClient } from './graph-client';
import { logOperatorEvent } from './operator-log';
import { buildSessionPayload, buildTemplatePayload } from './outbound-builders';
import { REACTION_TARGET_FIELD } from './outbound-limits';
import { OperatorEvent, OperatorLogField, WhatsAppErrorCode, type WhatsAppLanguageCode, type WhatsAppTemplateName } from './whatsapp-enums';
import { OWNER_LOCALE_TO_LANGUAGE_CODE, TEMPLATE_NAME_BY_KIND } from './whatsapp-templates';

type SentMessage = { channelMessageId: string };
type TemplateUsed = { name: WhatsAppTemplateName; language: WhatsAppLanguageCode };

const RESTRICTING_ERROR_CODES: readonly number[] = [WhatsAppErrorCode.NumberRestricted, WhatsAppErrorCode.AccountDisabled];

const OPERATOR_EVENT_BY_CODE: Partial<Record<InboxErrorCode | ChannelErrorKind, OperatorEvent>> = {
  [ChannelErrorKind.Restricted]: OperatorEvent.ChannelRestricted,
  [ChannelErrorKind.TemplateRejected]: OperatorEvent.ChannelTemplateRejected,
  [ChannelErrorKind.Auth]: OperatorEvent.ChannelAuth,
  [ChannelErrorKind.Timeout]: OperatorEvent.ChannelTimeout,
};

const sendResponseSchema = z.object({ messages: z.array(z.object({ id: z.string() })) });

function describeMessage(input: { message: Message }): string {
  const { message } = input;
  if (message.kind === MessageKind.Reaction) return REACTION_TARGET_FIELD;
  if ('mimeType' in message && message.mimeType !== null) return `${message.kind} ${message.mimeType}`;
  return message.kind;
}

type Channel = { number: OutboundNumber; graph: GraphClient; restrictions: ChannelRestrictions };

export function createCloudApiMessageSender(input: {
  accountId: string;
  resolveNumber: () => Promise<OutboundNumber>;
  channelOf: (input: { number: OutboundNumber }) => { graph: GraphClient; restrictions: ChannelRestrictions };
  findOwnerByAccountId: (input: { accountId: string }) => Promise<OwnerRecipient | null>;
  messageIndex: Pick<D1MessageIndex, 'record'>;
  mediaStore: MediaStore;
  publicOrigin: string;
  clock: Clock;
}): MessageSender {
  const { accountId, clock } = input;

  async function openChannel(): Promise<Channel> {
    const number = await input.resolveNumber();
    return { number, ...input.channelOf({ number }) };
  }

  async function assertNotRestricted(input: { restrictions: ChannelRestrictions }): Promise<void> {
    const restriction = await input.restrictions.findActive({ now: clock.now() });
    if (restriction === null) return;
    throw new ChannelError({
      kind: ChannelErrorKind.Restricted,
      message: 'sending is paused because Meta restricted the WhatsApp number',
      errorCode: restriction.errorCode,
    });
  }

  async function requireOwner(): Promise<OwnerRecipient> {
    const owner = await input.findOwnerByAccountId({ accountId });
    if (owner !== null) return owner;
    throw new ChannelError({
      kind: ChannelErrorKind.DeliveryFailed,
      message: 'delivery failed (no owner phone is linked to this account)',
      errorCode: null,
    });
  }

  function report(failure: { channelError: ChannelError; template: TemplateUsed | null }): void {
    const { channelError, template } = failure;
    const event = OPERATOR_EVENT_BY_CODE[channelError.code];
    if (event === undefined) return;
    const errorCodeFields = channelError.errorCode === null ? {} : { [OperatorLogField.ErrorCode]: channelError.errorCode };
    const isTemplateRejection = channelError.code === ChannelErrorKind.TemplateRejected && template !== null;
    const templateFields = isTemplateRejection
      ? { [OperatorLogField.TemplateName]: template.name, [OperatorLogField.LanguageCode]: template.language }
      : {};
    logOperatorEvent({ event, fields: { ...errorCodeFields, ...templateFields } });
  }

  async function translate(failure: {
    channel: Channel;
    error: unknown;
    subject: string;
    template: TemplateUsed | null;
    isReactionSend: boolean;
  }): Promise<unknown> {
    const { channel, error, subject, template, isReactionSend } = failure;
    if (!(error instanceof GraphRequestError)) return error;
    const channelError = mapGraphErrorToChannelError({
      status: error.status,
      errorCode: error.errorCode,
      errorTitle: error.errorTitle,
      message: subject,
      isTemplateSend: template !== null,
      isReactionSend,
    });
    const { errorCode } = channelError;
    const isRestriction = errorCode !== null && RESTRICTING_ERROR_CODES.includes(errorCode);
    if (isRestriction) await channel.restrictions.record({ errorCode, restrictedAt: clock.now() });
    report({ channelError, template });
    return channelError;
  }

  async function send(request: {
    channel: Channel;
    payload: Record<string, unknown>;
    subject: string;
    template: TemplateUsed | null;
    isReactionSend: boolean;
  }): Promise<SentMessage> {
    const { channel } = request;
    const response = await channel.graph
      .post({ path: `/${channel.number.phoneNumberId}/messages`, body: request.payload })
      .catch(async (error: unknown) => {
        throw await translate({
          channel,
          error,
          subject: request.subject,
          template: request.template,
          isReactionSend: request.isReactionSend,
        });
      });
    const parsed = sendResponseSchema.safeParse(response);
    const [sent] = parsed.success ? parsed.data.messages : [];
    if (sent === undefined) throw new Error('Graph response has no message id');
    await input.messageIndex.record({ id: sent.id, accountId, at: clock.now() });
    return { channelMessageId: sent.id };
  }

  return {
    async session({ message, question, replyToChannelMessageId, reactionTargetChannelMessageId }) {
      const channel = await openChannel();
      await assertNotRestricted({ restrictions: channel.restrictions });
      const owner = await requireOwner();
      const payload = await buildSessionPayload({
        recipientWaId: owner.waId,
        message,
        question,
        replyToChannelMessageId,
        reactionTargetChannelMessageId,
        locale: owner.ownerLocale,
        publicOrigin: input.publicOrigin,
        mediaStore: input.mediaStore,
        accountId,
      });
      return send({
        channel,
        payload,
        subject: describeMessage({ message }),
        template: null,
        isReactionSend: message.kind === MessageKind.Reaction,
      });
    },

    async template({ kind, locale, parameters }) {
      const channel = await openChannel();
      await assertNotRestricted({ restrictions: channel.restrictions });
      const owner = await requireOwner();
      const payload = buildTemplatePayload({ recipientWaId: owner.waId, kind, locale, parameters });
      const template = { name: TEMPLATE_NAME_BY_KIND[kind], language: OWNER_LOCALE_TO_LANGUAGE_CODE[locale] };
      return send({ channel, payload, subject: kind, template, isReactionSend: false });
    },
  };
}
