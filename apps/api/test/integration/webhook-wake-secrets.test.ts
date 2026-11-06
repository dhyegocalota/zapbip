import { WAKE_SECRET_KEY_BYTES, type WakeTransport } from '@zapbip/core';
import { InboxErrorCode, WakeAttemptOutcome, WakeMode, WakeStatus } from '@zapbip/types';
import { reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ACCOUNT_INBOX_MIGRATIONS } from '../../src/account-inbox/migrations';
import { runMigrations } from '../../src/account-inbox/run-migrations';
import { createWakeDependencies } from '../../src/account-inbox/wake-dependencies';
import { createPlatformClock } from '../../src/adapters/platform/clock';
import { createAesGcmWakeSecretBox } from '../../src/adapters/wake/aes-gcm-wake-secret-box';
import { advanceClock, receiveOwnerText } from '../support/inbox-session';
import {
  ACCEPTED,
  DEBOUNCE_ADVANCE_MS,
  GROK_TOKEN,
  GROK_URL,
  WAKE_ACCOUNT,
  WAKE_AGENT,
  enableGrokWake,
  mentionText,
  expectOk,
  readRequests,
  readWakeNotices,
  readWakeRow,
  replaceWakeDependencies,
  wakeStub,
} from '../support/wake-session';
import { connectionOf, testEnv } from '../support/workers-env';

const BASE64 = 'base64';
const KEY_NAME = 'WAKE_SECRET_KEY';
const METRICS_NAME = 'WAKE_METRICS';
const CURRENT_KEY_VERSION = 1;
const UNSUPPORTED_KEY_VERSION = 2;
const SHORT_KEY_BYTES = 31;
const THIRD_MIGRATION_VERSION = 3;
const GROK_PATH = '/automations/webhook/abc12345';
const OTHER_AGENT = 'beta';

let stub: DurableObjectStub<DevAccountInbox>;
const transport: WakeTransport = { send: async () => ({ outcome: WakeAttemptOutcome.Delivered, statusCode: 200, retryAfterMs: null }) };

function wakeDependenciesWith(input: { env: Partial<typeof testEnv> }) {
  return runInDurableObject(stub, (_instance, state) =>
    createWakeDependencies({ env: { ...testEnv, ...input.env }, storage: state.storage, clock: createPlatformClock(), transport }),
  );
}

async function wakeAfterOwnerMessage(): Promise<void> {
  await stub.devScriptWake({ agent: WAKE_AGENT, responses: [ACCEPTED] });
  expectOk(await receiveOwnerText({ stub, text: mentionText({ text: 'oi' }) }));
  await advanceClock({ stub, advanceMs: DEBOUNCE_ADVANCE_MS });
  await runDurableObjectAlarm(stub);
}

function rewriteRow(input: { set: string; value: string | number }): Promise<void> {
  return runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(`UPDATE agent_wake SET ${input.set} = ? WHERE agent = ?`, input.value, WAKE_AGENT);
  });
}

async function expectRefusedWithOneNotice(): Promise<void> {
  expect(await readRequests({ stub })).toEqual([]);
  expect((await readWakeRow({ stub })).status).toBe(WakeStatus.Failing);
  expect(await readWakeNotices({ stub })).toBe(1);
}

beforeEach(async () => {
  stub = wakeStub({});
  await enableGrokWake({ stub });
});

afterEach(async () => {
  await reset();
});

describe('sealed wake storage', () => {
  it('stores neither the token nor the url path as text', async () => {
    const row = await readWakeRow({ stub });
    expect(row.sealed_target).not.toBeNull();
    expect(row.sealed_target).not.toContain(GROK_TOKEN);
    expect(Buffer.from(row.sealed_target!, BASE64).toString('latin1')).not.toContain(GROK_PATH);
    expect(row.key_version).toBe(CURRENT_KEY_VERSION);
  });

  it('refuses a target sealed for another agent', async () => {
    const box = createAesGcmWakeSecretBox({ base64Key: testEnv.WAKE_SECRET_KEY });
    const moved = await box.seal({
      plain: JSON.stringify({ url: GROK_URL, token: GROK_TOKEN }),
      associatedData: `${WAKE_ACCOUNT}:${OTHER_AGENT}`,
    });
    await rewriteRow({ set: 'sealed_target', value: moved });
    await wakeAfterOwnerMessage();
    await expectRefusedWithOneNotice();
  });

  it('refuses a target that the current key does not open', async () => {
    await replaceWakeDependencies({
      stub,
      patch: { secretBox: createAesGcmWakeSecretBox({ base64Key: Buffer.alloc(WAKE_SECRET_KEY_BYTES, 5).toString(BASE64) }) },
    });
    await wakeAfterOwnerMessage();
    await expectRefusedWithOneNotice();
  });

  it('refuses a target stored under another key version', async () => {
    await rewriteRow({ set: 'key_version', value: UNSUPPORTED_KEY_VERSION });
    await wakeAfterOwnerMessage();
    await expectRefusedWithOneNotice();
  });
});

describe('wake target guard', () => {
  it('rejects a target on the host of the public origin without echoing it', async () => {
    const ownHost = new URL(testEnv.PUBLIC_ORIGIN).hostname;
    const outcome = await stub.setWake({
      connection: connectionOf({ accountId: WAKE_ACCOUNT, agent: WAKE_AGENT }),
      setting: { mode: WakeMode.Webhook, url: `https://${ownHost}/hook`, token: GROK_TOKEN, intervalMinutes: null, standbyAgent: null },
    });
    expect(outcome).toEqual({ ok: false, errorCode: InboxErrorCode.InvalidInput, message: 'invalid url' });
  });
});

describe('wake dependencies', () => {
  it('throws naming the key when it is absent', async () => {
    await expect(wakeDependenciesWith({ env: { WAKE_SECRET_KEY: undefined } as never })).rejects.toThrow(KEY_NAME);
  });

  it('throws naming the key when it has 31 bytes', async () => {
    await expect(wakeDependenciesWith({ env: { WAKE_SECRET_KEY: Buffer.alloc(SHORT_KEY_BYTES).toString(BASE64) } })).rejects.toThrow(
      KEY_NAME,
    );
  });

  it('throws naming the dataset when it is absent', async () => {
    await expect(wakeDependenciesWith({ env: { WAKE_METRICS: undefined } as never })).rejects.toThrow(METRICS_NAME);
  });
});

describe('migration v2', () => {
  it('applies once when a later version is already applied', async () => {
    const applied = await runInDurableObject(stub, (_instance, state) => {
      const { sql } = state.storage;
      sql.exec('DROP TABLE wake_jobs');
      ['provider', 'host', 'sealed_target', 'key_version', 'status', 'last_delivered_at'].forEach((column) =>
        sql.exec(`ALTER TABLE agent_wake DROP COLUMN ${column}`),
      );
      sql.exec('DELETE FROM schema_versions WHERE version = 2');
      sql.exec('INSERT INTO schema_versions (version, applied_at) VALUES (?, 0)', THIRD_MIGRATION_VERSION);
      const migrations = [{ version: THIRD_MIGRATION_VERSION, sql: 'SELECT 1' }, ...ACCOUNT_INBOX_MIGRATIONS];
      return {
        first: runMigrations({ storage: state.storage, migrations }),
        second: runMigrations({ storage: state.storage, migrations }),
        versions: sql
          .exec<{ version: number }>('SELECT version FROM schema_versions ORDER BY version')
          .toArray()
          .map((row) => row.version),
      };
    });
    expect(applied).toEqual({ first: [2], second: [], versions: [1, 2, 3] });
  });
});
