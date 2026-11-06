import { AccountState, OwnerLocale } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import devWorker from '../../src/index.dev';
import productionWorker from '../../src/index';
import { runScheduled } from '../../src/operations/scheduled';
import { registerWithInstallCode } from '../support/install-codes';
import { applyDirectoryMigration, SEED_CREATED_AT, seedOwnerIdentity } from '../support/seed';
import type { Bindings } from '../../src/contract/env';
import { testEnv } from '../support/workers-env';

const CRON = '*/30 * * * *';
const EXPIRES_AT = SEED_CREATED_AT + 10;
const CLEAR_SEALED_SECRET_FRAGMENT = 'install_code_sealed_secret = NULL WHERE install_code_expires_at';

async function sealedSecretOf(input: { connectionId: string }): Promise<string | null> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT install_code_sealed_secret AS sealed FROM connections WHERE id = ?')
    .bind(input.connectionId)
    .first<{ sealed: string | null }>();
  if (row === null) throw new Error('connection row is missing');
  return row.sealed;
}

async function countAccounts(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM accounts').first<{ total: number }>();
  if (row === null) throw new Error('count missing');
  return row.total;
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('scheduled account jobs', () => {
  it('clears the sealed secret of an expired install code', async () => {
    await seedOwnerIdentity({ accountId: 'acc_cron', phone: '5511900000010', ownerLocale: OwnerLocale.EnglishUs });
    const { connection } = await registerWithInstallCode({ accountId: 'acc_cron', agent: 'claude', expiresAt: EXPIRES_AT });
    await runScheduled({ cron: CRON, now: EXPIRES_AT, env: testEnv });
    expect(await sealedSecretOf({ connectionId: connection.connectionId })).toBeNull();
  });

  it('keeps the sealed secret of a live install code', async () => {
    await seedOwnerIdentity({ accountId: 'acc_cron', phone: '5511900000010', ownerLocale: OwnerLocale.EnglishUs });
    const { connection } = await registerWithInstallCode({ accountId: 'acc_cron', agent: 'claude', expiresAt: EXPIRES_AT });
    await runScheduled({ cron: CRON, now: EXPIRES_AT - 1, env: testEnv });
    expect(await sealedSecretOf({ connectionId: connection.connectionId })).not.toBeNull();
  });

  it('finishes the deletion of an account left deleting', async () => {
    await seedOwnerIdentity({ accountId: 'acc_gone', phone: '5511900000011', ownerLocale: OwnerLocale.EnglishUs });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(AccountState.Deleting, 'acc_gone').run();
    await runScheduled({ cron: CRON, now: EXPIRES_AT, env: testEnv });
    expect(await countAccounts()).toBe(0);
  });

  it('still clears the expired secret when the deletion sweep fails', async () => {
    await seedOwnerIdentity({ accountId: 'acc_cron', phone: '5511900000010', ownerLocale: OwnerLocale.EnglishUs });
    const { connection } = await registerWithInstallCode({ accountId: 'acc_cron', agent: 'claude', expiresAt: EXPIRES_AT });
    await seedOwnerIdentity({ accountId: 'acc_gone', phone: '5511900000011', ownerLocale: OwnerLocale.EnglishUs });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(AccountState.Deleting, 'acc_gone').run();
    const failingInbox = {
      idFromName: () => {
        throw new Error('sweep failed');
      },
    } as unknown as Bindings['ACCOUNT_INBOX'];
    await expect(runScheduled({ cron: CRON, now: EXPIRES_AT, env: { ...testEnv, ACCOUNT_INBOX: failingInbox } })).rejects.toThrow(
      'sweep failed',
    );
    expect(await sealedSecretOf({ connectionId: connection.connectionId })).toBeNull();
  });

  it('still finishes the deletion when clearing the expired secrets fails', async () => {
    await seedOwnerIdentity({ accountId: 'acc_gone', phone: '5511900000011', ownerLocale: OwnerLocale.EnglishUs });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(AccountState.Deleting, 'acc_gone').run();
    const database = new Proxy(testEnv.CONNECTIONS, {
      get(target, property) {
        const member = Reflect.get(target, property);
        if (property !== 'prepare') return typeof member === 'function' ? member.bind(target) : member;
        return (statement: string) => {
          if (statement.includes(CLEAR_SEALED_SECRET_FRAGMENT)) throw new Error('clear failed');
          return target.prepare(statement);
        };
      },
    });
    await expect(runScheduled({ cron: CRON, now: EXPIRES_AT, env: { ...testEnv, CONNECTIONS: database } })).rejects.toThrow('clear failed');
    expect(await countAccounts()).toBe(0);
  });

  it.each([
    ['development', devWorker],
    ['production', productionWorker],
  ])('the %s entry exports a scheduled handler that runs them', async (_name, worker) => {
    await seedOwnerIdentity({ accountId: 'acc_gone', phone: '5511900000011', ownerLocale: OwnerLocale.EnglishUs });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(AccountState.Deleting, 'acc_gone').run();
    const controller = { cron: CRON, scheduledTime: EXPIRES_AT, noRetry: () => undefined } as ScheduledController;
    await worker.scheduled(controller, testEnv);
    expect(await countAccounts()).toBe(0);
  });
});
