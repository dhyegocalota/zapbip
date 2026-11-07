import type { Message } from '@zapbip/core';
import { ConnectorLogEvent, SEEN_MESSAGE_LIMIT } from '@zapbip/types';
import { describe, expect, it, vi } from 'vitest';
import { createHandoffQueue } from '../../src/handoff-queue';
import { ownerTextMessage } from '../support/fake-connector';

function messageNumbered(input: { index: number }): Message {
  return ownerTextMessage({ messageId: `msg_${input.index}`, text: 'hello' });
}

describe('handoff queue', () => {
  it('logs a handoff failure without the owner text and sends no done', async () => {
    const handOff = vi.fn(() => Promise.reject(new Error('boom')));
    const sendDone = vi.fn();
    const log = vi.fn();
    const queue = createHandoffQueue({ handOff, sendDone, log });
    queue.enqueue({ message: messageNumbered({ index: 1 }) });
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(1));
    expect(log).toHaveBeenCalledWith({ event: ConnectorLogEvent.PluginHandoffFailed, fields: { messageId: 'msg_1' } });
    expect(sendDone).not.toHaveBeenCalled();
  });

  it('forgets the oldest acknowledged message once the shared limit is passed', async () => {
    const handOff = vi.fn(() => Promise.resolve());
    const sendDone = vi.fn();
    const queue = createHandoffQueue({ handOff, sendDone, log: vi.fn() });
    const indexes = Array.from({ length: SEEN_MESSAGE_LIMIT + 1 }, (_value, index) => index);
    indexes.forEach((index) => queue.enqueue({ message: messageNumbered({ index }) }));
    await vi.waitFor(() => expect(sendDone).toHaveBeenCalledTimes(SEEN_MESSAGE_LIMIT + 1));
    queue.enqueue({ message: messageNumbered({ index: 0 }) });
    await vi.waitFor(() => expect(handOff).toHaveBeenCalledTimes(SEEN_MESSAGE_LIMIT + 2));
  });
});
