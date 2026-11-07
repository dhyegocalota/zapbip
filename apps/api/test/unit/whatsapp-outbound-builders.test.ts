import type { MediaStore, Message, MessageContent, MessageEnvelope } from '@zapbip/core';
import { ChannelError } from '@zapbip/core';
import { ChannelErrorKind, MediaSourceKind, MessageKind, OwnerLocale, TemplateKind } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { buildSessionPayload, buildTemplatePayload } from '../../src/adapters/whatsapp/outbound-builders';
import buttonsFixture from '../fixtures/whatsapp/outbound/buttons.json';
import listFixture from '../fixtures/whatsapp/outbound/list.json';
import templateEnglishFixture from '../fixtures/whatsapp/outbound/template-notice-en_US.json';
import templatePortugueseFixture from '../fixtures/whatsapp/outbound/template-notice-pt_BR.json';
import textFixture from '../fixtures/whatsapp/outbound/text.json';
import { buildEnvelope, buildQuestion } from '../support/builders';

const RECIPIENT = '5511900000001';
const ACCOUNT_ID = 'acc_a';
const PUBLIC_ORIGIN = 'https://api.test';
const SIGNED_QUERY = 'exp=1800000000000&sig=abc';
const LINK = 'https://files.example/a.bin';

const mediaStore: MediaStore = {
  put: () => Promise.reject(new Error('unexpected put')),
  get: () => Promise.reject(new Error('unexpected get')),
  signedLink: () => Promise.resolve(SIGNED_QUERY),
  delete: () => Promise.reject(new Error('unexpected delete')),
};

function message(input: { content: MessageContent; envelope?: Partial<MessageEnvelope> }): Message {
  return { ...buildEnvelope({ messageId: 'msg_1', ...input.envelope }), ...input.content };
}

function session(input: {
  content: MessageContent;
  envelope?: Partial<MessageEnvelope>;
  question?: ReturnType<typeof buildQuestion> | null;
  replyTo?: string | null;
  reactionTarget?: string | null;
  locale?: OwnerLocale;
}): Promise<Record<string, unknown>> {
  return buildSessionPayload({
    recipientWaId: RECIPIENT,
    message: message({ content: input.content, envelope: input.envelope }),
    question: input.question === undefined ? null : input.question,
    replyToChannelMessageId: input.replyTo === undefined ? null : input.replyTo,
    reactionTargetChannelMessageId: input.reactionTarget === undefined ? null : input.reactionTarget,
    locale: input.locale === undefined ? OwnerLocale.PortugueseBrazil : input.locale,
    publicOrigin: PUBLIC_ORIGIN,
    mediaStore,
    accountId: ACCOUNT_ID,
  });
}

const BASE = { messaging_product: 'whatsapp', recipient_type: 'individual', to: RECIPIENT };
const LINK_SOURCE = { kind: MediaSourceKind.Link, link: LINK } as const;
const MEDIA_FIELDS = { source: LINK_SOURCE, mimeType: null, sizeBytes: null, filename: null, caption: null };

function options(titles: string[]): { optionIndex: number; title: string; description: string | null }[] {
  return titles.map((title, optionIndex) => ({ optionIndex, title, description: null }));
}

function choice(input: { questionId: string; titles: string[] }): MessageContent {
  return { kind: MessageKind.Choice, questionId: input.questionId, options: options(input.titles), selected: null };
}

describe('buildSessionPayload', () => {
  it('AU-73 builds a text message', async () => {
    expect(await session({ content: { kind: MessageKind.Text, text: 'Olá' } })).toEqual(textFixture);
  });

  it('AU-74 previews a link in a text', async () => {
    const payload = await session({ content: { kind: MessageKind.Text, text: 'veja https://zapbip.example/x' } });
    expect(payload).toMatchObject({ text: { preview_url: true, body: 'veja https://zapbip.example/x' } });
  });

  it('never previews a link in a text written by zapbip itself', async () => {
    const text = 'cole no seu agente: https://api.test/i/zb_inst_x';
    const payload = await session({ envelope: { agent: null }, content: { kind: MessageKind.Text, text } });
    expect(payload).toMatchObject({ text: { preview_url: false, body: text } });
  });

  it('AU-75 replies in context', async () => {
    const payload = await session({ content: { kind: MessageKind.Text, text: 'Olá' }, replyTo: 'wamid.R' });
    expect(payload).toEqual({ ...textFixture, context: { message_id: 'wamid.R' } });
  });

  it('AU-76 builds reply buttons with ids question:index', async () => {
    const payload = await session({
      content: choice({ questionId: 'qst_1', titles: ['Sim', 'Não', 'Depois'] }),
      question: buildQuestion({ questionId: 'qst_1', text: 'Fazer o deploy?' }),
    });
    expect(payload).toEqual(buttonsFixture);
  });

  it('AU-77 builds a list with the locale copy', async () => {
    const payload = await session({
      content: {
        kind: MessageKind.Choice,
        questionId: 'qst_1',
        selected: null,
        options: [
          { optionIndex: 0, title: 'Produção', description: null },
          { optionIndex: 1, title: 'Staging', description: 'Ambiente de testes' },
          { optionIndex: 2, title: 'Local', description: null },
          { optionIndex: 3, title: 'Sandbox', description: null },
        ],
      },
      question: buildQuestion({ questionId: 'qst_1', text: 'Qual ambiente?' }),
    });
    expect(payload).toEqual(listFixture);
  });

  it('AU-77 uses the English list copy for an English owner', async () => {
    const payload = await session({
      content: choice({ questionId: 'qst_1', titles: ['A', 'B', 'C', 'D'] }),
      question: buildQuestion({ questionId: 'qst_1', text: 'Which?' }),
      locale: OwnerLocale.EnglishUs,
    });
    expect(payload).toMatchObject({ interactive: { action: { button: 'See options', sections: [{ title: 'Options' }] } } });
  });

  it('builds the routing list without a stored question', async () => {
    const payload = await session({ content: choice({ questionId: 'route:msg_9', titles: ['alpha', 'beta'] }) });
    expect(payload).toMatchObject({
      interactive: {
        type: 'button',
        body: { text: 'Para qual agente devo encaminhar sua mensagem?' },
        action: {
          buttons: [
            { type: 'reply', reply: { id: 'route:msg_9:alpha', title: 'alpha' } },
            { type: 'reply', reply: { id: 'route:msg_9:beta', title: 'beta' } },
          ],
        },
      },
    });
  });

  it('refuses a choice whose question is missing', async () => {
    await expect(session({ content: choice({ questionId: 'qst_1', titles: ['Sim'] }) })).rejects.toThrow('qst_1');
  });

  it('AU-78 builds an image with a link and a caption', async () => {
    const payload = await session({ content: { kind: MessageKind.Image, ...MEDIA_FIELDS, caption: 'Foto' } });
    expect(payload).toEqual({ ...BASE, type: 'image', image: { link: LINK, caption: 'Foto' } });
  });

  it('AU-78 omits an absent caption', async () => {
    const payload = await session({ content: { kind: MessageKind.Image, ...MEDIA_FIELDS } });
    expect(payload).toEqual({ ...BASE, type: 'image', image: { link: LINK } });
  });

  it('AU-79 builds video, audio and document', async () => {
    expect(await session({ content: { kind: MessageKind.Video, ...MEDIA_FIELDS, caption: 'Clipe' } })).toEqual({
      ...BASE,
      type: 'video',
      video: { link: LINK, caption: 'Clipe' },
    });
    expect(await session({ content: { kind: MessageKind.Audio, voice: false, ...MEDIA_FIELDS } })).toEqual({
      ...BASE,
      type: 'audio',
      audio: { link: LINK },
    });
    expect(
      await session({ content: { kind: MessageKind.Document, ...MEDIA_FIELDS, filename: 'relatorio.pdf', caption: 'Segue' } }),
    ).toEqual({
      ...BASE,
      type: 'document',
      document: { link: LINK, filename: 'relatorio.pdf', caption: 'Segue' },
    });
  });

  it('AU-80 builds a static sticker', async () => {
    const payload = await session({
      content: { kind: MessageKind.Sticker, ...MEDIA_FIELDS, mimeType: 'image/webp', sizeBytes: 99_000 },
    });
    expect(payload).toEqual({ ...BASE, type: 'sticker', sticker: { link: LINK } });
  });

  it('WI-71 links stored media through PUBLIC_ORIGIN and the signed query', async () => {
    const payload = await session({
      content: { kind: MessageKind.Image, ...MEDIA_FIELDS, source: { kind: MediaSourceKind.Stored, mediaId: 'med_1' } },
    });
    expect(payload).toMatchObject({ image: { link: `${PUBLIC_ORIGIN}/m/${ACCOUNT_ID}/med_1?${SIGNED_QUERY}` } });
  });

  it('refuses unavailable media', async () => {
    const content: MessageContent = { kind: MessageKind.Image, ...MEDIA_FIELDS, source: { kind: MediaSourceKind.Unavailable } };
    await expect(session({ content })).rejects.toThrow('unavailable');
  });

  it('AU-100 refuses media whose type is not allowed', async () => {
    const content: MessageContent = { kind: MessageKind.Image, ...MEDIA_FIELDS, mimeType: 'image/gif', sizeBytes: 100 };
    await expect(session({ content })).rejects.toMatchObject({ code: ChannelErrorKind.MediaRejected });
  });

  it('AU-81 sends coordinates as strings', async () => {
    const payload = await session({ content: { kind: MessageKind.Location, latitude: 1.5, longitude: -2.25, name: null, address: null } });
    expect(payload).toEqual({ ...BASE, type: 'location', location: { latitude: '1.5', longitude: '-2.25' } });
  });

  it('AU-81 carries the place name and address', async () => {
    const payload = await session({
      content: { kind: MessageKind.Location, latitude: 1.5, longitude: -2.25, name: 'Casa', address: 'Rua A, 1' },
    });
    expect(payload).toMatchObject({ location: { latitude: '1.5', longitude: '-2.25', name: 'Casa', address: 'Rua A, 1' } });
  });

  it('AU-82 builds a contact card', async () => {
    const payload = await session({
      content: {
        kind: MessageKind.Contacts,
        contacts: [{ name: 'Maria', phones: ['+5511999990000'], emails: ['maria@example.com'], organization: 'Acme' }],
      },
    });
    expect(payload).toEqual({
      ...BASE,
      type: 'contacts',
      contacts: [
        {
          name: { formatted_name: 'Maria' },
          phones: [{ phone: '+5511999990000' }],
          emails: [{ email: 'maria@example.com' }],
          org: { company: 'Acme' },
        },
      ],
    });
  });

  it('AU-83 builds a reaction', async () => {
    const payload = await session({
      content: { kind: MessageKind.Reaction, targetMessageId: 'msg_0', emoji: '👍' },
      reactionTarget: 'wamid.T',
    });
    expect(payload).toEqual({ ...BASE, type: 'reaction', reaction: { message_id: 'wamid.T', emoji: '👍' } });
  });

  it('AU-84 sends an empty emoji to remove a reaction', async () => {
    const payload = await session({
      content: { kind: MessageKind.Reaction, targetMessageId: 'msg_0', emoji: null },
      reactionTarget: 'wamid.T',
    });
    expect(payload).toMatchObject({ reaction: { message_id: 'wamid.T', emoji: '' } });
  });

  it('AU-99 refuses a reaction without a channel target', async () => {
    const content: MessageContent = { kind: MessageKind.Reaction, targetMessageId: 'msg_0', emoji: '👍' };
    await expect(session({ content, reactionTarget: null })).rejects.toBeInstanceOf(ChannelError);
  });
});

describe('buildTemplatePayload', () => {
  it('AU-68 builds the Portuguese notice', () => {
    const payload = buildTemplatePayload({
      recipientWaId: RECIPIENT,
      kind: TemplateKind.Notice,
      locale: OwnerLocale.PortugueseBrazil,
      parameters: ['Agente de teste', 'Mensagem de exemplo'],
    });
    expect(payload).toEqual(templatePortugueseFixture);
  });

  it('WI-68 builds the English notice', () => {
    const payload = buildTemplatePayload({
      recipientWaId: RECIPIENT,
      kind: TemplateKind.Notice,
      locale: OwnerLocale.EnglishUs,
      parameters: ['Agente de teste', 'Mensagem de exemplo'],
    });
    expect(payload).toEqual(templateEnglishFixture);
  });

  it('names the question template for a question notice', () => {
    const payload = buildTemplatePayload({
      recipientWaId: RECIPIENT,
      kind: TemplateKind.QuestionNotice,
      locale: OwnerLocale.EnglishUs,
      parameters: ['alpha', 'Deploy?'],
    });
    expect(payload).toMatchObject({ template: { name: 'zapbip_agent_question', language: { code: 'en_US' } } });
  });

  it('WI-72 replaces a blank preview with the locale fallback', () => {
    const payload = buildTemplatePayload({
      recipientWaId: RECIPIENT,
      kind: TemplateKind.Notice,
      locale: OwnerLocale.PortugueseBrazil,
      parameters: ['alpha', '  \n '],
    });
    expect(payload).toMatchObject({
      template: { components: [{ parameters: [{ text: 'alpha' }, { text: 'uma mensagem' }] }] },
    });
  });

  it('flattens a line break in a parameter', () => {
    const payload = buildTemplatePayload({
      recipientWaId: RECIPIENT,
      kind: TemplateKind.Notice,
      locale: OwnerLocale.EnglishUs,
      parameters: ['alpha', 'linha\numa'],
    });
    expect(payload).toMatchObject({ template: { components: [{ parameters: [{ text: 'alpha' }, { text: 'linha uma' }] }] } });
  });

  it('refuses a parameter list that is not an agent and a preview', () => {
    expect(() =>
      buildTemplatePayload({ recipientWaId: RECIPIENT, kind: TemplateKind.Notice, locale: OwnerLocale.EnglishUs, parameters: ['alpha'] }),
    ).toThrow('parameters');
  });
});
