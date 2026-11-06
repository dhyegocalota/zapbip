import { createHash } from 'node:crypto';
import { ChannelInboundKind, ForwardedKind, IdPrefix, MessageKind } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { parseWebhookNotification, type ParsedChange, type ParsedEntry } from '../../src/adapters/whatsapp/inbound-parser';
import { OperatorLogReason, ParsedEntryKind } from '../../src/adapters/whatsapp/whatsapp-enums';
import audioFixture from '../fixtures/whatsapp/inbound/audio.json';
import audioVoiceFixture from '../fixtures/whatsapp/inbound/audio-voice.json';
import buttonFixture from '../fixtures/whatsapp/inbound/button.json';
import buttonReplyFixture from '../fixtures/whatsapp/inbound/button-reply.json';
import contactsFixture from '../fixtures/whatsapp/inbound/contacts.json';
import documentFixture from '../fixtures/whatsapp/inbound/document.json';
import imageFixture from '../fixtures/whatsapp/inbound/image.json';
import imageForwardedFixture from '../fixtures/whatsapp/inbound/image-forwarded.json';
import listReplyFixture from '../fixtures/whatsapp/inbound/list-reply.json';
import locationFixture from '../fixtures/whatsapp/inbound/location.json';
import orderFixture from '../fixtures/whatsapp/inbound/order.json';
import reactionFixture from '../fixtures/whatsapp/inbound/reaction.json';
import reactionRemovalFixture from '../fixtures/whatsapp/inbound/reaction-removal.json';
import stickerFixture from '../fixtures/whatsapp/inbound/sticker.json';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import textForwardedFixture from '../fixtures/whatsapp/inbound/text-forwarded.json';
import textFrequentlyForwardedFixture from '../fixtures/whatsapp/inbound/text-frequently-forwarded.json';
import textReplyFixture from '../fixtures/whatsapp/inbound/text-reply.json';
import unsupportedFixture from '../fixtures/whatsapp/inbound/unsupported.json';
import videoFixture from '../fixtures/whatsapp/inbound/video.json';
import {
  changeOf,
  FOREIGN_PHONE_NUMBER_ID,
  notificationOf,
  notificationWith,
  OUR_PHONE_NUMBER_ID,
  OWNER_WA_ID,
} from '../fixtures/whatsapp/inbound/notification';

const AT_MS = 1_762_430_400_000;
const MEDIA_ID_HEX_LENGTH = 64;

async function entriesOf(input: { messages: object[] }): Promise<ParsedEntry[]> {
  const [change] = await parseWebhookNotification({ rawJson: notificationWith({ messages: input.messages }) });
  if (change === undefined) throw new Error('no change parsed');
  return change.entries;
}

async function inboundOf(input: { message: object }) {
  const [entry] = await entriesOf({ messages: [input.message] });
  if (entry === undefined || entry.kind !== ParsedEntryKind.Inbound) throw new Error('message was not parsed as inbound');
  return entry;
}

function mediaIdOf(input: { channelMessageId: string }): string {
  return `${IdPrefix.Media}_${createHash('sha256').update(input.channelMessageId).digest('hex')}`;
}

describe('parseWebhookNotification', () => {
  it('AU-19 parses a text', async () => {
    const parsed = await inboundOf({ message: textFixture });
    expect(parsed).toEqual({
      kind: ParsedEntryKind.Inbound,
      channelMessageId: 'wamid.TEXT',
      fromWaId: OWNER_WA_ID,
      at: AT_MS,
      media: null,
      entry: {
        kind: ChannelInboundKind.Owner,
        at: AT_MS,
        content: { kind: MessageKind.Text, text: 'Oi' },
        replyToChannelMessageId: null,
        forwarded: ForwardedKind.None,
      },
    });
  });

  it('AU-20 parses an image with caption and carries the download request', async () => {
    const parsed = await inboundOf({ message: imageFixture });
    expect(parsed.entry).toEqual({
      kind: ChannelInboundKind.Owner,
      at: AT_MS,
      content: { kind: MessageKind.Image, voice: false, filename: null, caption: 'Foto' },
      replyToChannelMessageId: null,
      forwarded: ForwardedKind.None,
    });
    expect(parsed.media).toEqual({
      mediaId: mediaIdOf({ channelMessageId: 'wamid.IMAGE' }),
      channelMediaId: '900000000000001',
      mimeType: 'image/jpeg',
      sha256Base64: 'aW1hZ2Utc2hhMjU2',
      filename: null,
      caption: 'Foto',
      mediaKind: MessageKind.Image,
    });
  });

  it('AU-21 parses a video', async () => {
    const parsed = await inboundOf({ message: videoFixture });
    expect(parsed.media?.mediaKind).toBe(MessageKind.Video);
  });

  it('AU-22 parses an audio without voice as audio', async () => {
    const parsed = await inboundOf({ message: audioFixture });
    expect(parsed.media?.mediaKind).toBe(MessageKind.Audio);
    expect(parsed.entry).toMatchObject({ content: { kind: MessageKind.Audio, voice: false } });
  });

  it('AU-23 parses an audio with voice true as a voice note', async () => {
    const parsed = await inboundOf({ message: audioVoiceFixture });
    expect(parsed.media?.mediaKind).toBe(MessageKind.Audio);
    expect(parsed.entry).toMatchObject({ content: { kind: MessageKind.Audio, voice: true } });
  });

  it('AU-24 parses a document with its filename', async () => {
    const parsed = await inboundOf({ message: documentFixture });
    expect(parsed.media).toMatchObject({ mediaKind: MessageKind.Document, filename: 'relatorio.pdf' });
    expect(parsed.entry).toMatchObject({ content: { kind: MessageKind.Document, filename: 'relatorio.pdf' } });
  });

  it('AU-25 parses a sticker', async () => {
    const parsed = await inboundOf({ message: stickerFixture });
    expect(parsed.media?.mediaKind).toBe(MessageKind.Sticker);
  });

  it('AU-26 parses a location with numeric coordinates', async () => {
    const parsed = await inboundOf({ message: locationFixture });
    expect(parsed.entry).toMatchObject({
      content: { kind: MessageKind.Location, latitude: -23.5505, longitude: -46.6333, name: 'Paulista', address: 'Av. Paulista, 1000' },
    });
    expect(parsed.media).toBeNull();
  });

  it('AU-27 parses contacts', async () => {
    const parsed = await inboundOf({ message: contactsFixture });
    expect(parsed.entry).toMatchObject({
      content: {
        kind: MessageKind.Contacts,
        contacts: [{ name: 'Maria Souza', phones: ['+55 11 90000-0002'], emails: ['maria@example.com'], organization: 'Acme' }],
      },
    });
  });

  it('AU-28 parses a reaction with its target and emoji', async () => {
    const parsed = await inboundOf({ message: reactionFixture });
    expect(parsed.entry).toMatchObject({ content: { kind: MessageKind.Reaction, targetMessageId: 'wamid.TARGET', emoji: '👍' } });
  });

  it('AU-29 parses a reaction without emoji as a removal', async () => {
    const parsed = await inboundOf({ message: reactionRemovalFixture });
    expect(parsed.entry).toMatchObject({ content: { kind: MessageKind.Reaction, targetMessageId: 'wamid.TARGET', emoji: null } });
  });

  it('AU-30 parses a button reply as a choice', async () => {
    const parsed = await inboundOf({ message: buttonReplyFixture });
    expect(parsed.entry).toMatchObject({
      replyToChannelMessageId: 'wamid.QUESTION',
      content: { kind: MessageKind.Choice, optionId: 'q_1:0', optionTitle: 'Sim', optionDescription: null },
    });
  });

  it('AU-27b parses a list reply as a choice with its description', async () => {
    const parsed = await inboundOf({ message: listReplyFixture });
    expect(parsed.entry).toMatchObject({
      content: { kind: MessageKind.Choice, optionId: 'q_1:1', optionTitle: 'Talvez', optionDescription: 'Depende do preço' },
    });
  });

  it('AU-28b parses a template quick reply as window only', async () => {
    const parsed = await inboundOf({ message: buttonFixture });
    expect(parsed.entry).toEqual({ kind: ChannelInboundKind.WindowOnly, at: AT_MS });
    expect(parsed.media).toBeNull();
  });

  it('AU-29b parses an unsupported message with its type', async () => {
    const parsed = await inboundOf({ message: unsupportedFixture });
    expect(parsed.entry).toEqual({ kind: ChannelInboundKind.Unsupported, at: AT_MS, unsupportedType: 'poll' });
  });

  it('parses a forwarded text, which carries context without an id', async () => {
    const parsed = await inboundOf({ message: textForwardedFixture });
    expect(parsed.entry).toMatchObject({
      content: { kind: MessageKind.Text, text: 'Oi' },
      replyToChannelMessageId: null,
      forwarded: ForwardedKind.Forwarded,
    });
  });

  it('parses a frequently forwarded text', async () => {
    const parsed = await inboundOf({ message: textFrequentlyForwardedFixture });
    expect(parsed.entry).toMatchObject({ replyToChannelMessageId: null, forwarded: ForwardedKind.FrequentlyForwarded });
  });

  it('prefers frequently forwarded when both flags are set', async () => {
    const parsed = await inboundOf({ message: { ...textFixture, context: { forwarded: true, frequently_forwarded: true } } });
    expect(parsed.entry).toMatchObject({ forwarded: ForwardedKind.FrequentlyForwarded });
  });

  it('parses a forwarded image with its download request', async () => {
    const parsed = await inboundOf({ message: imageForwardedFixture });
    expect(parsed.entry).toMatchObject({ content: { kind: MessageKind.Image }, forwarded: ForwardedKind.Forwarded });
    expect(parsed.media).toMatchObject({ channelMediaId: '900000000000001' });
  });

  it('keeps the reply target and no forwarding on a plain reply', async () => {
    const parsed = await inboundOf({ message: textReplyFixture });
    expect(parsed.entry).toMatchObject({ replyToChannelMessageId: 'wamid.X', forwarded: ForwardedKind.None });
  });

  it('pin: parses a reaction with an empty emoji as a removal', async () => {
    const parsed = await inboundOf({ message: { ...reactionFixture, reaction: { message_id: 'wamid.TARGET', emoji: '' } } });
    expect(parsed.entry).toMatchObject({ content: { kind: MessageKind.Reaction, targetMessageId: 'wamid.TARGET', emoji: null } });
  });

  it('parses an unsupported message without a type as unsupported with no type', async () => {
    const { unsupported, ...withoutDetail } = unsupportedFixture;
    void unsupported;
    const parsed = await inboundOf({ message: withoutDetail });
    expect(parsed.entry).toEqual({ kind: ChannelInboundKind.Unsupported, at: AT_MS, unsupportedType: null });
  });

  it('AU-30b carries context.id as the reply target', async () => {
    const parsed = await inboundOf({ message: textReplyFixture });
    expect(parsed.entry).toMatchObject({ replyToChannelMessageId: 'wamid.X' });
  });

  it('converts a numeric timestamp in seconds to milliseconds', async () => {
    const parsed = await inboundOf({ message: { ...textFixture, timestamp: 1_762_430_400 } });
    expect(parsed.at).toBe(AT_MS);
  });

  it('AU-31 parses a type outside the table as unsupported with that type', async () => {
    const parsed = await inboundOf({ message: orderFixture });
    expect(parsed.entry).toEqual({ kind: ChannelInboundKind.Unsupported, at: AT_MS, unsupportedType: 'order' });
  });

  it('parses an interactive message of another type as unsupported with that type', async () => {
    const parsed = await inboundOf({ message: { ...buttonReplyFixture, interactive: { type: 'nfm_reply' } } });
    expect(parsed.entry).toEqual({ kind: ChannelInboundKind.Unsupported, at: AT_MS, unsupportedType: 'nfm_reply' });
  });

  it('derives the media id from the wamid: med_ plus 64 hex characters, stable per wamid', async () => {
    const first = await inboundOf({ message: { ...imageFixture, id: 'wamid.HBg=' } });
    const second = await inboundOf({ message: { ...imageFixture, id: 'wamid.HBg=' } });
    expect(first.media?.mediaId).toMatch(new RegExp(`^${IdPrefix.Media}_[0-9a-f]{${MEDIA_ID_HEX_LENGTH}}$`));
    expect(first.media?.mediaId).toBe(second.media?.mediaId);
    expect(first.media?.mediaId).toBe(mediaIdOf({ channelMessageId: 'wamid.HBg=' }));
  });

  it('AU-32 rejects a message without from and parses the good one beside it', async () => {
    const { from, ...withoutSender } = textFixture;
    void from;
    const entries = await entriesOf({ messages: [withoutSender, { ...textFixture, id: 'wamid.GOOD' }] });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ kind: ParsedEntryKind.Rejected, reason: OperatorLogReason.MissingSender });
    expect(entries[1]).toMatchObject({ kind: ParsedEntryKind.Inbound, channelMessageId: 'wamid.GOOD' });
  });

  it('rejects a message whose from is not a phone number', async () => {
    const entries = await entriesOf({ messages: [{ ...textFixture, from: 'not-a-number' }] });
    expect(entries).toEqual([{ kind: ParsedEntryKind.Rejected, reason: OperatorLogReason.InvalidSender }]);
  });

  it('AU-35 rejects a message with an invalid timestamp and parses the text beside it', async () => {
    const entries = await entriesOf({
      messages: [
        { ...textFixture, timestamp: 'abc' },
        { ...textFixture, id: 'wamid.GOOD' },
      ],
    });
    expect(entries[0]).toEqual({ kind: ParsedEntryKind.Rejected, reason: OperatorLogReason.MalformedEntry });
    expect(entries[1]).toMatchObject({ kind: ParsedEntryKind.Inbound, channelMessageId: 'wamid.GOOD' });
  });

  it('rejects a message without a timestamp', async () => {
    const { timestamp, ...withoutTimestamp } = textFixture;
    void timestamp;
    const entries = await entriesOf({ messages: [withoutTimestamp] });
    expect(entries).toEqual([{ kind: ParsedEntryKind.Rejected, reason: OperatorLogReason.MalformedEntry }]);
  });

  it('rejects a text whose payload is malformed and keeps the rest of the batch', async () => {
    const entries = await entriesOf({
      messages: [
        { ...textFixture, text: {} },
        { ...textFixture, id: 'wamid.GOOD' },
      ],
    });
    expect(entries[0]).toEqual({ kind: ParsedEntryKind.Rejected, reason: OperatorLogReason.MalformedEntry });
    expect(entries[1]).toMatchObject({ kind: ParsedEntryKind.Inbound, channelMessageId: 'wamid.GOOD' });
  });

  it('AU-33 reports a change with another field without parsing its messages', async () => {
    const changes: ParsedChange[] = await parseWebhookNotification({
      rawJson: notificationOf({ changes: [changeOf({ field: 'account_alerts', phoneNumberId: null, messages: [textFixture] })] }),
    });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ field: 'account_alerts', phoneNumberId: null, entries: [], statuses: [] });
  });

  it('AU-34 keeps the phone number id of each change', async () => {
    const changes = await parseWebhookNotification({
      rawJson: notificationOf({
        changes: [
          changeOf({ phoneNumberId: FOREIGN_PHONE_NUMBER_ID, messages: [textFixture] }),
          changeOf({ phoneNumberId: OUR_PHONE_NUMBER_ID, messages: [{ ...textFixture, id: 'wamid.OURS' }] }),
        ],
      }),
    });
    expect(changes.map((change) => change.phoneNumberId)).toEqual([FOREIGN_PHONE_NUMBER_ID, OUR_PHONE_NUMBER_ID]);
    expect(changes[1]?.entries[0]).toMatchObject({ kind: ParsedEntryKind.Inbound, channelMessageId: 'wamid.OURS' });
  });

  it('parses statuses beside messages in the same change', async () => {
    const [change] = await parseWebhookNotification({
      rawJson: notificationWith({ messages: [textFixture], statuses: [{ id: 'wamid.S', status: 'read', timestamp: '1762430400' }] }),
    });
    expect(change?.entries).toHaveLength(1);
    expect(change?.statuses).toHaveLength(1);
  });

  it('throws for a body without an entry array', async () => {
    await expect(parseWebhookNotification({ rawJson: { object: 'whatsapp_business_account' } })).rejects.toThrow();
    await expect(parseWebhookNotification({ rawJson: 'text' })).rejects.toThrow();
  });
});
