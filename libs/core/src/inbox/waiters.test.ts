import { describe, expect, test } from 'vitest';
import { createFakeClock } from './testing/fake-clock';
import { createReplyWaiters } from './waiters';

function createWaiters() {
  const clock = createFakeClock({ startAt: 0 });
  return { clock, waiters: createReplyWaiters({ clock }) };
}

describe('createReplyWaiters', () => {
  test('CU-84 an agent message wakes the waiter before the timeout', async () => {
    const { clock, waiters } = createWaiters();
    let resolvedAt: number | null = null;
    const waiting = waiters.awaitAgentMessage({ agent: 'alpha', timeoutMs: 5000 }).then(() => {
      resolvedAt = clock.now();
    });
    await clock.advance({ ms: 1000 });
    waiters.resolveAgentMessage({ agent: 'alpha' });
    await waiting;
    expect(resolvedAt).toBe(1000);
  });

  test('CU-85 the timeout resolves and removes the waiter', async () => {
    const { clock, waiters } = createWaiters();
    const waiting = waiters.awaitAgentMessage({ agent: 'alpha', timeoutMs: 5000 });
    await clock.advance({ ms: 5000 });
    await waiting;
    expect(waiters.hasLiveWaiter({ agent: 'alpha' })).toBe(false);
  });

  test('CU-86 a pending question is a live waiter until resolved', async () => {
    const { waiters } = createWaiters();
    const waiting = waiters.awaitQuestionAnswer({ agent: 'alpha', questionId: 'qst_1', timeoutMs: 5000 });
    expect(waiters.hasLiveWaiter({ agent: 'alpha' })).toBe(true);
    waiters.resolveQuestionAnswer({ questionId: 'qst_1' });
    await waiting;
    expect(waiters.hasLiveWaiter({ agent: 'alpha' })).toBe(false);
  });

  test('CU-87 resolving a question nobody awaits does nothing', () => {
    const { waiters } = createWaiters();
    expect(() => waiters.resolveQuestionAnswer({ questionId: 'qst_9' })).not.toThrow();
  });

  test('CU-88 two waiters on one agent both resolve', async () => {
    const { waiters } = createWaiters();
    const first = waiters.awaitAgentMessage({ agent: 'alpha', timeoutMs: 5000 });
    const second = waiters.awaitAgentMessage({ agent: 'alpha', timeoutMs: 5000 });
    waiters.resolveAgentMessage({ agent: 'alpha' });
    await Promise.all([first, second]);
    expect(waiters.hasLiveWaiter({ agent: 'alpha' })).toBe(false);
  });

  test('an agent message leaves a question waiter pending', async () => {
    const { waiters } = createWaiters();
    const waiting = waiters.awaitQuestionAnswer({ agent: 'alpha', questionId: 'qst_1', timeoutMs: 5000 });
    waiters.resolveAgentMessage({ agent: 'alpha' });
    expect(waiters.hasLiveWaiter({ agent: 'alpha' })).toBe(true);
    waiters.resolveQuestionAnswer({ questionId: 'qst_1' });
    await waiting;
  });

  test('another agent message does not wake the waiter', () => {
    const { waiters } = createWaiters();
    void waiters.awaitAgentMessage({ agent: 'alpha', timeoutMs: 5000 });
    waiters.resolveAgentMessage({ agent: 'beta' });
    expect(waiters.hasLiveWaiter({ agent: 'alpha' })).toBe(true);
  });
});
