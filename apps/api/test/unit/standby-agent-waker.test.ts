import type { Message } from '@zapbip/core';
import { storedWakeOf } from '@zapbip/core/wake-testing';
import { AgentWakeReason, InboxErrorCode, MediaSourceKind, MessageDirection, MessageKind, WakeMode, WakeOutcome } from '@zapbip/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { createStandbyAgentWaker } from '../../src/adapters/wake/standby-agent-waker';
import {
  COPY_MESSAGE_ID,
  firstCallArgument,
  OWNER_MESSAGE_ID,
  PRIMARY,
  STANDBY,
  createHarness,
  ownerTextOf,
  type WakerHarness,
} from './waker-fixtures';

const SECRET_TEXT = 'segredo';
const MEDIA_ID = 'media_1';
const UNKNOWN_MESSAGE_ID = 'zz9';

let harness: WakerHarness;

function handOff(input: { messageId?: string }) {
  return createStandbyAgentWaker(harness).notify({ agent: PRIMARY, reason: AgentWakeReason.MessageWaiting, messageId: input.messageId });
}

beforeEach(async () => {
  harness = createHarness();
  await harness.wake.repository.saveWake({ wake: storedWakeOf({ agent: PRIMARY, mode: WakeMode.Standby, standbyAgent: STANDBY }) });
});

describe('standby agent waker', () => {
  it('writes a copy with its own id that points at the owner message', async () => {
    await handOff({ messageId: OWNER_MESSAGE_ID });
    expect(harness.insertHandoff).toHaveBeenCalledTimes(1);
    const call = firstCallArgument({ mock: harness.insertHandoff });
    expect(call).toMatchObject({ primaryAgent: PRIMARY, handedTo: STANDBY });
    expect(call.copy).toMatchObject({
      messageId: COPY_MESSAGE_ID,
      originMessageId: OWNER_MESSAGE_ID,
      agent: STANDBY,
      readByAgent: false,
      handedTo: null,
      kind: MessageKind.Text,
    });
    expect(call.copy.messageId).not.toBe(OWNER_MESSAGE_ID);
  });

  it('wakes only the standby, with the standby reason and no pointer, and returns its outcome', async () => {
    harness.standbyNotify.mockResolvedValue(WakeOutcome.Unreached);
    expect(await handOff({ messageId: OWNER_MESSAGE_ID })).toBe(WakeOutcome.Unreached);
    expect(harness.standbyNotify.mock.calls).toEqual([[{ agent: STANDBY, reason: AgentWakeReason.StandbyFor }]]);
  });

  it('carries no message content in the wake', async () => {
    harness.findMessage.mockResolvedValue(ownerTextOf({ text: SECRET_TEXT }));
    await handOff({ messageId: OWNER_MESSAGE_ID });
    expect(JSON.stringify(harness.standbyNotify.mock.calls)).not.toContain(SECRET_TEXT);
  });

  it('writes the copy without waking the standby again while it holds unread messages', async () => {
    harness.countUnread.mockResolvedValue(1);
    expect(await handOff({ messageId: OWNER_MESSAGE_ID })).toBe(WakeOutcome.Woken);
    expect(harness.insertHandoff).toHaveBeenCalledTimes(1);
    expect(harness.standbyNotify).not.toHaveBeenCalled();
  });

  it('reads the standby unread count before the copy is written', async () => {
    await handOff({ messageId: OWNER_MESSAGE_ID });
    expect(harness.countUnread.mock.invocationCallOrder.at(0)).toBeLessThan(harness.insertHandoff.mock.invocationCallOrder.at(0) as number);
  });

  it('makes no copy and wakes nobody without a message id', async () => {
    expect(await handOff({})).toBe(WakeOutcome.Unreached);
    expect(harness.insertHandoff).not.toHaveBeenCalled();
    expect(harness.standbyNotify).not.toHaveBeenCalled();
  });

  it('makes no copy when the primary has no standby name', async () => {
    await harness.wake.repository.saveWake({ wake: storedWakeOf({ agent: PRIMARY, mode: WakeMode.None }) });
    expect(await handOff({ messageId: OWNER_MESSAGE_ID })).toBe(WakeOutcome.Unreached);
    expect(harness.insertHandoff).not.toHaveBeenCalled();
  });

  it('throws not found and makes no copy for an unknown message', async () => {
    harness.findMessage.mockResolvedValue(null);
    await expect(handOff({ messageId: UNKNOWN_MESSAGE_ID })).rejects.toMatchObject({ code: InboxErrorCode.NotFound });
    expect(harness.insertHandoff).not.toHaveBeenCalled();
    expect(harness.standbyNotify).not.toHaveBeenCalled();
  });

  const ownerEnvelope = {
    messageId: OWNER_MESSAGE_ID,
    direction: MessageDirection.FromOwner,
    agent: PRIMARY,
    at: 1,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    handedTo: null,
    originMessageId: null,
  } as const;
  const media = {
    source: { kind: MediaSourceKind.Stored, mediaId: MEDIA_ID } as const,
    mimeType: 'image/png',
    sizeBytes: 3,
    filename: null,
    caption: null,
  };
  const contents: Record<string, Message> = {
    text: { ...ownerEnvelope, kind: MessageKind.Text, text: 'oi' },
    location: { ...ownerEnvelope, kind: MessageKind.Location, latitude: 1, longitude: 2, name: null, address: null },
    contacts: {
      ...ownerEnvelope,
      kind: MessageKind.Contacts,
      contacts: [{ name: 'Maria', phones: ['1'], emails: [], organization: null }],
    },
    reaction: { ...ownerEnvelope, kind: MessageKind.Reaction, targetMessageId: 'x1', emoji: '👍' },
    choice: {
      ...ownerEnvelope,
      kind: MessageKind.Choice,
      questionId: 'q1',
      options: [{ optionIndex: 0, title: 'Sim', description: null }],
      selected: null,
    },
    image: { ...ownerEnvelope, kind: MessageKind.Image, ...media },
    document: { ...ownerEnvelope, kind: MessageKind.Document, ...media },
  };

  it.each(Object.entries(contents))('hands a %s message off with its content and a new id', async (_name, message) => {
    harness.findMessage.mockResolvedValue(message);
    await handOff({ messageId: OWNER_MESSAGE_ID });
    const call = firstCallArgument({ mock: harness.insertHandoff });
    expect(call.copy).toMatchObject({ ...message, messageId: COPY_MESSAGE_ID, originMessageId: OWNER_MESSAGE_ID, agent: STANDBY });
  });
});
