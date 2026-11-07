import {
  ChannelError,
  formatChoiceOptionIds,
  formatRoutingListQuestionId,
  MEDIA_LINK_TTL_MS,
  renderCopy,
  type MediaSource,
  type MediaStore,
  type Message,
  type Question,
} from '@zapbip/core';
import {
  ChannelErrorKind,
  InboxCopyKey,
  LinkPurpose,
  MediaSourceKind,
  MessageKind,
  type OwnerLocale,
  type TemplateKind,
} from '@zapbip/types';
import { assertButtonLimits, assertListLimits, assertOutboundMedia, assertReactionTarget, assertTextBody } from './outbound-limits';
import { sanitiseTemplateParameter } from './template-sanitiser';
import { OUTBOUND_BUTTON_MAX_REPLIES } from './whatsapp-constants';
import { OwnerCopyKey, WHATSAPP_COPY } from './whatsapp-copy';
import { OWNER_LOCALE_TO_LANGUAGE_CODE, TEMPLATE_NAME_BY_KIND } from './whatsapp-templates';

export const MESSAGING_PRODUCT = 'whatsapp';
export const RECIPIENT_TYPE = 'individual';
const MEDIA_LINK_PATH_SEGMENT = 'm';
const URL_PATTERN = /https?:\/\//;
const REMOVED_REACTION_EMOJI = '';
const TEMPLATE_PARAMETER_COUNT = 2;
const ROUTING_LIST_QUESTION_PREFIX = formatRoutingListQuestionId({ messageId: '' });

type Payload = Record<string, unknown>;

type SessionContext = {
  question: Question | null;
  reactionTargetChannelMessageId: string | null;
  locale: OwnerLocale;
  resolveLink: (input: { source: MediaSource }) => Promise<string>;
};

type SessionBuilder = (input: { message: Message; context: SessionContext }) => Promise<Payload>;
type SessionBuilders = {
  [Kind in MessageKind]: (input: { message: Extract<Message, { kind: Kind }>; context: SessionContext }) => Promise<Payload>;
};

type MediaMessage = Extract<
  Message,
  { kind: MessageKind.Image | MessageKind.Video | MessageKind.Audio | MessageKind.Document | MessageKind.Sticker }
>;

function withoutNulls(input: { fields: Record<string, string | null> }): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input.fields).flatMap(([key, value]): [string, string][] => (value === null ? [] : [[key, value]])),
  );
}

async function mediaLink(input: { message: MediaMessage; context: SessionContext }): Promise<string> {
  const { message, context } = input;
  assertOutboundMedia({ mediaKind: message.kind, mimeType: message.mimeType, sizeBytes: message.sizeBytes });
  return context.resolveLink({ source: message.source });
}

async function buildMediaBody(input: {
  message: MediaMessage;
  context: SessionContext;
  caption: boolean;
  filename: boolean;
}): Promise<Payload> {
  const { message, caption, filename } = input;
  const link = await mediaLink(input);
  const optional = { caption: caption ? message.caption : null, filename: filename ? message.filename : null };
  return { link, ...withoutNulls({ fields: optional }) };
}

function choiceBodyText(input: { message: Extract<Message, { kind: MessageKind.Choice }>; context: SessionContext }): string {
  const { message, context } = input;
  if (context.question !== null) return context.question.text;
  if (message.questionId.startsWith(ROUTING_LIST_QUESTION_PREFIX))
    return renderCopy({ key: InboxCopyKey.RoutingPrompt, locale: context.locale, values: {} });
  throw new Error(`${message.questionId}: question not found`);
}

async function buildChoice(input: { message: Extract<Message, { kind: MessageKind.Choice }>; context: SessionContext }): Promise<Payload> {
  const { message, context } = input;
  const bodyText = choiceBodyText(input);
  const optionIds = formatChoiceOptionIds({ questionId: message.questionId, options: message.options });
  const choices = optionIds.map((id, index) => ({ id, option: message.options[index]! }));
  if (choices.length <= OUTBOUND_BUTTON_MAX_REPLIES) {
    const replies = choices.map(({ id, option }) => ({ id, title: option.title }));
    assertButtonLimits({ bodyText, replies });
    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: replies.map((reply) => ({ type: 'reply', reply })) },
      },
    };
  }
  const buttonLabel = WHATSAPP_COPY[context.locale][OwnerCopyKey.ListButtonLabel];
  const sectionTitle = WHATSAPP_COPY[context.locale][OwnerCopyKey.ListSectionTitle];
  const rows = choices.map(({ id, option }) => ({
    id,
    title: option.title,
    ...withoutNulls({ fields: { description: option.description } }),
  }));
  assertListLimits({ bodyText, buttonLabel, sectionTitle, rows: rows.map((row) => ({ description: null, ...row })) });
  return {
    type: 'interactive',
    interactive: { type: 'list', body: { text: bodyText }, action: { button: buttonLabel, sections: [{ title: sectionTitle, rows }] } },
  };
}

const SESSION_BUILDERS: SessionBuilders = {
  [MessageKind.Text]: async ({ message }) => {
    assertTextBody({ body: message.text });
    const isWrittenByZapbip = message.agent === null;
    const previewsLink = URL_PATTERN.test(message.text) && !isWrittenByZapbip;
    return { type: 'text', text: { preview_url: previewsLink, body: message.text } };
  },
  [MessageKind.Image]: async (input) => ({
    type: 'image',
    image: await buildMediaBody({ ...input, caption: true, filename: false }),
  }),
  [MessageKind.Video]: async (input) => ({
    type: 'video',
    video: await buildMediaBody({ ...input, caption: true, filename: false }),
  }),
  [MessageKind.Audio]: async (input) => ({
    type: 'audio',
    audio: await buildMediaBody({ ...input, caption: false, filename: false }),
  }),
  [MessageKind.Document]: async (input) => ({
    type: 'document',
    document: await buildMediaBody({ ...input, caption: true, filename: true }),
  }),
  [MessageKind.Sticker]: async (input) => ({
    type: 'sticker',
    sticker: await buildMediaBody({ ...input, caption: false, filename: false }),
  }),
  [MessageKind.Location]: async ({ message }) => ({
    type: 'location',
    location: {
      latitude: String(message.latitude),
      longitude: String(message.longitude),
      ...withoutNulls({ fields: { name: message.name, address: message.address } }),
    },
  }),
  [MessageKind.Contacts]: async ({ message }) => ({
    type: 'contacts',
    contacts: message.contacts.map((contact) => ({
      name: { formatted_name: contact.name },
      phones: contact.phones.map((phone) => ({ phone })),
      emails: contact.emails.map((email) => ({ email })),
      ...(contact.organization === null ? {} : { org: { company: contact.organization } }),
    })),
  }),
  [MessageKind.Reaction]: async ({ message, context }) => {
    assertReactionTarget({ messageId: context.reactionTargetChannelMessageId });
    return {
      type: 'reaction',
      reaction: {
        message_id: context.reactionTargetChannelMessageId,
        emoji: message.emoji === null ? REMOVED_REACTION_EMOJI : message.emoji,
      },
    };
  },
  [MessageKind.Choice]: buildChoice,
};

export async function buildSessionPayload(input: {
  recipientWaId: string;
  message: Message;
  question: Question | null;
  replyToChannelMessageId: string | null;
  reactionTargetChannelMessageId: string | null;
  locale: OwnerLocale;
  publicOrigin: string;
  mediaStore: MediaStore;
  accountId: string;
}): Promise<Payload> {
  const { accountId, publicOrigin, mediaStore } = input;
  const context: SessionContext = {
    question: input.question,
    reactionTargetChannelMessageId: input.reactionTargetChannelMessageId,
    locale: input.locale,
    async resolveLink({ source }) {
      if (source.kind === MediaSourceKind.Link) return source.link;
      if (source.kind === MediaSourceKind.Unavailable)
        throw new ChannelError({ kind: ChannelErrorKind.MediaRejected, message: 'media source is unavailable', errorCode: null });
      const query = await mediaStore.signedLink({
        accountId,
        mediaId: source.mediaId,
        purpose: LinkPurpose.Read,
        ttlMs: MEDIA_LINK_TTL_MS,
      });
      return `${publicOrigin}/${MEDIA_LINK_PATH_SEGMENT}/${accountId}/${source.mediaId}?${query}`;
    },
  };
  const build = SESSION_BUILDERS[input.message.kind] as SessionBuilder;
  const body = await build({ message: input.message, context });
  const replyContext = input.replyToChannelMessageId === null ? {} : { context: { message_id: input.replyToChannelMessageId } };
  return {
    messaging_product: MESSAGING_PRODUCT,
    recipient_type: RECIPIENT_TYPE,
    to: input.recipientWaId,
    ...replyContext,
    ...body,
  };
}

export function buildTemplatePayload(input: {
  recipientWaId: string;
  kind: TemplateKind;
  locale: OwnerLocale;
  parameters: string[];
}): Payload {
  const { parameters, locale } = input;
  if (parameters.length !== TEMPLATE_PARAMETER_COUNT)
    throw new Error(`template parameters: expected ${TEMPLATE_PARAMETER_COUNT}, got ${parameters.length}`);
  const fallback = WHATSAPP_COPY[locale][OwnerCopyKey.TemplatePreviewFallback];
  return {
    messaging_product: MESSAGING_PRODUCT,
    recipient_type: RECIPIENT_TYPE,
    to: input.recipientWaId,
    type: 'template',
    template: {
      name: TEMPLATE_NAME_BY_KIND[input.kind],
      language: { code: OWNER_LOCALE_TO_LANGUAGE_CODE[locale] },
      components: [
        { type: 'body', parameters: parameters.map((value) => ({ type: 'text', text: sanitiseTemplateParameter({ value, fallback }) })) },
      ],
    },
  };
}
