import { ChannelErrorKind, ChannelInboundKind, MediaOrigin, MediaSourceKind, MessageKind, OwnerLocale, WakeOutcome } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { formatRouteOptionId } from '../option-id';
import { InboxError } from '../errors';
import { channelError, insertQueued, ownerTextEntry, receiveChannel } from '../testing/channel-fixtures';
import { askAndAbandon, closeWindow, connectionOf, createEnvironment, registerAgents } from '../testing/fixtures';
import { sendText } from './send-text';
import type { ChannelInboundEntry } from './types';

const WAMID = 'wamid.A';

async function environmentWithAlpha() {
  const environment = await createEnvironment();
  await registerAgents({ environment, agents: ['alpha'] });
  return environment;
}

describe('receiveChannelMessage', () => {
  test('CU-16 stores the receipt, the unread message and the opened window', async () => {
    const environment = await environmentWithAlpha();
    const at = environment.clock.now();
    const result = await receiveChannel({
      environment,
      channelMessageId: WAMID,
      entry: ownerTextEntry({ environment, text: '@alpha oi' }),
    });
    expect(result).toMatchObject({ agent: 'alpha', duplicate: false });
    expect(await environment.repository.recordChannelReceipt({ wamid: WAMID, receivedAt: at })).toBe(false);
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({
      agent: 'alpha',
      readByAgent: false,
      text: 'oi',
    });
    expect(await environment.repository.findMessageByChannelMessageId({ channelMessageId: WAMID })).toMatchObject({
      messageId: result.messageId,
    });
    expect((await environment.repository.findWindow()).lastOwnerMessageAt).toBe(at);
  });

  test('CU-17 a repeated wamid stores nothing, resolves no waiter and wakes nobody', async () => {
    const environment = await environmentWithAlpha();
    const entry = ownerTextEntry({ environment, text: '@alpha oi' });
    const first = await receiveChannel({ environment, channelMessageId: WAMID, entry });
    const notificationsBefore = environment.waker.notifications.length;
    const sessionsBefore = environment.sender.sessions.length;
    const second = await receiveChannel({ environment, channelMessageId: WAMID, entry });
    expect(second).toEqual({ messageId: first.messageId, agent: 'alpha', duplicate: true });
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(1);
    expect(environment.waker.notifications).toHaveLength(notificationsBefore);
    expect(environment.sender.sessions).toHaveLength(sessionsBefore);
  });

  test('CU-18a a commit that throws leaves no receipt and the retry stores once', async () => {
    const environment = await environmentWithAlpha();
    const entry = ownerTextEntry({ environment, text: '@alpha oi' });
    const failing = {
      ...environment.dependencies,
      repository: {
        ...environment.repository,
        commitChannelInbound: async () => {
          throw new Error('commit failed');
        },
      },
    };
    await expect(receiveChannel({ environment, channelMessageId: WAMID, entry, dependencies: failing })).rejects.toThrow('commit failed');
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(0);
    const retry = await receiveChannel({ environment, channelMessageId: WAMID, entry });
    expect(retry.duplicate).toBe(false);
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(1);
  });

  test('CU-18b a wake that throws after the commit keeps the message and the retry is a duplicate', async () => {
    const environment = await environmentWithAlpha();
    const entry = ownerTextEntry({ environment, text: '@alpha oi' });
    let wakeCalls = 0;
    const failing = {
      ...environment.dependencies,
      waker: {
        notify: async () => {
          wakeCalls += 1;
          throw new Error('wake failed');
        },
      },
    };
    await expect(receiveChannel({ environment, channelMessageId: WAMID, entry, dependencies: failing })).rejects.toThrow('wake failed');
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(1);
    const retry = await receiveChannel({ environment, channelMessageId: WAMID, entry });
    expect(retry.duplicate).toBe(true);
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(1);
    expect(wakeCalls).toBe(1);
  });

  test('CU-19 a window-only entry opens the window, flushes the queue and stores no message', async () => {
    const environment = await environmentWithAlpha();
    await closeWindow({ environment });
    await insertQueued({ environment, texts: ['held'] });
    const at = environment.clock.now();
    const result = await receiveChannel({ environment, entry: { kind: ChannelInboundKind.WindowOnly, at } });
    expect(result).toEqual({ messageId: null, agent: null, duplicate: false });
    expect((await environment.repository.findWindow()).lastOwnerMessageAt).toBe(at);
    expect(environment.sender.sessions).toMatchObject([{ text: 'held' }]);
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(0);
    expect(await environment.repository.listHeld()).toEqual([]);
  });

  test('a repeated entry that stored no message is a duplicate with no ids', async () => {
    const environment = await environmentWithAlpha();
    const entry: ChannelInboundEntry = { kind: ChannelInboundKind.WindowOnly, at: environment.clock.now() };
    await receiveChannel({ environment, channelMessageId: WAMID, entry });
    expect(await receiveChannel({ environment, channelMessageId: WAMID, entry })).toEqual({
      messageId: null,
      agent: null,
      duplicate: true,
    });
  });

  test('a repeated window-only entry is a duplicate', async () => {
    const environment = await environmentWithAlpha();
    const entry: ChannelInboundEntry = { kind: ChannelInboundKind.WindowOnly, at: environment.clock.now() };
    await receiveChannel({ environment, channelMessageId: WAMID, entry });
    expect((await receiveChannel({ environment, channelMessageId: WAMID, entry })).duplicate).toBe(true);
  });

  test('CU-20 an unsupported entry opens the window and sends the notice text once', async () => {
    const environment = await environmentWithAlpha();
    await closeWindow({ environment });
    const entry: ChannelInboundEntry = {
      kind: ChannelInboundKind.Unsupported,
      at: environment.clock.now(),
      noticeText: 'Cannot read this',
    };
    const result = await receiveChannel({ environment, entry });
    expect(result).toEqual({ messageId: null, agent: null, duplicate: false });
    expect((await environment.repository.findWindow()).lastOwnerMessageAt).toBe(environment.clock.now());
    expect(environment.sender.sessions).toMatchObject([{ kind: MessageKind.Text, text: 'Cannot read this', agent: null }]);
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(0);
  });

  test('CU-21 a reply to an agent message stores the core message id as its target', async () => {
    const environment = await environmentWithAlpha();
    const sent = await sendText({
      dependencies: environment.dependencies,
      connection: connectionOf({ agent: 'alpha' }),
      text: 'q',
      replyToMessageId: null,
    });
    const channelMessageId = await environment.repository.findChannelMessageId({ messageId: sent.messageId });
    const entry = ownerTextEntry({ environment, text: 'answer', replyToChannelMessageId: channelMessageId });
    const result = await receiveChannel({ environment, entry });
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({
      replyToMessageId: sent.messageId,
      agent: 'alpha',
    });
  });

  test('CU-22 a reply target nobody has is stored as no target', async () => {
    const environment = await environmentWithAlpha();
    const entry = ownerTextEntry({ environment, text: '@alpha oi', replyToChannelMessageId: 'wamid.unknown' });
    const result = await receiveChannel({ environment, entry });
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({ replyToMessageId: null });
  });

  test('CU-23 media that could not be stored is kept as unavailable and the owner is told once', async () => {
    const environment = await environmentWithAlpha();
    environment.waker.replyWith({ outcome: WakeOutcome.Woken });
    await sendText({
      dependencies: environment.dependencies,
      connection: connectionOf({ agent: 'alpha' }),
      text: 'q',
      replyToMessageId: null,
    });
    const entry: ChannelInboundEntry = {
      kind: ChannelInboundKind.Owner,
      at: environment.clock.now(),
      content: { kind: MessageKind.Image, voice: false, filename: null, caption: '@alpha look' },
      replyToChannelMessageId: null,
      noticeText: 'Y',
    };
    const result = await receiveChannel({ environment, entry });
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({
      kind: MessageKind.Image,
      source: { kind: MediaSourceKind.Unavailable },
      mimeType: null,
      sizeBytes: null,
      readByAgent: false,
    });
    expect(environment.sender.sessions.slice(1)).toMatchObject([{ kind: MessageKind.Text, text: 'Y', agent: null }]);
  });

  test('stored media is recorded with the message', async () => {
    const environment = await environmentWithAlpha();
    const entry: ChannelInboundEntry = {
      kind: ChannelInboundKind.Owner,
      at: environment.clock.now(),
      content: {
        kind: MessageKind.Image,
        voice: false,
        mediaId: 'med_abc',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        filename: null,
        caption: null,
      },
      replyToChannelMessageId: null,
      noticeText: null,
    };
    const result = await receiveChannel({ environment, entry });
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({
      source: { kind: MediaSourceKind.Stored, mediaId: 'med_abc' },
    });
    expect(await environment.repository.findMedia({ mediaId: 'med_abc' })).toMatchObject({
      origin: MediaOrigin.Owner,
      mimeType: 'image/jpeg',
      sizeBytes: 10,
    });
  });

  test('a text that answers an open question answers it in the same commit', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const result = await receiveChannel({ environment, entry: ownerTextEntry({ environment, text: 'Sim' }) });
    expect((await environment.repository.findQuestion({ questionId: question.questionId }))?.answer).toMatchObject({
      text: 'Sim',
      answerMessageId: result.messageId,
    });
  });

  test('a reaction does not open the window or flush the queue', async () => {
    const environment = await environmentWithAlpha();
    await closeWindow({ environment });
    await insertQueued({ environment, texts: ['held'] });
    const windowBefore = await environment.repository.findWindow();
    const entry: ChannelInboundEntry = {
      kind: ChannelInboundKind.Owner,
      at: environment.clock.now(),
      content: { kind: MessageKind.Reaction, targetMessageId: 'wamid.unknown', emoji: '👍' },
      replyToChannelMessageId: null,
      noticeText: null,
    };
    await receiveChannel({ environment, entry });
    expect(await environment.repository.findWindow()).toEqual(windowBefore);
    expect(environment.sender.sessionRequests).toEqual([]);
  });

  test('a tap on a route option assigns the held messages and wakes the agent', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    const held = await receiveChannel({ environment, entry: ownerTextEntry({ environment, text: 'who?' }) });
    expect(held.agent).toBeNull();
    const tap: ChannelInboundEntry = {
      kind: ChannelInboundKind.Owner,
      at: environment.clock.now(),
      content: {
        kind: MessageKind.Choice,
        optionId: formatRouteOptionId({ messageId: held.messageId!, agent: 'beta' }),
        optionTitle: 'beta',
        optionDescription: null,
      },
      replyToChannelMessageId: null,
      noticeText: null,
    };
    const result = await receiveChannel({ environment, entry: tap });
    expect(result).toEqual({ messageId: null, agent: 'beta', duplicate: false });
    expect(await environment.repository.findMessage({ messageId: held.messageId! })).toMatchObject({ agent: 'beta' });
    expect(environment.waker.notifications).toMatchObject([{ agent: 'beta' }]);
  });

  test('CU-44 reply and reaction targets are resolved from channel ids', async () => {
    const environment = await environmentWithAlpha();
    const first = await receiveChannel({
      environment,
      channelMessageId: 'wamid.X',
      entry: ownerTextEntry({ environment, text: '@alpha one' }),
    });
    const known = await receiveChannel({
      environment,
      entry: ownerTextEntry({ environment, text: 'two', replyToChannelMessageId: 'wamid.X' }),
    });
    const unknown = await receiveChannel({
      environment,
      entry: ownerTextEntry({ environment, text: '@alpha three', replyToChannelMessageId: 'wamid.none' }),
    });
    expect(await environment.repository.findMessage({ messageId: known.messageId! })).toMatchObject({ replyToMessageId: first.messageId });
    expect(await environment.repository.findMessage({ messageId: unknown.messageId! })).toMatchObject({ replyToMessageId: null });
    const reactionOn = (targetMessageId: string): ChannelInboundEntry => ({
      kind: ChannelInboundKind.Owner,
      at: environment.clock.now(),
      content: { kind: MessageKind.Reaction, targetMessageId, emoji: '👍' },
      replyToChannelMessageId: null,
      noticeText: null,
    });
    const onKnown = await receiveChannel({ environment, entry: reactionOn('wamid.X') });
    const onUnknown = await receiveChannel({ environment, entry: reactionOn('wamid.none') });
    expect(await environment.repository.findMessage({ messageId: onKnown.messageId! })).toMatchObject({
      targetMessageId: first.messageId,
      agent: 'alpha',
    });
    expect(await environment.repository.findMessage({ messageId: onUnknown.messageId! })).toMatchObject({ targetMessageId: 'wamid.none' });
  });

  test('a voice flag on a non-audio media entry is refused before anything is stored', async () => {
    const environment = await environmentWithAlpha();
    const entry: ChannelInboundEntry = {
      kind: ChannelInboundKind.Owner,
      at: environment.clock.now(),
      content: { kind: MessageKind.Image, voice: true, filename: null, caption: null },
      replyToChannelMessageId: null,
      noticeText: null,
    };
    await expect(receiveChannel({ environment, channelMessageId: WAMID, entry })).rejects.toBeInstanceOf(InboxError);
    expect(await environment.repository.recordChannelReceipt({ wamid: WAMID, receivedAt: 0 })).toBe(true);
  });

  test('the owner locale reaches the closed-window notice of the flush', async () => {
    const environment = await environmentWithAlpha();
    await closeWindow({ environment });
    await insertQueued({ environment, texts: ['held'] });
    environment.sender.failSessionCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.WindowClosed, errorCode: 131047 }),
    });
    const entry: ChannelInboundEntry = { kind: ChannelInboundKind.WindowOnly, at: environment.clock.now() };
    await receiveChannel({ environment, entry, ownerLocale: OwnerLocale.PortugueseBrazil });
    expect(environment.sender.templates).toMatchObject([{ locale: OwnerLocale.PortugueseBrazil }]);
  });
});
