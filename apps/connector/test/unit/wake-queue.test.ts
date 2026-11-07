import type { Message } from '@zapbip/core';
import { ForwardedKind, MessageDirection, MessageKind } from '@zapbip/types';
import { describe, expect, test, vi } from 'vitest';
import { createWakeQueue } from '../../src/wake-queue';

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void };

function createDeferred(): Deferred {
  let resolve: () => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function ownerMessage(input: { messageId: string }): Message {
  return {
    messageId: input.messageId,
    direction: MessageDirection.FromOwner,
    agent: 'build-bot',
    at: 1_000,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    forwarded: ForwardedKind.None,
    handedTo: null,
    originMessageId: null,
    kind: MessageKind.Text,
    text: 'oi',
  };
}

function createHarness() {
  const startedIds: string[] = [];
  const finishedIds: string[] = [];
  const doneIds: string[] = [];
  const wakes = new Map<string, Deferred>();
  let runningCount = 0;
  let maximumRunningCount = 0;

  async function runWake(input: { message: Message }): Promise<void> {
    const wake = createDeferred();
    wakes.set(input.message.messageId, wake);
    startedIds.push(input.message.messageId);
    runningCount += 1;
    maximumRunningCount = Math.max(maximumRunningCount, runningCount);
    try {
      await wake.promise;
    } finally {
      runningCount -= 1;
    }
    finishedIds.push(input.message.messageId);
  }

  const queue = createWakeQueue({ runWake, sendDone: (input) => doneIds.push(input.messageId) });

  return {
    queue,
    startedIds,
    finishedIds,
    doneIds,
    wakes,
    maximumRunningCount: () => maximumRunningCount,
    enqueue: (input: { messageId: string }) => queue.enqueue({ message: ownerMessage(input) }),
    finish: async (input: { messageId: string }) => {
      await vi.waitFor(() => expect(wakes.has(input.messageId)).toBe(true));
      wakes.get(input.messageId)?.resolve();
    },
    fail: async (input: { messageId: string }) => {
      await vi.waitFor(() => expect(wakes.has(input.messageId)).toBe(true));
      wakes.get(input.messageId)?.reject(new Error('wake failed'));
    },
  };
}

describe('createWakeQueue', () => {
  test('sends done only after the wake has ended', async () => {
    const harness = createHarness();
    harness.enqueue({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.startedIds).toEqual(['msg_1']));
    expect(harness.doneIds).toEqual([]);
    await harness.finish({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.doneIds).toEqual(['msg_1']));
  });

  test('runs three messages one at a time in arrival order', async () => {
    const harness = createHarness();
    ['msg_1', 'msg_2', 'msg_3'].forEach((messageId) => harness.enqueue({ messageId }));
    await vi.waitFor(() => expect(harness.startedIds).toEqual(['msg_1']));
    await harness.finish({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.startedIds).toEqual(['msg_1', 'msg_2']));
    await harness.finish({ messageId: 'msg_2' });
    await vi.waitFor(() => expect(harness.startedIds).toEqual(['msg_1', 'msg_2', 'msg_3']));
    await harness.finish({ messageId: 'msg_3' });
    await vi.waitFor(() => expect(harness.doneIds).toEqual(['msg_1', 'msg_2', 'msg_3']));
    expect(harness.maximumRunningCount()).toBe(1);
  });

  test('after stop the running wake finishes and no queued message starts', async () => {
    const harness = createHarness();
    ['msg_1', 'msg_2'].forEach((messageId) => harness.enqueue({ messageId }));
    await vi.waitFor(() => expect(harness.startedIds).toEqual(['msg_1']));
    harness.queue.stop();
    await harness.finish({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.finishedIds).toEqual(['msg_1']));
    expect(harness.startedIds).toEqual(['msg_1']);
  });

  test('wakes a message queued twice once', async () => {
    const harness = createHarness();
    harness.enqueue({ messageId: 'msg_1' });
    harness.enqueue({ messageId: 'msg_1' });
    await harness.finish({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.doneIds).toEqual(['msg_1']));
    expect(harness.startedIds).toEqual(['msg_1']);
  });

  test('wakes a message re-sent while its wake is running once and sends its done once', async () => {
    const harness = createHarness();
    harness.enqueue({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.startedIds).toEqual(['msg_1']));
    harness.enqueue({ messageId: 'msg_1' });
    await harness.finish({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.doneIds).toEqual(['msg_1']));
    expect(harness.startedIds).toEqual(['msg_1']);
  });

  test('answers a message re-sent after its wake ended with done and no wake', async () => {
    const harness = createHarness();
    harness.enqueue({ messageId: 'msg_1' });
    await harness.finish({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.doneIds).toEqual(['msg_1']));
    harness.enqueue({ messageId: 'msg_1' });
    expect(harness.doneIds).toEqual(['msg_1', 'msg_1']);
    expect(harness.startedIds).toEqual(['msg_1']);
  });

  test('runs the next message after a wake that rejected, without done for the failed one', async () => {
    const harness = createHarness();
    harness.enqueue({ messageId: 'msg_1' });
    harness.enqueue({ messageId: 'msg_2' });
    await harness.fail({ messageId: 'msg_1' });
    await harness.finish({ messageId: 'msg_2' });
    await vi.waitFor(() => expect(harness.doneIds).toEqual(['msg_2']));
    expect(harness.startedIds).toEqual(['msg_1', 'msg_2']);
  });

  test('wakes a message again when its earlier wake rejected', async () => {
    const harness = createHarness();
    harness.enqueue({ messageId: 'msg_1' });
    await harness.fail({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.finishedIds).toEqual([]));
    harness.enqueue({ messageId: 'msg_1' });
    await vi.waitFor(() => expect(harness.startedIds).toEqual(['msg_1', 'msg_1']));
  });
});
