import { InboxErrorCode, SetWakeStatus, WakeMode, WakeProvider, WakeRung, WakeStatus } from '@zapbip/types';
import { describe, expect, test, vi } from 'vitest';
import { ACCOUNT_ID, connectionOf } from '../inbox/testing/fixtures';
import { captureInboxError } from '../inbox/testing/capture-inbox-error';
import { setWake } from './set-wake';
import { WAKE_SEALED_KEY_VERSION } from './constants';
import { CLAUDE_URL, createWakeEnvironment, GROK_URL, PINNED_TOKEN, PUBLIC_HOST, setWebhook } from './testing/wake-fixtures';

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
        setting: { mode: WakeMode.Webhook, ...fields },
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
      setting: { mode: WakeMode.None, url: null, token: null },
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
