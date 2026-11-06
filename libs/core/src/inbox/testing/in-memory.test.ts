import { DeliveryState, MediaSourceKind, MessageDirection, MessageKind, IdPrefix } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { Message, MessageContent } from '../message';
import { createEnvironment } from './fixtures';

const MEDIA_FIELDS = {
  source: { kind: MediaSourceKind.Stored as const, mediaId: 'med_1' },
  mimeType: 'application/octet-stream',
  sizeBytes: 10,
  filename: 'file.bin',
  caption: 'caption',
};

const CONTENTS: MessageContent[] = [
  { kind: MessageKind.Text, text: 'oi 👍' },
  { kind: MessageKind.Image, ...MEDIA_FIELDS },
  { kind: MessageKind.Video, ...MEDIA_FIELDS },
  { kind: MessageKind.Audio, voice: true, ...MEDIA_FIELDS },
  { kind: MessageKind.Document, ...MEDIA_FIELDS },
  { kind: MessageKind.Sticker, ...MEDIA_FIELDS },
  { kind: MessageKind.Location, latitude: -23.5, longitude: -46.6, name: 'Office', address: null },
  { kind: MessageKind.Contacts, contacts: [{ name: 'Maria', phones: ['+5511999990000'], emails: [], organization: null }] },
  { kind: MessageKind.Reaction, targetMessageId: 'msg_1', emoji: null },
  {
    kind: MessageKind.Choice,
    questionId: 'qst_1',
    options: [{ optionIndex: 0, title: 'Sim', description: null }],
    selected: { optionIndex: 0, title: 'Sim', description: null },
  },
];

describe('in-memory repository', () => {
  test('CU-159 every message kind round-trips', async () => {
    const environment = await createEnvironment();
    await Promise.all(
      CONTENTS.map(async (content, index) => {
        const message: Message = {
          messageId: `msg_${index + 1}`,
          direction: MessageDirection.ToOwner,
          agent: 'alpha',
          at: index,
          replyToMessageId: null,
          delivery: DeliveryState.Sent,
          readByAgent: true,
          ...content,
        };
        await environment.repository.insertMessage({ message });
        expect(await environment.repository.findMessage({ messageId: message.messageId })).toEqual(message);
      }),
    );
  });

  test('the notice can be claimed by exactly one of two concurrent callers', async () => {
    const environment = await createEnvironment();
    await environment.repository.saveWindow({
      window: { lastOwnerMessageAt: null, noticeSentForClosedWindow: false, noticeRetryLocale: null },
    });
    const claims = await Promise.all([environment.repository.claimNotice(), environment.repository.claimNotice()]);
    expect(claims.slice().sort()).toEqual([false, true]);
  });

  test('a fresh window can be claimed again', async () => {
    const environment = await createEnvironment();
    expect(await environment.repository.claimNotice()).toBe(true);
    await environment.repository.saveWindow({
      window: { lastOwnerMessageAt: 1, noticeSentForClosedWindow: false, noticeRetryLocale: null },
    });
    expect(await environment.repository.claimNotice()).toBe(true);
  });

  test('ids count per prefix', async () => {
    const environment = await createEnvironment();
    const { ids } = environment.dependencies;
    expect([
      ids.next({ prefix: IdPrefix.Message }),
      ids.next({ prefix: IdPrefix.Message }),
      ids.next({ prefix: IdPrefix.Question }),
    ]).toEqual(['msg_1', 'msg_2', 'qst_1']);
  });
});
