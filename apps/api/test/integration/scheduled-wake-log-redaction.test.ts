import { STALE_POLL_INTERVAL_MULTIPLE, type AgentName } from '@zapbip/core';
import { MINUTE_MS, WakeMode } from '@zapbip/types';
import { reset, runDurableObjectAlarm } from 'cloudflare:test';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advanceClock, openWindow, receiveOwnerText } from '../support/inbox-session';
import { ACCEPTED, DEBOUNCE_ADVANCE_MS, WAKE_ACCOUNT, enableGrokWake, expectOk, wakeStub } from '../support/wake-session';
import { connectionOf } from '../support/workers-env';
import { applyDirectoryMigration } from '../support/seed';

const PRIMARY: AgentName = 'grok-web';
const STANDBY: AgentName = 'grok-bot';
const POLLING: AgentName = 'chatgpt';
const INTERVAL_MINUTES = 60;
const STALE_ADVANCE_MS = STALE_POLL_INTERVAL_MULTIPLE * INTERVAL_MINUTES * MINUTE_MS + MINUTE_MS;
const OWNER_BODY = 'segredo-123';
const AGENT_TEXT = 'resposta-456';

let stub: DurableObjectStub<DevAccountInbox>;

async function setWake(input: { agent: AgentName; standbyAgent: AgentName | null; mode: WakeMode; intervalMinutes: number | null }) {
  expectOk(
    await stub.setWake({
      connection: connectionOf({ accountId: WAKE_ACCOUNT, agent: input.agent }),
      setting: { mode: input.mode, url: null, token: null, intervalMinutes: input.intervalMinutes, standbyAgent: input.standbyAgent },
    }),
  );
}

async function ownerWritesTo(input: { agent: AgentName }): Promise<string> {
  const { messageId } = expectOk(await receiveOwnerText({ stub, text: `@${input.agent} ${OWNER_BODY}` }));
  if (messageId === null) throw new Error('owner message was not stored');
  return messageId;
}

async function alarmAfter(input: { advanceMs: number }): Promise<void> {
  await advanceClock({ stub, advanceMs: input.advanceMs });
  await runDurableObjectAlarm(stub);
}

beforeEach(applyDirectoryMigration);

beforeEach(async () => {
  stub = wakeStub({});
  await openWindow({ stub });
  await enableGrokWake({ stub, agent: STANDBY });
  await stub.devScriptWake({ agent: STANDBY, responses: [ACCEPTED] });
  await setWake({ agent: PRIMARY, mode: WakeMode.Standby, standbyAgent: STANDBY, intervalMinutes: null });
  await setWake({ agent: POLLING, mode: WakeMode.Scheduled, standbyAgent: null, intervalMinutes: INTERVAL_MINUTES });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('scheduled wake logs', () => {
  it('H no log line carries the owner body or the agent text across the whole alarm path', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const errorSpy = vi.spyOn(console, 'error');
    const warnSpy = vi.spyOn(console, 'warn');
    const ownerMessageId = await ownerWritesTo({ agent: PRIMARY });
    await alarmAfter({ advanceMs: DEBOUNCE_ADVANCE_MS });
    expectOk(
      await stub.sendText({
        connection: connectionOf({ accountId: WAKE_ACCOUNT, agent: STANDBY }),
        text: AGENT_TEXT,
        replyToMessageId: ownerMessageId,
      }),
    );
    await ownerWritesTo({ agent: POLLING });
    await alarmAfter({ advanceMs: STALE_ADVANCE_MS });
    const lines = [...logSpy.mock.calls, ...errorSpy.mock.calls, ...warnSpy.mock.calls].flat().map(String);
    expect(lines.length).toBeGreaterThan(0);
    [OWNER_BODY, AGENT_TEXT].forEach((body) => lines.forEach((line) => expect(line).not.toContain(body)));
  });
});
