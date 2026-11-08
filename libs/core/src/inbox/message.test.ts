import { MessageDirection, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { ownerMessageIdOf, type Message } from './message';

function messageOf(input: { messageId: string; originMessageId: string | null }): Message {
  return {
    ...input,
    direction: MessageDirection.FromOwner,
    agent: 'agent-eight',
    at: 0,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    forwarded: false,
    handedTo: null,
    kind: MessageKind.Text,
    text: 'hi',
  };
}

describe('ownerMessageIdOf', () => {
  test('a primary row is its own owner message', () => {
    expect(ownerMessageIdOf({ message: messageOf({ messageId: 'm1', originMessageId: null }) })).toBe('m1');
  });

  test('a handoff copy points at the owner message it copies', () => {
    expect(ownerMessageIdOf({ message: messageOf({ messageId: 'c1', originMessageId: 'm1' }) })).toBe('m1');
  });
});
