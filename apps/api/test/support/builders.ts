import { DeliveryState, MediaSourceKind, MessageDirection, MessageKind } from '@zapbip/types';
import type { Message, MessageContent, MessageEnvelope, Question } from '@zapbip/core';

export const BASE_TIME = 1_800_000_000_000;

export function buildEnvelope(input: Partial<MessageEnvelope> & { messageId: string }): MessageEnvelope {
  return {
    direction: MessageDirection.ToOwner,
    agent: 'alpha',
    at: BASE_TIME,
    replyToMessageId: null,
    delivery: DeliveryState.Sent,
    readByAgent: false,
    handedTo: null,
    originMessageId: null,
    ...input,
  };
}

export function buildTextMessage(input: Partial<MessageEnvelope> & { messageId: string; text?: string }): Message {
  const { text = 'oi', ...envelope } = input;
  return { ...buildEnvelope(envelope), kind: MessageKind.Text, text };
}

const MEDIA_FIELDS = {
  source: { kind: MediaSourceKind.Stored as const, mediaId: 'med_1' },
  mimeType: 'application/pdf',
  sizeBytes: 1000,
  filename: 'a.pdf',
  caption: 'legenda',
};

export function buildEveryKind(): Message[] {
  const contents: MessageContent[] = [
    { kind: MessageKind.Text, text: 'oi' },
    { kind: MessageKind.Image, ...MEDIA_FIELDS },
    { kind: MessageKind.Video, ...MEDIA_FIELDS },
    { kind: MessageKind.Audio, voice: true, ...MEDIA_FIELDS },
    { kind: MessageKind.Document, ...MEDIA_FIELDS },
    { kind: MessageKind.Sticker, ...MEDIA_FIELDS },
    { kind: MessageKind.Location, latitude: -23.5, longitude: -46.6, name: 'Casa', address: null },
    {
      kind: MessageKind.Contacts,
      contacts: [{ name: 'Maria', phones: ['+5511999990000'], emails: [], organization: null }],
    },
    { kind: MessageKind.Reaction, targetMessageId: 'msg_1', emoji: null },
    {
      kind: MessageKind.Choice,
      questionId: 'qst_1',
      options: [{ optionIndex: 0, title: 'Sim', description: null }],
      selected: null,
    },
  ];
  return contents.map((content, index) => ({ ...buildEnvelope({ messageId: `msg_kind_${index}`, at: BASE_TIME + index }), ...content }));
}

export function buildQuestion(input: Partial<Question> & { questionId: string }): Question {
  return {
    agent: 'alpha',
    text: 'Deploy?',
    options: [{ optionIndex: 0, title: 'Sim', description: null }],
    normalizedKey: 'k',
    promptMessageId: 'msg_prompt',
    askedAt: BASE_TIME,
    answer: null,
    ...input,
  };
}
