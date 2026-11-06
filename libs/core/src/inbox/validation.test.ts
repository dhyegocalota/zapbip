import { InboxErrorCode, MessageKind, OptionRender } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import {
  assertHttpsLink,
  assertMaxChars,
  assertMediaFits,
  assertUploadDeclaration,
  assertVoiceNote,
  normalizeText,
  parseAgentName,
  parseEmoji,
  parseOptionDescriptions,
  parseOptions,
  parseTimeoutMs,
} from './validation';
import { captureInboxError } from './testing/capture-inbox-error';

function invalidInput(message: string) {
  return { code: InboxErrorCode.InvalidInput, message };
}

function titles(input: { count: number; length: number }): string[] {
  return Array.from({ length: input.count }, (_, index) => String(index).padEnd(input.length, 'x'));
}

describe('normalizeText', () => {
  test('CU-1 trims and collapses whitespace', () => {
    expect(normalizeText({ value: '  olá   mundo \n' })).toBe('olá mundo');
  });

  test('CU-2 applies NFC', () => {
    const normalized = normalizeText({ value: 'é' });
    expect(normalized).toBe('é');
    expect([...normalized]).toHaveLength(1);
  });
});

describe('assertMaxChars', () => {
  test('CU-3 text at the limit', async () => {
    expect(() => assertMaxChars({ field: 'text', value: 'a'.repeat(4096), maxChars: 4096 })).not.toThrow();
  });

  test('CU-4 text over the limit', async () => {
    const error = await captureInboxError(() => assertMaxChars({ field: 'text', value: 'a'.repeat(4097), maxChars: 4096 }));
    expect(error).toEqual(invalidInput('text: must be at most 4096 characters'));
  });

  test('CU-5 counts code points', () => {
    expect(() => assertMaxChars({ field: 'text', value: '😀'.repeat(4096), maxChars: 4096 })).not.toThrow();
  });

  test('CU-6 empty after trim', async () => {
    const error = await captureInboxError(() => assertMaxChars({ field: 'text', value: '   ', maxChars: 4096 }));
    expect(error).toEqual(invalidInput('text: must not be empty'));
  });

  test('CU-7 caption at the limit', () => {
    expect(() => assertMaxChars({ field: 'caption', value: 'c'.repeat(1024), maxChars: 1024 })).not.toThrow();
  });

  test('CU-8 caption over the limit', async () => {
    const error = await captureInboxError(() => assertMaxChars({ field: 'caption', value: 'c'.repeat(1025), maxChars: 1024 }));
    expect(error).toEqual(invalidInput('caption: must be at most 1024 characters'));
  });

  test('CU-9 question over the limit', async () => {
    const error = await captureInboxError(() => assertMaxChars({ field: 'question', value: 'q'.repeat(1025), maxChars: 1024 }));
    expect(error).toEqual(invalidInput('question: must be at most 1024 characters'));
  });
});

describe('parseOptions', () => {
  test('CU-10 one option is a button', () => {
    expect(parseOptions({ options: ['Sim'] })).toEqual({ render: OptionRender.Buttons, titles: ['Sim'] });
  });

  test('CU-11 no options', async () => {
    const error = await captureInboxError(() => parseOptions({ options: [] }));
    expect(error).toEqual(invalidInput('options: must have 1 to 10 entries'));
  });

  test('CU-12 eleven options', async () => {
    const error = await captureInboxError(() => parseOptions({ options: titles({ count: 11, length: 5 }) }));
    expect(error).toEqual(invalidInput('options: must have 1 to 10 entries'));
  });

  test('CU-13 three buttons at the title limit', () => {
    expect(parseOptions({ options: titles({ count: 3, length: 20 }) }).render).toBe(OptionRender.Buttons);
  });

  test('CU-14 button title over the limit', async () => {
    const options = [...titles({ count: 1, length: 21 }), ...titles({ count: 2, length: 5 })];
    const error = await captureInboxError(() => parseOptions({ options }));
    expect(error).toEqual(invalidInput('options[0]: button title must be at most 20 characters'));
  });

  test('CU-15 four options become a list', () => {
    expect(parseOptions({ options: titles({ count: 4, length: 24 }) }).render).toBe(OptionRender.List);
  });

  test('CU-16 list row over the limit', async () => {
    const options = [...titles({ count: 1, length: 5 }), ...titles({ count: 1, length: 25 }), ...titles({ count: 2, length: 5 })];
    const error = await captureInboxError(() => parseOptions({ options }));
    expect(error).toEqual(invalidInput('options[1]: list row title must be at most 24 characters'));
  });

  test('CU-17 four options accept a 21 character title', () => {
    const options = [...titles({ count: 1, length: 21 }), ...titles({ count: 3, length: 5 })];
    expect(parseOptions({ options }).render).toBe(OptionRender.List);
  });

  test('normalises titles', () => {
    expect(parseOptions({ options: ['  Sim  '] }).titles).toEqual(['Sim']);
  });

  test('rejects an empty title', async () => {
    const error = await captureInboxError(() => parseOptions({ options: ['Sim', '  '] }));
    expect(error).toEqual(invalidInput('options[1]: must not be empty'));
  });
});

describe('parseTimeoutMs', () => {
  test('CU-18 minimum', () => {
    expect(parseTimeoutMs({ seconds: 1 })).toBe(1000);
  });

  test('CU-19 maximum', () => {
    expect(parseTimeoutMs({ seconds: 50 })).toBe(50000);
  });

  test('CU-20 below the minimum', async () => {
    const error = await captureInboxError(() => parseTimeoutMs({ seconds: 0 }));
    expect(error).toEqual(invalidInput('timeout_seconds: must be between 1 and 50'));
  });

  test('CU-21 above the maximum', async () => {
    const error = await captureInboxError(() => parseTimeoutMs({ seconds: 51 }));
    expect(error).toEqual(invalidInput('timeout_seconds: must be between 1 and 50'));
  });

  test('rejects a fraction', async () => {
    const error = await captureInboxError(() => parseTimeoutMs({ seconds: 1.5 }));
    expect(error).toEqual(invalidInput('timeout_seconds: must be between 1 and 50'));
  });
});

describe('parseEmoji', () => {
  test('CU-22 empty removes', () => {
    expect(parseEmoji({ emoji: '' })).toBeNull();
  });

  test('CU-23 one emoji', () => {
    expect(parseEmoji({ emoji: '👍' })).toBe('👍');
  });

  test('CU-24 one grapheme of two code points', () => {
    expect(parseEmoji({ emoji: '👍🏽' })).toBe('👍🏽');
  });

  test('CU-25 two emoji', async () => {
    const error = await captureInboxError(() => parseEmoji({ emoji: '👍👍' }));
    expect(error).toEqual(invalidInput('emoji: must be one emoji'));
  });

  test('CU-26 a letter', async () => {
    const error = await captureInboxError(() => parseEmoji({ emoji: 'a' }));
    expect(error).toEqual(invalidInput('emoji: must be one emoji'));
  });
});

describe('assertHttpsLink', () => {
  test('CU-27 https', () => {
    expect(() => assertHttpsLink({ value: 'https://example.com/a.pdf' })).not.toThrow();
  });

  test('CU-28 http', async () => {
    const error = await captureInboxError(() => assertHttpsLink({ value: 'http://example.com/a.pdf' }));
    expect(error).toEqual(invalidInput('url: must be an https URL'));
  });

  test('CU-29 other scheme', async () => {
    const error = await captureInboxError(() => assertHttpsLink({ value: 'ftp://example.com/a.pdf' }));
    expect(error).toEqual(invalidInput('url: must be an https URL'));
  });

  test('not a URL', async () => {
    const error = await captureInboxError(() => assertHttpsLink({ value: 'example' }));
    expect(error).toEqual(invalidInput('url: must be an https URL'));
  });
});

describe('assertMediaFits', () => {
  test('CU-30 image at the limit', () => {
    expect(() => assertMediaFits({ kind: MessageKind.Image, mimeType: 'image/jpeg', sizeBytes: 5_000_000 })).not.toThrow();
  });

  test('CU-31 image over the limit', async () => {
    const error = await captureInboxError(() => assertMediaFits({ kind: MessageKind.Image, mimeType: 'image/jpeg', sizeBytes: 5_000_001 }));
    expect(error).toEqual(invalidInput('size_bytes: image must be at most 5000000 bytes'));
  });

  test('CU-32 image with a video type', async () => {
    const error = await captureInboxError(() => assertMediaFits({ kind: MessageKind.Image, mimeType: 'video/mp4', sizeBytes: 1000 }));
    expect(error).toEqual(invalidInput('mime_type: image must be an image/* type'));
  });

  test('image with an svg type', async () => {
    const error = await captureInboxError(() => assertMediaFits({ kind: MessageKind.Image, mimeType: 'image/svg+xml', sizeBytes: 1000 }));
    expect(error).toEqual(invalidInput('mime_type: image must not be image/svg+xml'));
  });

  test.each(['image/SVG+XML', 'image/svg+xml;x=1', ' Image/Svg+Xml ; charset=utf-8'])('image with the svg type %s', async (mimeType) => {
    const error = await captureInboxError(() => assertMediaFits({ kind: MessageKind.Image, mimeType, sizeBytes: 1000 }));
    expect(error).toEqual(invalidInput('mime_type: image must not be image/svg+xml'));
  });

  test.each([
    'image/svg+xml,image/png',
    'image/svg+xml\0',
    'image/svg+xml\u200b',
    'image/svg+xml\u00a0x',
    'image',
    'image/',
    '/png',
    'image/svg xml',
  ])('a media type outside the type/subtype grammar %j is invalid input', async (mimeType) => {
    const error = await captureInboxError(() => assertMediaFits({ kind: MessageKind.Image, mimeType, sizeBytes: 1000 }));
    expect(error).toEqual(invalidInput('mime_type: must be a type/subtype token'));
  });

  test('an upload declaration outside the type/subtype grammar is invalid input', async () => {
    const error = await captureInboxError(() => assertUploadDeclaration({ mimeType: 'image/svg+xml,image/png', sizeBytes: 10 }));
    expect(error).toEqual(invalidInput('mime_type: must be a type/subtype token'));
  });

  test('a sticker type is compared without case or parameters', () => {
    expect(() => assertMediaFits({ kind: MessageKind.Sticker, mimeType: 'IMAGE/WEBP; q=1', sizeBytes: 1000 })).not.toThrow();
  });

  test('a media prefix is compared without case', () => {
    expect(() => assertMediaFits({ kind: MessageKind.Video, mimeType: 'VIDEO/MP4', sizeBytes: 1000 })).not.toThrow();
  });

  test('CU-33 audio with a video type', async () => {
    const error = await captureInboxError(() => assertMediaFits({ kind: MessageKind.Audio, mimeType: 'video/mp4', sizeBytes: 1000 }));
    expect(error).toEqual(invalidInput('mime_type: audio must be an audio/* type'));
  });

  test('video with an image type', async () => {
    const error = await captureInboxError(() => assertMediaFits({ kind: MessageKind.Video, mimeType: 'image/png', sizeBytes: 1000 }));
    expect(error).toEqual(invalidInput('mime_type: video must be a video/* type'));
  });

  test('CU-36 sticker webp at the limit', () => {
    expect(() => assertMediaFits({ kind: MessageKind.Sticker, mimeType: 'image/webp', sizeBytes: 100_000 })).not.toThrow();
  });

  test('CU-37 sticker over the limit', async () => {
    const error = await captureInboxError(() => assertMediaFits({ kind: MessageKind.Sticker, mimeType: 'image/webp', sizeBytes: 100_001 }));
    expect(error).toEqual(invalidInput('size_bytes: sticker must be at most 100000 bytes'));
  });

  test('CU-38 sticker as png', async () => {
    const error = await captureInboxError(() => assertMediaFits({ kind: MessageKind.Sticker, mimeType: 'image/png', sizeBytes: 1000 }));
    expect(error).toEqual(invalidInput('mime_type: sticker must be image/webp'));
  });

  test('CU-39 document at the limit', () => {
    expect(() => assertMediaFits({ kind: MessageKind.Document, mimeType: 'application/pdf', sizeBytes: 100_000_000 })).not.toThrow();
  });

  test('CU-40 document over the limit', async () => {
    const error = await captureInboxError(() =>
      assertMediaFits({ kind: MessageKind.Document, mimeType: 'application/pdf', sizeBytes: 100_000_001 }),
    );
    expect(error).toEqual(invalidInput('size_bytes: document must be at most 100000000 bytes'));
  });

  test('CU-41 link source with unknown type and size', () => {
    expect(() => assertMediaFits({ kind: MessageKind.Document, mimeType: null, sizeBytes: null })).not.toThrow();
  });
});

describe('assertVoiceNote', () => {
  test('CU-34 voice note on audio', () => {
    expect(() => assertVoiceNote({ kind: MessageKind.Audio, voice: true })).not.toThrow();
  });

  test('CU-35 voice flag on a video', async () => {
    const error = await captureInboxError(() => assertVoiceNote({ kind: MessageKind.Video, voice: true }));
    expect(error).toEqual(invalidInput('voice: only audio can be a voice note'));
  });

  test('no voice flag on a video', () => {
    expect(() => assertVoiceNote({ kind: MessageKind.Video, voice: false })).not.toThrow();
  });
});

describe('assertUploadDeclaration', () => {
  test('CU-42 one byte', () => {
    expect(() => assertUploadDeclaration({ mimeType: 'application/pdf', sizeBytes: 1 })).not.toThrow();
  });

  test('CU-43 zero bytes', async () => {
    const error = await captureInboxError(() => assertUploadDeclaration({ mimeType: 'application/pdf', sizeBytes: 0 }));
    expect(error).toEqual(invalidInput('size_bytes: must be at least 1'));
  });

  test('the largest media limit is accepted', () => {
    expect(() => assertUploadDeclaration({ mimeType: 'application/pdf', sizeBytes: 100_000_000 })).not.toThrow();
  });

  test('one byte over the largest media limit', async () => {
    const error = await captureInboxError(() => assertUploadDeclaration({ mimeType: 'application/pdf', sizeBytes: 100_000_001 }));
    expect(error).toEqual(invalidInput('size_bytes: must be at most 100000000 bytes'));
  });

  test('CU-44 empty type', async () => {
    const error = await captureInboxError(() => assertUploadDeclaration({ mimeType: '', sizeBytes: 10 }));
    expect(error).toEqual(invalidInput('mime_type: must be at least 3 characters'));
  });

  test('CU-45 type over 127 characters', async () => {
    const error = await captureInboxError(() => assertUploadDeclaration({ mimeType: 'a'.repeat(128), sizeBytes: 10 }));
    expect(error).toEqual(invalidInput('mime_type: must be at most 127 characters'));
  });
});

describe('parseAgentName', () => {
  const patternMessage = 'agent: must match ^[a-z0-9][a-z0-9-]{0,19}$';

  test('CU-46 valid', () => {
    expect(parseAgentName({ value: 'claude-code' })).toBe('claude-code');
  });

  test('CU-47 upper case', async () => {
    const error = await captureInboxError(() => parseAgentName({ value: 'Claude' }));
    expect(error).toEqual(invalidInput(patternMessage));
  });

  test('CU-48 leading hyphen', async () => {
    const error = await captureInboxError(() => parseAgentName({ value: '-x' }));
    expect(error).toEqual(invalidInput(patternMessage));
  });

  test('CU-49 at 20 characters', () => {
    expect(parseAgentName({ value: `a${'b'.repeat(19)}` })).toBe(`a${'b'.repeat(19)}`);
  });

  test('CU-50 at 21 characters', async () => {
    const error = await captureInboxError(() => parseAgentName({ value: `a${'b'.repeat(20)}` }));
    expect(error).toEqual(invalidInput(patternMessage));
  });
});

describe('parseOptionDescriptions', () => {
  test('CU-51 description over 72 characters', async () => {
    const error = await captureInboxError(() => parseOptionDescriptions({ descriptions: ['d'.repeat(73)] }));
    expect(error).toEqual(invalidInput('options[0]: description must be at most 72 characters'));
  });

  test('keeps null and normalises text', () => {
    expect(parseOptionDescriptions({ descriptions: [null, '  deploy  now '] })).toEqual([null, 'deploy now']);
  });

  test('description at the limit', () => {
    expect(parseOptionDescriptions({ descriptions: ['d'.repeat(72)] })).toEqual(['d'.repeat(72)]);
  });
});
