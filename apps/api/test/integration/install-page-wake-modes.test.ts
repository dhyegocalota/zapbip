import { reset, runInDurableObject } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { INSTALL_CODE_TTL_MS, INSTALL_PAGE_PATH_PREFIX, OwnerLocale, WakeMode } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerWithInstallCode } from '../support/install-codes';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { accountInboxStub } from '../support/workers-env';
import { ACCOUNT_INBOX_MIGRATIONS } from '../../src/account-inbox/migrations';
import { runMigrations } from '../../src/account-inbox/run-migrations';

const ORIGIN = 'http://localhost:8787';
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const CLIENT_ADDRESS = '203.0.113.9';
const INSTALLING_AGENT = 'claude';
const WEBHOOK_AGENT = 'Ana Bot';
const UNKNOWN_AGENT = 'Rui Bot';
const STANDBY_LINE = (agent: string) => `standby_agent: "${agent}"`;
const INSERT_WAKE = 'INSERT INTO agent_wake (agent, mode, last_polled_at, updated_at) VALUES (?, ?, 0, 0)';

function validExpiry(): number {
  return Date.now() + INSTALL_CODE_TTL_MS;
}

async function seedWakeMode(input: { accountId: string; agent: string; mode: WakeMode }): Promise<void> {
  await runInDurableObject(accountInboxStub({ accountId: input.accountId }), async (_instance, state) => {
    runMigrations({ storage: state.storage, migrations: ACCOUNT_INBOX_MIGRATIONS });
    state.storage.sql.exec(INSERT_WAKE, input.agent, input.mode);
  });
}

async function fetchPage(input: { installCode: string }): Promise<string> {
  const response = await exports.default.fetch(
    new Request(`${ORIGIN}${INSTALL_PAGE_PATH_PREFIX}${input.installCode}`, { headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS } }),
  );
  expect(response.status).toBe(200);
  return response.text();
}

async function seedAccount(): Promise<string> {
  const accountId = `acc_${crypto.randomUUID()}`;
  await seedOwnerIdentity({ accountId, phone: '5511999990000', ownerLocale: OwnerLocale.EnglishUs });
  return accountId;
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('install page wake modes through the mounted application', () => {
  it('IS-W12 names the webhook agent as standby, read from the account inbox', async () => {
    const accountId = await seedAccount();
    const { installCode } = await registerWithInstallCode({ accountId, agent: INSTALLING_AGENT, expiresAt: validExpiry() });
    await registerWithInstallCode({ accountId, agent: WEBHOOK_AGENT, expiresAt: validExpiry() });
    await seedWakeMode({ accountId, agent: WEBHOOK_AGENT, mode: WakeMode.Webhook });
    expect(await fetchPage({ installCode })).toContain(STANDBY_LINE(WEBHOOK_AGENT));
  });

  it('IS-W12 names no standby while every other agent is unknown to the inbox or has no wake', async () => {
    const accountId = await seedAccount();
    const { installCode } = await registerWithInstallCode({ accountId, agent: INSTALLING_AGENT, expiresAt: validExpiry() });
    await registerWithInstallCode({ accountId, agent: UNKNOWN_AGENT, expiresAt: validExpiry() });
    await seedWakeMode({ accountId, agent: INSTALLING_AGENT, mode: WakeMode.None });
    expect(await fetchPage({ installCode })).not.toContain('standby_agent');
  });
});
