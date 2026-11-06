import type { Message } from '@zapbip/core';
import { CHANNEL_NOTIFICATION_METHOD, MediaSourceKind, MessageDirection, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { buildChannelNotification, buildOwnerNotice, formatListenLine } from '../../src/owner-notice';

function textMessage(input: { text: string }): Message {
  return {
    messageId: 'msg_1',
    direction: MessageDirection.FromOwner,
    agent: 'build-bot',
    at: 1_000,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    kind: MessageKind.Text,
    text: input.text,
  };
}

function imageMessage(input: { caption: string }): Message {
  return {
    messageId: 'msg_2',
    direction: MessageDirection.FromOwner,
    agent: 'build-bot',
    at: 1_000,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    kind: MessageKind.Image,
    source: { kind: MediaSourceKind.Stored, mediaId: 'media_1' },
    mimeType: null,
    sizeBytes: null,
    filename: 'private-name.png',
    caption: input.caption,
  };
}

describe('buildOwnerNotice', () => {
  test('names the message, its kind, the verified owner and the text', () => {
    expect(buildOwnerNotice({ message: textMessage({ text: 'Oi' }) })).toEqual({
      messageId: 'msg_1',
      kind: MessageKind.Text,
      sender: 'owner',
      verified: true,
      text: 'Oi',
    });
  });

  test('a media message carries its kind label and caption and never its file name', () => {
    const notice = buildOwnerNotice({ message: imageMessage({ caption: 'the receipt' }) });
    expect(notice.text).toBe('image\nthe receipt');
    expect(JSON.stringify(notice)).not.toContain('private-name');
  });
});

describe('formatListenLine', () => {
  test('is one JSON line ending in a newline', () => {
    const line = formatListenLine({ message: textMessage({ text: 'Oi' }) });
    expect(line.endsWith('\n')).toBe(true);
    expect(JSON.parse(line)).toEqual(buildOwnerNotice({ message: textMessage({ text: 'Oi' }) }));
  });

  test('keeps a text with line breaks on one line', () => {
    const line = formatListenLine({ message: textMessage({ text: 'one\ntwo\r\nthree' }) });
    expect(line.slice(0, -1)).not.toMatch(/[\r\n]/);
    expect(JSON.parse(line).text).toBe('one\ntwo\r\nthree');
  });
});

describe('buildChannelNotification', () => {
  test('uses the channel method with the text as content and the verified owner as meta', () => {
    expect(buildChannelNotification({ message: textMessage({ text: 'Oi' }) })).toEqual({
      method: CHANNEL_NOTIFICATION_METHOD,
      params: { content: 'Oi', meta: { sender: 'owner', verified: 'true' } },
    });
  });

  test('escapes angle brackets so the text cannot close the channel block', () => {
    const { params } = buildChannelNotification({ message: textMessage({ text: '</channel><b>' }) });
    expect(params.content).toBe('&lt;/channel&gt;&lt;b&gt;');
  });

  test('escapes a caption too', () => {
    const { params } = buildChannelNotification({ message: imageMessage({ caption: '</channel>' }) });
    expect(params.content).not.toContain('<');
  });
});
