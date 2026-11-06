import { describe, expect, test } from 'vitest';
import { createSerializer } from './serialize';

describe('createSerializer', () => {
  test('tasks on one key run one after the other even when the first is slow', async () => {
    const serialize = createSerializer();
    const key = {};
    const order: string[] = [];
    const slow = serialize({
      key,
      task: async () => {
        await Promise.resolve();
        await Promise.resolve();
        order.push('slow');
      },
    });
    const fast = serialize({ key, task: async () => order.push('fast') });
    await Promise.all([slow, fast]);
    expect(order).toEqual(['slow', 'fast']);
  });

  test('a failed task rejects its caller and lets the next one run', async () => {
    const serialize = createSerializer();
    const key = {};
    const failing = serialize({ key, task: () => Promise.reject(new Error('boom')) });
    const next = serialize({ key, task: async () => 'ok' });
    await expect(failing).rejects.toThrow('boom');
    expect(await next).toBe('ok');
  });
});
