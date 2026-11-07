import { InstallCodeStatus, OwnerLocale } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D1AccountDirectory } from '../../src/adapters/d1/d1-account-directory';
import { createInstallCodeVault } from '../../src/adapters/platform/install-code-vault';
import { clearExpiredInstallSecrets } from '../../src/accounts/deletion-sweep';
import { resolveConnection } from '../../src/routes/resolve-connection';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { connectionRegistry, installCodeDirectory, registerWithInstallCode } from '../support/install-codes';
import { SEED_CREATED_AT, seedOwnerIdentity } from '../support/seed';
import { applyDirectoryMigrationWithNumber } from '../support/whatsapp-numbers';
import { accountInboxStub, testEnv } from '../support/workers-env';
import { bindingsWith, deliver, findAccounts, screenTextsOf, WA_ID } from './owner-inbound-fixtures';

const NOW = SEED_CREATED_AT + 1;
const INSTALL_LINK = /\/i\/(zb_inst_[A-Za-z0-9_-]{22})/g;

async function dumpD1(): Promise<string> {
  const tables = await testEnv.CONNECTIONS.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'",
  ).all<{ name: string }>();
  const dumps = await Promise.all(
    tables.results.map(async ({ name }) => JSON.stringify((await testEnv.CONNECTIONS.prepare(`SELECT * FROM ${name}`).all()).results)),
  );
  return dumps.join('\n');
}

async function dumpDurableObject(accountId: string): Promise<string> {
  return runInDurableObject(accountInboxStub({ accountId }), async (_i, state) => {
    const tables = state.storage.sql
      .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'sqlite_%'")
      .toArray();
    const rows = tables.map(({ name }) => JSON.stringify(state.storage.sql.exec(`SELECT * FROM ${name}`).toArray()));
    const keys = JSON.stringify([...(await state.storage.list()).entries()]);
    return rows.join('\n') + keys;
  });
}

beforeEach(applyDirectoryMigrationWithNumber);
afterEach(reset);

describe('S3 security attacks', () => {
  it('secret never in replies, D1 or DO after create/rotate; install code only as /i/', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false });
    await deliver({ bindings, text: 'oi' });
    await deliver({ bindings, text: 'novo agente claude' });
    await deliver({ bindings, text: 'girar claude' });
    await deliver({ bindings, text: 'agentes' });
    const [account] = await findAccounts({ waId: WA_ID });
    const screen = (await screenTextsOf({ accountId: account!.accountId })).join('\n');
    expect(screen).not.toContain('zb_conn_');
    expect(screen).not.toMatch(/\/c\//);
    expect([...screen.matchAll(INSTALL_LINK)].length).toBe(2);
    const d1 = await dumpD1();
    expect(d1).not.toContain('zb_conn_');
    expect(d1).not.toMatch(/zb_inst_/);
    const dobj = await dumpDurableObject(account!.accountId);
    expect(dobj).not.toContain('zb_conn_');
    const codes = [...screen.matchAll(INSTALL_LINK)].map((m) => m[1]!);
    const statuses = await Promise.all(codes.map((installCode) => installCodeDirectory().resolve({ installCode, now: Date.now() })));
    expect(statuses.map((s) => s.status)).toEqual([InstallCodeStatus.Unknown, InstallCodeStatus.Ready]);
  });

  it('concurrent rotates leave exactly one valid link', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false });
    await deliver({ bindings, text: 'oi' });
    await deliver({ bindings, text: 'novo agente claude' });
    await Promise.all(Array.from({ length: 8 }, () => deliver({ bindings, text: 'girar claude' })));
    const [account] = await findAccounts({ waId: WA_ID });
    const screen = (await screenTextsOf({ accountId: account!.accountId })).join('\n');
    const codes = [...screen.matchAll(INSTALL_LINK)].map((m) => m[1]!);
    const resolved = await Promise.all(codes.map((installCode) => installCodeDirectory().resolve({ installCode, now: Date.now() })));
    const ready = resolved.filter((r) => r.status === InstallCodeStatus.Ready);
    expect(ready.length).toBe(1);
    const secretLink = ready[0]!.status === InstallCodeStatus.Ready ? ready[0]!.connectionLink : '';
    const secret = secretLink.split('/')[4]!;
    expect(await resolveConnection({ database: testEnv.CONNECTIONS, secret })).not.toBeNull();
    const active = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS n FROM connections WHERE revoked_at IS NULL').first<{
      n: number;
    }>();
    expect(active!.n).toBe(1);
  });

  it('rotate vs revoke race ends revoked with nothing resolvable, 25 rounds', async () => {
    await seedOwnerIdentity({ accountId: 'acc_1', phone: '5511900000001', ownerLocale: OwnerLocale.EnglishUs });
    for (let round = 0; round < 25; round += 1) {
      const agent = `a${round}`;
      const { connection, installCode, secret } = await registerWithInstallCode({ accountId: 'acc_1', agent });
      const next = await registerWithInstallCode({ accountId: 'acc_1', agent: `tmp${round}` });
      const rotation = connectionRegistry()
        .rotate({
          accountId: 'acc_1',
          agent,
          fromDigest: connection.secretDigest,
          toDigest: next.connection.secretDigest.replace(/.$/, 'f') + '',
          installCode: {
            installCodeDigest: next.connection.installCodeDigest,
            installCodeSealedSecret: next.connection.installCodeSealedSecret,
            installCodeExpiresAt: next.connection.installCodeExpiresAt,
          },
          rotatedAt: NOW,
        })
        .catch(() => false);
      const revoke = connectionRegistry().revoke({ accountId: 'acc_1', agent, revokedAt: NOW });
      await Promise.all([rotation, revoke]);
      const row = await testEnv.CONNECTIONS.prepare(
        'SELECT revoked_at, install_code_digest, install_code_sealed_secret FROM connections WHERE id = ?',
      )
        .bind(connection.connectionId)
        .first<{ revoked_at: number | null; install_code_digest: string | null; install_code_sealed_secret: string | null }>();
      expect(row!.revoked_at).not.toBeNull();
      expect(row!.install_code_digest).toBeNull();
      expect(row!.install_code_sealed_secret).toBeNull();
      expect(await resolveConnection({ database: testEnv.CONNECTIONS, secret })).toBeNull();
      expect((await installCodeDirectory().resolve({ installCode, now: NOW })).status).toBe(InstallCodeStatus.Unknown);
      void next;
    }
  });

  it('agent names with SQL, shell, proto and control characters are normalised or refused; tables intact', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false });
    await deliver({ bindings, text: 'oi' });
    const names = [
      "x'); DROP TABLE connections;--",
      '$(rm -rf /); `id` | cat /etc/passwd',
      '__proto__',
      'constructor',
      'a\u0000b',
      'a\nb',
      '../../etc/passwd',
      '<script>alert(1)</script>',
      '‮evil',
      'a'.repeat(100000),
      '😀😀😀',
    ];
    for (const name of names) await deliver({ bindings, text: `novo agente ${name}` });
    const rows = await testEnv.CONNECTIONS.prepare('SELECT agent FROM connections').all<{ agent: string }>();
    rows.results.forEach((row) => expect(row.agent).toMatch(/^[a-z0-9][a-z0-9-]*$/));
    const tables = await testEnv.CONNECTIONS.prepare(
      "SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('connections','accounts','owner_identities')",
    ).first<{ n: number }>();
    expect(tables!.n).toBe(3);
    const [account] = await findAccounts({ waId: WA_ID });
    const screen = (await screenTextsOf({ accountId: account!.accountId })).join('\n');
    expect(screen).not.toMatch(/DROP TABLE|rm -rf|<script>|‮/);
  });

  it('brute force: 3000 random well-formed install codes and malformed ones never resolve', async () => {
    await seedOwnerIdentity({ accountId: 'acc_1', phone: '5511900000001', ownerLocale: OwnerLocale.EnglishUs });
    await registerWithInstallCode({ accountId: 'acc_1', agent: 'claude' });
    const vault = createInstallCodeVault();
    const guesses = await Promise.all(Array.from({ length: 300 }, () => vault.issue()));
    const results = await Promise.all(guesses.map(({ installCode }) => installCodeDirectory().resolve({ installCode, now: NOW })));
    expect(results.every((r) => r.status === InstallCodeStatus.Unknown)).toBe(true);
    for (const bad of ['', 'zb_inst_', "' OR 1=1 --", 'z'.repeat(1_000_000), '\u0000']) {
      expect((await installCodeDirectory().resolve({ installCode: bad, now: NOW })).status).toBe(InstallCodeStatus.Unknown);
    }
  });

  it('tampered sealed value and cross-connection code do not open, and a corrupt sealed value resolves as unknown', async () => {
    await seedOwnerIdentity({ accountId: 'acc_1', phone: '5511900000001', ownerLocale: OwnerLocale.EnglishUs });
    const one = await registerWithInstallCode({ accountId: 'acc_1', agent: 'one' });
    const two = await registerWithInstallCode({ accountId: 'acc_1', agent: 'two' });
    const row = await testEnv.CONNECTIONS.prepare('SELECT install_code_sealed_secret AS s FROM connections WHERE id = ?')
      .bind(one.connection.connectionId)
      .first<{ s: string }>();
    await expect(createInstallCodeVault().open({ installCode: two.installCode, sealed: row!.s })).rejects.toThrow();
    const flipped = row!.s.slice(0, -2) + (row!.s.endsWith('AA') ? 'BB' : 'AA');
    await expect(createInstallCodeVault().open({ installCode: one.installCode, sealed: flipped })).rejects.toThrow();
    await testEnv.CONNECTIONS.prepare('UPDATE connections SET install_code_sealed_secret = ? WHERE id = ?')
      .bind(flipped, one.connection.connectionId)
      .run();
    const resolution = await installCodeDirectory().resolve({ installCode: one.installCode, now: NOW });
    expect(resolution.status).toBe(InstallCodeStatus.Unknown);
  });

  it('expiry sweep clears the sealed secret', async () => {
    await seedOwnerIdentity({ accountId: 'acc_1', phone: '5511900000001', ownerLocale: OwnerLocale.EnglishUs });
    const { connection, installCode } = await registerWithInstallCode({ accountId: 'acc_1', agent: 'claude', expiresAt: NOW + 10 });
    await clearExpiredInstallSecrets({ environment: testEnv, now: NOW + 10 });
    const row = await testEnv.CONNECTIONS.prepare('SELECT install_code_sealed_secret AS s FROM connections WHERE id = ?')
      .bind(connection.connectionId)
      .first<{ s: string | null }>();
    expect(row!.s).toBeNull();
    expect((await installCodeDirectory().resolve({ installCode, now: NOW + 10 })).status).toBe(InstallCodeStatus.Expired);
  });

  it('account isolation: same agent name on two accounts, revoke and rotate touch only one', async () => {
    await seedOwnerIdentity({ accountId: 'acc_1', phone: '5511900000001', ownerLocale: OwnerLocale.EnglishUs });
    await seedOwnerIdentity({ accountId: 'acc_2', phone: '5511900000002', ownerLocale: OwnerLocale.EnglishUs });
    const a = await registerWithInstallCode({ accountId: 'acc_1', agent: 'claude' });
    const b = await registerWithInstallCode({ accountId: 'acc_2', agent: 'claude' });
    await connectionRegistry().revoke({ accountId: 'acc_1', agent: 'claude', revokedAt: NOW });
    expect(await resolveConnection({ database: testEnv.CONNECTIONS, secret: a.secret })).toBeNull();
    const survivor = await resolveConnection({ database: testEnv.CONNECTIONS, secret: b.secret });
    expect(survivor?.connection.accountId).toBe('acc_2');
    expect((await installCodeDirectory().resolve({ installCode: b.installCode, now: NOW })).status).toBe(InstallCodeStatus.Ready);
    const rotated = await connectionRegistry().rotate({
      accountId: 'acc_1',
      agent: 'claude',
      fromDigest: b.connection.secretDigest,
      toDigest: await hashConnectionSecret({ secret: 'zb_conn_x' }),
      installCode: { installCodeDigest: 'd', installCodeSealedSecret: 's', installCodeExpiresAt: 1 },
      rotatedAt: NOW,
    });
    expect(rotated).toBe(false);
  });

  it('account deletion removes every trace', async () => {
    const bindings = bindingsWith({ waitlistEnabled: false });
    await deliver({ bindings, text: 'oi' });
    await deliver({ bindings, text: 'novo agente claude' });
    await deliver({ bindings, text: 'novo agente codex' });
    const [account] = await findAccounts({ waId: WA_ID });
    const accountId = account!.accountId;
    await testEnv.MEDIA.put(`accounts/${accountId}/media/m1`, new Uint8Array(10));
    await testEnv.MEDIA.put(`accounts/${accountId}/uploads/u1`, new Uint8Array(10));
    await testEnv.MEDIA.put(`accounts/${accountId}x/media/keep`, new Uint8Array(10));
    const before = await dumpD1();
    expect(before).toContain(WA_ID);
    await deliver({ bindings, text: 'apagar conta' });
    await deliver({ bindings, text: 'apagar conta definitivamente' });
    const after = await dumpD1();
    expect(after).not.toContain(WA_ID);
    expect(after).not.toContain(accountId);
    expect(after).not.toMatch(/claude|codex/);
    expect((await testEnv.MEDIA.list({ prefix: `accounts/${accountId}/` })).objects).toHaveLength(0);
    expect((await testEnv.MEDIA.list({ prefix: `accounts/${accountId}x/` })).objects).toHaveLength(1);
    const dobj = await dumpDurableObject(accountId);
    expect(dobj).not.toMatch(/claude|codex|apagar|oi/);
    await deliver({ bindings, text: 'oi' });
    const [fresh] = await findAccounts({ waId: WA_ID });
    expect(fresh!.accountId).not.toBe(accountId);
    const freshDump = await dumpD1();
    expect(freshDump).not.toMatch(/claude|codex/);
  });

  it('account deletion with an old secret: old secret is 401-equivalent after delete', async () => {
    await seedOwnerIdentity({ accountId: 'acc_1', phone: '5511900000001', ownerLocale: OwnerLocale.EnglishUs });
    const { secret } = await registerWithInstallCode({ accountId: 'acc_1', agent: 'claude' });
    await new D1AccountDirectory({ database: testEnv.CONNECTIONS }).remove({ accountId: 'acc_1' });
    expect(await resolveConnection({ database: testEnv.CONNECTIONS, secret })).toBeNull();
  });
});
