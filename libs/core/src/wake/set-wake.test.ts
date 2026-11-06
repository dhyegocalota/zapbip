import { InboxErrorCode, MINUTE_MS, OwnerLocale, SetWakeStatus, WakeMode, WakeProvider, WakeRung, WakeStatus } from '@zapbip/types';
import { describe, expect, test, vi } from 'vitest';
import { ACCOUNT_ID, connectionOf } from '../inbox/testing/fixtures';
import { captureInboxError } from '../inbox/testing/capture-inbox-error';
import { setWake } from './set-wake';
import { WAKE_SEALED_KEY_VERSION } from './constants';
import {
  CLAUDE_URL,
  createWakeEnvironment,
  GROK_URL,
  PINNED_TOKEN,
  PUBLIC_HOST,
  setWebhook,
  type WakeEnvironment,
} from './testing/wake-fixtures';

const AGENT = 'claude-code';

describe('setWake', () => {
  test('seals a Grok target and answers without the url or the token', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const result = await setWebhook({ wakeEnvironment, agent: AGENT });
    const stored = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    expect(result).toEqual({
      status: SetWakeStatus.Saved,
      wakeMode: WakeMode.Webhook,
      effectiveRung: WakeRung.Webhook,
      provider: WakeProvider.GrokRoutine,
    });
    expect(JSON.stringify(result)).not.toContain(GROK_URL);
    expect(JSON.stringify(result)).not.toContain(PINNED_TOKEN);
    expect(stored).toMatchObject({
      agent: AGENT,
      mode: WakeMode.Webhook,
      status: WakeStatus.Active,
      target: { provider: WakeProvider.GrokRoutine, host: 'api2.cursor.sh', keyVersion: WAKE_SEALED_KEY_VERSION },
    });
    expect(stored?.target?.sealedTarget).not.toBe(GROK_URL);
    expect(stored?.target?.sealedTarget).not.toBe(PINNED_TOKEN);
  });

  test('a Claude URL selects claude_routine', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const result = await setWebhook({ wakeEnvironment, agent: AGENT, url: CLAUDE_URL });
    expect(result.provider).toBe(WakeProvider.ClaudeRoutine);
  });

  test('stores the lowercase host of a mixed-case generic URL', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: AGENT, url: 'https://HOOKS.Example.com/x', token: 'g'.repeat(32) });
    const stored = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    expect(stored?.target?.host).toBe('hooks.example.com');
  });

  test('seals with the account and agent as associated data', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const seal = vi.spyOn(wakeEnvironment.wake.secretBox, 'seal');
    await setWebhook({ wakeEnvironment, agent: AGENT });
    expect(seal).toHaveBeenCalledWith({
      plain: JSON.stringify({ url: GROK_URL, token: PINNED_TOKEN }),
      associatedData: `${ACCOUNT_ID}:${AGENT}`,
    });
  });

  test('never calls the provider', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: AGENT });
    expect(wakeEnvironment.transport.requests).toEqual([]);
  });

  test('an invalid url saves nothing and keeps the previous wake', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: AGENT });
    const before = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    const saveWake = vi.spyOn(wakeEnvironment.wake.repository, 'saveWake');
    const error = await captureInboxError(() => setWebhook({ wakeEnvironment, agent: AGENT, url: 'http://hooks.example.com/x' }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'invalid url' });
    expect(saveWake).not.toHaveBeenCalled();
    expect(await wakeEnvironment.wake.repository.findWake({ agent: AGENT })).toEqual(before);
  });

  test.each([
    ['a missing url', { url: null, token: PINNED_TOKEN }, 'invalid url'],
    ['a missing token', { url: GROK_URL, token: null }, 'invalid token'],
  ])('%s saves nothing', async (_name, fields, message) => {
    const wakeEnvironment = await createWakeEnvironment();
    const error = await captureInboxError(() =>
      setWake({
        ...wakeEnvironment.context,
        connection: connectionOf({ agent: AGENT }),
        setting: { mode: WakeMode.Webhook, intervalMinutes: null, standbyAgent: null, ...fields },
        publicHost: PUBLIC_HOST,
      }),
    );
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message });
    expect(await wakeEnvironment.wake.repository.findWake({ agent: AGENT })).toBeNull();
  });

  test('a successful set resets a failing wake to active', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: AGENT });
    const stored = await wakeEnvironment.wake.repository.findWake({ agent: AGENT });
    if (stored === null) throw new Error('expected a stored wake');
    await wakeEnvironment.wake.repository.saveWake({ wake: { ...stored, status: WakeStatus.Failing } });
    await setWebhook({ wakeEnvironment, agent: AGENT });
    expect(await wakeEnvironment.wake.repository.findWake({ agent: AGENT })).toMatchObject({ status: WakeStatus.Active });
  });

  test('none clears the target and deletes the pending job', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: AGENT });
    await wakeEnvironment.wake.repository.saveJob({
      job: { agent: AGENT, dueAt: 1, attempt: 0, leaseUntil: null, rewake: false, lastOutcome: null },
    });
    expect(await wakeEnvironment.wake.repository.findJob({ agent: AGENT })).not.toBeNull();
    const result = await setWake({
      ...wakeEnvironment.context,
      connection: connectionOf({ agent: AGENT }),
      setting: { mode: WakeMode.None, url: null, token: null, intervalMinutes: null, standbyAgent: null },
      publicHost: PUBLIC_HOST,
    });
    expect(result).toEqual({ status: SetWakeStatus.Saved, wakeMode: WakeMode.None, effectiveRung: WakeRung.Inbox, provider: null });
    expect(await wakeEnvironment.wake.repository.findWake({ agent: AGENT })).toMatchObject({
      mode: WakeMode.None,
      target: null,
      status: WakeStatus.Active,
    });
    expect(await wakeEnvironment.wake.repository.findJob({ agent: AGENT })).toBeNull();
  });
});

function setScheduled(input: { wakeEnvironment: WakeEnvironment; agent: string; intervalMinutes: number; ownerLocale?: OwnerLocale }) {
  const { wakeEnvironment, agent, intervalMinutes, ownerLocale } = input;
  return setWake({
    ...wakeEnvironment.context,
    connection: connectionOf({ agent, ownerLocale }),
    setting: { mode: WakeMode.Scheduled, url: null, token: null, intervalMinutes, standbyAgent: null },
    publicHost: PUBLIC_HOST,
  });
}

function setStandby(input: { wakeEnvironment: WakeEnvironment; agent: string; standbyAgent: string }) {
  const { wakeEnvironment, agent, standbyAgent } = input;
  return setWake({
    ...wakeEnvironment.context,
    connection: connectionOf({ agent }),
    setting: { mode: WakeMode.Standby, url: null, token: null, intervalMinutes: null, standbyAgent },
    publicHost: PUBLIC_HOST,
  });
}

describe('setWake scheduled', () => {
  test('saves the interval and the owner locale of the connection', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const result = await setScheduled({
      wakeEnvironment,
      agent: 'chatgpt',
      intervalMinutes: 60,
      ownerLocale: OwnerLocale.PortugueseBrazil,
    });
    expect(result).toEqual({
      status: SetWakeStatus.Saved,
      wakeMode: WakeMode.Scheduled,
      effectiveRung: WakeRung.Scheduled,
      provider: null,
    });
    expect(await wakeEnvironment.wake.repository.findWake({ agent: 'chatgpt' })).toMatchObject({
      mode: WakeMode.Scheduled,
      intervalMinutes: 60,
      standbyAgent: null,
      ownerLocale: OwnerLocale.PortugueseBrazil,
    });
  });

  test('an interval of zero saves nothing', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const saveWake = vi.spyOn(wakeEnvironment.wake.repository, 'saveWake');
    const error = await captureInboxError(() => setScheduled({ wakeEnvironment, agent: 'chatgpt', intervalMinutes: 0 }));
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(saveWake).not.toHaveBeenCalled();
  });

  test('setting it again keeps the last poll', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { clock } = wakeEnvironment.environment;
    await setScheduled({ wakeEnvironment, agent: 'chatgpt', intervalMinutes: 60 });
    const polledAt = clock.now();
    await wakeEnvironment.wake.repository.recordPoll({ agent: 'chatgpt', polledAt, ownerLocale: OwnerLocale.EnglishUs });
    await clock.advance({ ms: 30 * MINUTE_MS });
    await setScheduled({ wakeEnvironment, agent: 'chatgpt', intervalMinutes: 30 });
    expect(await wakeEnvironment.wake.repository.findPollState({ agent: 'chatgpt' })).toMatchObject({ lastPolledAt: polledAt });
  });

  test('replaces a pending webhook job', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: 'chatgpt' });
    await wakeEnvironment.wake.repository.saveJob({
      job: { agent: 'chatgpt', dueAt: 1, attempt: 0, leaseUntil: null, rewake: false, lastOutcome: null },
    });
    await setScheduled({ wakeEnvironment, agent: 'chatgpt', intervalMinutes: 60 });
    expect(await wakeEnvironment.wake.repository.findJob({ agent: 'chatgpt' })).toBeNull();
  });
});

describe('setWake standby', () => {
  test('saves the standby when it is connected', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: 'grok-bot' });
    const result = await setStandby({ wakeEnvironment, agent: 'grok-web', standbyAgent: 'grok-bot' });
    expect(result).toEqual({ status: SetWakeStatus.Saved, wakeMode: WakeMode.Standby, effectiveRung: WakeRung.Standby, provider: null });
    expect(await wakeEnvironment.wake.repository.findWake({ agent: 'grok-web' })).toMatchObject({
      mode: WakeMode.Standby,
      standbyAgent: 'grok-bot',
      intervalMinutes: null,
    });
  });

  test('a standby that is not connected saves nothing', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const saveWake = vi.spyOn(wakeEnvironment.wake.repository, 'saveWake');
    const error = await captureInboxError(() => setStandby({ wakeEnvironment, agent: 'grok-web', standbyAgent: 'grok-bot' }));
    expect(error.code).toBe(InboxErrorCode.InvalidInput);
    expect(error.message).toContain('standby_agent');
    expect(saveWake).not.toHaveBeenCalled();
  });
});
