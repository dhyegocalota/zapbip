import { ChannelError, type MediaMessageKind } from '@zapbip/core';
import { ChannelErrorKind, InboxErrorCode, MessageKind } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import {
  assertButtonLimits,
  assertListLimits,
  assertOutboundMedia,
  assertReactionTarget,
  assertTextBody,
} from '../../src/adapters/whatsapp/outbound-limits';

function chars(length: number): string {
  return 'a'.repeat(length);
}

function replies(count: number): { id: string; title: string }[] {
  return Array.from({ length: count }, (_, index) => ({ id: `q:${index}`, title: 'Sim' }));
}

function rows(count: number): { id: string; title: string; description: string | null }[] {
  return Array.from({ length: count }, (_, index) => ({ id: `q:${index}`, title: 'Item', description: null }));
}

const LIST = { bodyText: 'Qual?', buttonLabel: 'Ver opções', sectionTitle: 'Opções', rows: rows(4) };

function media(input: { mediaKind: MediaMessageKind; mimeType: string | null; sizeBytes: number | null }): () => void {
  return () => assertOutboundMedia(input);
}

describe('assertButtonLimits', () => {
  it('AU-69 accepts a 20 character title and refuses 21', () => {
    expect(() => assertButtonLimits({ bodyText: 'Ok?', replies: [{ id: 'q:0', title: chars(20) }] })).not.toThrow();
    expect(() => assertButtonLimits({ bodyText: 'Ok?', replies: [{ id: 'q:0', title: chars(21) }] })).toThrow(
      'interactive.action.buttons[0].reply.title',
    );
  });

  it('AU-70 accepts three buttons and refuses four', () => {
    expect(() => assertButtonLimits({ bodyText: 'Ok?', replies: replies(3) })).not.toThrow();
    expect(() => assertButtonLimits({ bodyText: 'Ok?', replies: replies(4) })).toThrow('interactive.action.buttons');
  });

  it('AU-71 accepts a 1024 character body and refuses 1025', () => {
    expect(() => assertButtonLimits({ bodyText: chars(1_024), replies: replies(1) })).not.toThrow();
    expect(() => assertButtonLimits({ bodyText: chars(1_025), replies: replies(1) })).toThrow('interactive.body.text');
  });

  it('AU-97 refuses a reply id of 257 characters', () => {
    expect(() => assertButtonLimits({ bodyText: 'Ok?', replies: [{ id: chars(256), title: 'Sim' }] })).not.toThrow();
    expect(() => assertButtonLimits({ bodyText: 'Ok?', replies: [{ id: chars(257), title: 'Sim' }] })).toThrow(
      'interactive.action.buttons[0].reply.id',
    );
  });

  it('types the refusal as an invalid input', () => {
    expect(() => assertButtonLimits({ bodyText: 'Ok?', replies: replies(4) })).toThrowError(
      expect.objectContaining({ code: InboxErrorCode.InvalidInput }),
    );
  });
});

describe('assertListLimits', () => {
  it('AU-72 accepts ten rows and refuses eleven', () => {
    expect(() => assertListLimits({ ...LIST, rows: rows(10) })).not.toThrow();
    expect(() => assertListLimits({ ...LIST, rows: rows(11) })).toThrow('interactive.action.sections');
  });

  it('AU-73 accepts a 24 character row title and refuses 25', () => {
    expect(() => assertListLimits({ ...LIST, rows: [{ id: 'q:0', title: chars(24), description: null }] })).not.toThrow();
    expect(() => assertListLimits({ ...LIST, rows: [{ id: 'q:0', title: chars(25), description: null }] })).toThrow(
      'interactive.action.sections[0].rows[0].title',
    );
  });

  it('AU-95 refuses a section title of 25 characters', () => {
    expect(() => assertListLimits({ ...LIST, sectionTitle: chars(24) })).not.toThrow();
    expect(() => assertListLimits({ ...LIST, sectionTitle: chars(25) })).toThrow('interactive.action.sections[0].title');
  });

  it('AU-96 accepts a 72 character description and refuses 73', () => {
    expect(() => assertListLimits({ ...LIST, rows: [{ id: 'q:0', title: 'Item', description: chars(72) }] })).not.toThrow();
    expect(() => assertListLimits({ ...LIST, rows: [{ id: 'q:0', title: 'Item', description: chars(73) }] })).toThrow(
      'interactive.action.sections[0].rows[0].description',
    );
  });

  it('AU-97 accepts a 200 character row id and refuses 201', () => {
    expect(() => assertListLimits({ ...LIST, rows: [{ id: chars(200), title: 'Item', description: null }] })).not.toThrow();
    expect(() => assertListLimits({ ...LIST, rows: [{ id: chars(201), title: 'Item', description: null }] })).toThrow(
      'interactive.action.sections[0].rows[0].id',
    );
  });

  it('refuses a list button label of 21 characters and a body of 1025', () => {
    expect(() => assertListLimits({ ...LIST, buttonLabel: chars(21) })).toThrow('interactive.action.button');
    expect(() => assertListLimits({ ...LIST, bodyText: chars(1_025) })).toThrow('interactive.body.text');
  });
});

describe('assertTextBody', () => {
  it('AU-98 accepts 4096 characters and refuses 4097', () => {
    expect(() => assertTextBody({ body: chars(4_096) })).not.toThrow();
    expect(() => assertTextBody({ body: chars(4_097) })).toThrow('text.body');
  });
});

describe('assertReactionTarget', () => {
  it('AU-99 refuses a missing or empty target naming reaction.message_id', () => {
    expect(() => assertReactionTarget({ messageId: null })).toThrow('reaction.message_id');
    expect(() => assertReactionTarget({ messageId: '' })).toThrow('reaction.message_id');
    expect(() => assertReactionTarget({ messageId: 'wamid.T' })).not.toThrow();
  });

  it('types the refusal as a rejected reaction', () => {
    expect(() => assertReactionTarget({ messageId: null })).toThrowError(
      expect.objectContaining({ code: ChannelErrorKind.ReactionRejected }),
    );
  });
});

describe('assertOutboundMedia', () => {
  it('AU-100 accepts a 5 MB jpeg, refuses 5 MB + 1 naming kind and type, refuses gif', () => {
    expect(media({ mediaKind: MessageKind.Image, mimeType: 'image/jpeg', sizeBytes: 5_000_000 })).not.toThrow();
    expect(media({ mediaKind: MessageKind.Image, mimeType: 'image/jpeg', sizeBytes: 5_000_001 })).toThrow(/image.*image\/jpeg/);
    expect(media({ mediaKind: MessageKind.Image, mimeType: 'image/gif', sizeBytes: 1 })).toThrow('image/gif');
  });

  it('AU-101 accepts 3gpp and refuses webm', () => {
    expect(media({ mediaKind: MessageKind.Video, mimeType: 'video/3gpp', sizeBytes: 16_000_000 })).not.toThrow();
    expect(media({ mediaKind: MessageKind.Video, mimeType: 'video/webm', sizeBytes: 1 })).toThrow('video/webm');
  });

  it('AU-102 accepts ogg and refuses wav', () => {
    expect(media({ mediaKind: MessageKind.Audio, mimeType: 'audio/ogg', sizeBytes: 16_000_000 })).not.toThrow();
    expect(media({ mediaKind: MessageKind.Audio, mimeType: 'audio/wav', sizeBytes: 1 })).toThrow('audio/wav');
  });

  it('AU-103 accepts a 100 MB pdf, refuses one byte more and a zip', () => {
    expect(media({ mediaKind: MessageKind.Document, mimeType: 'application/pdf', sizeBytes: 100_000_000 })).not.toThrow();
    expect(media({ mediaKind: MessageKind.Document, mimeType: 'application/pdf', sizeBytes: 100_000_001 })).toThrow('document');
    expect(media({ mediaKind: MessageKind.Document, mimeType: 'application/zip', sizeBytes: 1 })).toThrow('application/zip');
  });

  it('AU-103 accepts Office and plain text documents', () => {
    ['text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].forEach((mimeType) =>
      expect(media({ mediaKind: MessageKind.Document, mimeType, sizeBytes: 1 })).not.toThrow(),
    );
  });

  it('AU-104 accepts a 100 KB webp sticker, refuses 100 KB + 1 and png', () => {
    expect(media({ mediaKind: MessageKind.Sticker, mimeType: 'image/webp', sizeBytes: 100_000 })).not.toThrow();
    expect(media({ mediaKind: MessageKind.Sticker, mimeType: 'image/webp', sizeBytes: 100_001 })).toThrow('sticker');
    expect(media({ mediaKind: MessageKind.Sticker, mimeType: 'image/png', sizeBytes: 1 })).toThrow('image/png');
  });

  it('AU-105 accepts unknown type and size', () => {
    expect(media({ mediaKind: MessageKind.Image, mimeType: null, sizeBytes: null })).not.toThrow();
  });

  it('refuses with a media rejected channel error', () => {
    expect(media({ mediaKind: MessageKind.Image, mimeType: 'image/gif', sizeBytes: 1 })).toThrowError(
      expect.objectContaining({ code: ChannelErrorKind.MediaRejected, errorCode: null }),
    );
    expect(media({ mediaKind: MessageKind.Image, mimeType: 'image/gif', sizeBytes: 1 })).toThrow(ChannelError);
  });
});
