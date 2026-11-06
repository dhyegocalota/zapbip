import { DeliveryState, IdPrefix, MediaOrigin, MediaSourceKind, MessageDirection, MessageKind, ForwardedKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { SENDING_STALE_MS } from '../constants';
import type { Message, MessageContent } from '../message';
import { askAndAbandon, createEnvironment } from './fixtures';

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
          forwarded: ForwardedKind.None,
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
      window: {
        lastOwnerMessageAt: null,
        noticeSentForClosedWindow: false,
        closedAt: null,
        noticeRetryLocale: null,
        noticeRetryAt: null,
        noticeRetryAttempt: 0,
      },
    });
    const claims = await Promise.all([environment.repository.claimNotice(), environment.repository.claimNotice()]);
    expect(claims.slice().sort()).toEqual([false, true]);
  });

  test('a fresh window can be claimed again', async () => {
    const environment = await createEnvironment();
    expect(await environment.repository.claimNotice()).toBe(true);
    await environment.repository.saveWindow({
      window: {
        lastOwnerMessageAt: 1,
        noticeSentForClosedWindow: false,
        closedAt: null,
        noticeRetryLocale: null,
        noticeRetryAt: null,
        noticeRetryAttempt: 0,
      },
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

  describe('channel ports', () => {
    function messageOf(input: { messageId: string; at: number; delivery: DeliveryState | null; direction?: MessageDirection }): Message {
      const { messageId, at, delivery, direction = MessageDirection.ToOwner } = input;
      return {
        messageId,
        direction,
        agent: 'alpha',
        at,
        replyToMessageId: null,
        delivery,
        readByAgent: true,
        forwarded: ForwardedKind.None,
        kind: MessageKind.Text,
        text: messageId,
      };
    }

    const openedWindow = {
      lastOwnerMessageAt: 5,
      noticeSentForClosedWindow: false,
      closedAt: null,
      noticeRetryLocale: null,
      noticeRetryAt: null,
      noticeRetryAttempt: 0,
    };
    const storedMedia = {
      mediaId: 'med_1',
      origin: MediaOrigin.Owner,
      mimeType: 'image/jpeg',
      sizeBytes: 1,
      filename: null,
      expiresAt: null,
      receivedAt: 5,
      retentionUntil: 9,
    };

    test('commitChannelInbound writes the receipt, message, media and window once', async () => {
      const { repository } = await createEnvironment();
      const message = messageOf({ messageId: 'msg_1', at: 5, delivery: null, direction: MessageDirection.FromOwner });
      const commit = { channelMessageId: 'wamid.A', receivedAt: 5, message, answer: null, media: storedMedia, window: openedWindow };
      expect(await repository.commitChannelInbound(commit)).toBe(true);
      expect(await repository.commitChannelInbound({ ...commit, message: messageOf({ messageId: 'msg_2', at: 6, delivery: null }) })).toBe(
        false,
      );
      expect(await repository.findMessage({ messageId: 'msg_1' })).toEqual(message);
      expect(await repository.findMessage({ messageId: 'msg_2' })).toBeNull();
      expect(await repository.findMessageByChannelMessageId({ channelMessageId: 'wamid.A' })).toEqual(message);
      expect(await repository.findChannelMessageId({ messageId: 'msg_1' })).toBe('wamid.A');
      expect(await repository.findMedia({ mediaId: 'med_1' })).toEqual(storedMedia);
      expect(await repository.findWindow()).toEqual(openedWindow);
    });

    test('commitChannelInbound answers the question in the same call', async () => {
      const environment = await createEnvironment();
      const { repository } = environment;
      const question = await askAndAbandon({ environment });
      const answer = { optionIndex: null, text: 'sim', answerMessageId: 'msg_9', answeredAt: 5 };
      await repository.commitChannelInbound({
        channelMessageId: 'wamid.B',
        receivedAt: 5,
        message: null,
        answer: { questionId: question.questionId, answer },
        media: null,
        window: openedWindow,
      });
      expect(await repository.findQuestion({ questionId: question.questionId })).toMatchObject({ answer });
    });

    test('commitChannelInbound with no message still records the receipt and the window', async () => {
      const { repository } = await createEnvironment();
      const commit = { channelMessageId: 'wamid.C', receivedAt: 5, message: null, answer: null, media: null, window: openedWindow };
      expect(await repository.commitChannelInbound(commit)).toBe(true);
      expect(await repository.recordChannelReceipt({ wamid: 'wamid.C', receivedAt: 6 })).toBe(false);
    });

    test('the first channel message id of a message wins', async () => {
      const { repository } = await createEnvironment();
      await repository.insertMessage({ message: messageOf({ messageId: 'msg_1', at: 1, delivery: DeliveryState.Sent }) });
      await repository.saveChannelMessageId({ messageId: 'msg_1', channelMessageId: 'wamid.first' });
      await repository.saveChannelMessageId({ messageId: 'msg_1', channelMessageId: 'wamid.second' });
      expect(await repository.findChannelMessageId({ messageId: 'msg_1' })).toBe('wamid.first');
      expect(await repository.findMessageByChannelMessageId({ channelMessageId: 'wamid.second' })).toBeNull();
      expect(await repository.findChannelMessageId({ messageId: 'msg_missing' })).toBeNull();
    });

    test('saveChannelStatusDetail never writes null over a stored value', async () => {
      const { repository } = await createEnvironment();
      await repository.saveChannelStatusDetail({
        messageId: 'msg_1',
        detail: { errorCode: 131026, errorTitle: 'Undeliverable', pricingCategory: null, billable: null },
      });
      await repository.saveChannelStatusDetail({
        messageId: 'msg_1',
        detail: { errorCode: null, errorTitle: null, pricingCategory: 'service', billable: false },
      });
      expect(repository.findStatusDetail({ messageId: 'msg_1' })).toEqual({
        errorCode: 131026,
        errorTitle: 'Undeliverable',
        pricingCategory: 'service',
        billable: false,
      });
      expect(repository.findStatusDetail({ messageId: 'msg_none' })).toBeNull();
    });

    test('claimQueuedMessages claims the oldest queued messages up to the limit, once', async () => {
      const environment = await createEnvironment();
      const { repository } = environment;
      await Promise.all(
        ['msg_1', 'msg_2', 'msg_3'].map((messageId, at) =>
          repository.insertMessage({ message: messageOf({ messageId, at, delivery: DeliveryState.Queued }) }),
        ),
      );
      const claimed = await repository.claimQueuedMessages({ claimedAt: 77, limit: 2 });
      expect(claimed.map((message) => [message.messageId, message.delivery])).toEqual([
        ['msg_1', DeliveryState.Sending],
        ['msg_2', DeliveryState.Sending],
      ]);
      expect(repository.findClaimedAt({ messageId: 'msg_1' })).toBe(77);
      expect((await repository.claimQueuedMessages({ claimedAt: 78, limit: 2 })).map((message) => message.messageId)).toEqual(['msg_3']);
      expect(await repository.claimQueuedMessages({ claimedAt: 79, limit: 2 })).toEqual([]);
    });

    test('releaseStaleClaims requeues only claims older than the cut', async () => {
      const { repository } = await createEnvironment();
      await repository.insertMessage({ message: messageOf({ messageId: 'msg_1', at: 1, delivery: DeliveryState.Queued }) });
      await repository.claimQueuedMessages({ claimedAt: 100, limit: 1 });
      await repository.insertMessage({ message: messageOf({ messageId: 'msg_2', at: 2, delivery: DeliveryState.Queued }) });
      await repository.claimQueuedMessages({ claimedAt: 200, limit: 1 });
      await repository.releaseStaleClaims({ claimedBefore: 150 });
      expect(await repository.findMessage({ messageId: 'msg_1' })).toMatchObject({ delivery: DeliveryState.Queued });
      expect(await repository.findMessage({ messageId: 'msg_2' })).toMatchObject({ delivery: DeliveryState.Sending });
    });

    test('the next expiry counts the moment a claim goes stale', async () => {
      const { repository } = await createEnvironment();
      await repository.insertMessage({ message: messageOf({ messageId: 'msg_1', at: 1, delivery: DeliveryState.Queued }) });
      await repository.claimQueuedMessages({ claimedAt: 100, limit: 1 });
      expect(await repository.findNextExpiry()).toBe(100 + SENDING_STALE_MS);
    });
  });
});
