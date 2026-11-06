import { WakeMode, WakeRung, WakeStatus } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { attachLocalConnector, detachLocalConnector } from './local-connector';
import type { StoredWake } from './wake-setting';
import { addUnreadOwnerMessage, createWakeEnvironment, setWebhook, type WakeEnvironment } from './testing/wake-fixtures';
import { wakeRungFor } from './wake-rung';

const AGENT = 'ana';
const LIMIT = 50;

function noneWake(): StoredWake {
  return { agent: AGENT, mode: WakeMode.None, target: null, status: WakeStatus.Active, lastDeliveredAt: null };
}

async function saveNoneWake(input: { wakeEnvironment: WakeEnvironment }): Promise<StoredWake> {
  const stored = noneWake();
  await input.wakeEnvironment.wake.repository.saveWake({ wake: stored });
  return stored;
}

function attach(input: { wakeEnvironment: WakeEnvironment; limit?: number }) {
  const { wakeEnvironment, limit = LIMIT } = input;
  return attachLocalConnector({ ...wakeEnvironment.context, agent: AGENT, limit });
}

function detach(input: { wakeEnvironment: WakeEnvironment; remainingSockets: number }) {
  const { wakeEnvironment, remainingSockets } = input;
  return detachLocalConnector({ ...wakeEnvironment.context, agent: AGENT, remainingSockets });
}

describe('attachLocalConnector', () => {
  test('saves the local mode and returns the previous mode with the unread messages', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await saveNoneWake({ wakeEnvironment });
    await addUnreadOwnerMessage({ wakeEnvironment, agent: AGENT });
    await addUnreadOwnerMessage({ wakeEnvironment, agent: AGENT });
    const result = await attach({ wakeEnvironment });
    const stored = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    expect(result.previousWakeMode).toBe(WakeMode.None);
    expect(result.unread.map((message) => message.messageId)).toEqual(['msg_1', 'msg_2']);
    expect(stored?.mode).toBe(WakeMode.Local);
  });

  test('respects the limit', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await saveNoneWake({ wakeEnvironment });
    await Promise.all([1, 2, 3].map(() => addUnreadOwnerMessage({ wakeEnvironment, agent: AGENT })));
    const result = await attach({ wakeEnvironment, limit: 2 });
    expect(result.unread).toHaveLength(2);
  });

  test('a limit of zero returns nothing and still saves the local mode', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await saveNoneWake({ wakeEnvironment });
    await addUnreadOwnerMessage({ wakeEnvironment, agent: AGENT });
    const result = await attach({ wakeEnvironment, limit: 0 });
    const stored = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    expect(result.unread).toEqual([]);
    expect(stored?.mode).toBe(WakeMode.Local);
  });

  test('remembers the previous record once and returns the local mode on re-attach', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const previous = await saveNoneWake({ wakeEnvironment });
    await attach({ wakeEnvironment });
    const second = await attach({ wakeEnvironment });
    const restore = await wakeEnvironment.wake.repository.findLocalRestore({ agent: AGENT });
    expect(second.previousWakeMode).toBe(WakeMode.Local);
    expect(restore).toEqual(previous);
  });

  test('keeps the webhook target of the previous record', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: AGENT });
    const previous = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    await attach({ wakeEnvironment });
    const stored = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    const restore = await wakeEnvironment.wake.repository.findLocalRestore({ agent: AGENT });
    expect(restore).toEqual(previous);
    expect(stored).toEqual({ ...previous, mode: WakeMode.Local });
  });

  test('rejects an agent with no stored wake and saves nothing', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await expect(attach({ wakeEnvironment })).rejects.toThrow('no wake setting for ana');
    expect(await wakeEnvironment.wake.repository.findWake({ agent: AGENT })).toBeNull();
    expect(await wakeEnvironment.wake.repository.findLocalRestore({ agent: AGENT })).toBeNull();
  });
});

describe('detachLocalConnector', () => {
  test('keeps everything while sockets remain', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await saveNoneWake({ wakeEnvironment });
    await attach({ wakeEnvironment });
    await detach({ wakeEnvironment, remainingSockets: 1 });
    const stored = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    expect(stored?.mode).toBe(WakeMode.Local);
    expect(await wakeEnvironment.wake.repository.findLocalRestore({ agent: AGENT })).not.toBeNull();
  });

  test('restores the previous record and clears the restore on the last close', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: AGENT });
    const previous = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    await attach({ wakeEnvironment });
    await detach({ wakeEnvironment, remainingSockets: 0 });
    expect(await wakeEnvironment.wake.repository.findWake({ agent: AGENT })).toEqual(previous);
    expect(await wakeEnvironment.wake.repository.findLocalRestore({ agent: AGENT })).toBeNull();
  });

  test('keeps a change the user made while attached and clears the restore', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await saveNoneWake({ wakeEnvironment });
    await attach({ wakeEnvironment });
    await setWebhook({ wakeEnvironment, agent: AGENT });
    const changed = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    await detach({ wakeEnvironment, remainingSockets: 0 });
    expect(await wakeEnvironment.wake.repository.findWake({ agent: AGENT })).toEqual(changed);
    expect(await wakeEnvironment.wake.repository.findLocalRestore({ agent: AGENT })).toBeNull();
  });

  test('does nothing when no restore record is stored', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const stored = await saveNoneWake({ wakeEnvironment });
    await expect(detach({ wakeEnvironment, remainingSockets: 0 })).resolves.toBeUndefined();
    expect(await wakeEnvironment.wake.repository.findWake({ agent: AGENT })).toEqual(stored);
  });
});

describe('wakeRungFor', () => {
  test('maps the local mode to the local rung', () => {
    expect(wakeRungFor({ mode: WakeMode.Local })).toBe(WakeRung.Local);
  });
});
