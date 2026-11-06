import { InstallCodeStatus, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { createConnectionSecrets } from '../../src/adapters/platform/connection-secrets';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { createInstallCodeVault } from '../../src/adapters/platform/install-code-vault';
import { INSTALL_CODE_PREFIX } from '../../src/contract/constants';
import {
  connectionRegistry,
  INSTALL_CODE_TTL_MS,
  installCodeDirectory,
  issueInstallCodeColumns,
  registerWithInstallCode,
} from '../support/install-codes';
import { applyDirectoryMigration, SEED_CREATED_AT, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';

const ACCOUNT_ID = 'acc_1';
const OTHER_ACCOUNT_ID = 'acc_2';
const PHONE = '5511900000000';
const OTHER_PHONE = '5511900000001';
const NOW = SEED_CREATED_AT + 1;
const ROTATED_AT = SEED_CREATED_AT + 2;
const FIRST_CALL_AT = SEED_CREATED_AT + 3;
const LATER_CALL_AT = SEED_CREATED_AT + 4;
const REVOKED_AT = SEED_CREATED_AT + 5;
const SECRET_MARK = 'zb_conn_';
const CONNECTION_LINK_SECRET_SEGMENT = 4;

type CallRow = { first_call_at: number | null; install_code_sealed_secret: string | null };
type InstallCodeRow = { digest: string | null; sealed: string | null; expiresAt: number | null };

function readCallColumns(input: { connectionId: string }): Promise<CallRow | null> {
  return testEnv.CONNECTIONS.prepare('SELECT first_call_at, install_code_sealed_secret FROM connections WHERE id = ?')
    .bind(input.connectionId)
    .first<CallRow>();
}

function readInstallCodeColumns(input: { connectionId: string }): Promise<InstallCodeRow | null> {
  return testEnv.CONNECTIONS.prepare(
    'SELECT install_code_digest AS digest, install_code_sealed_secret AS sealed, install_code_expires_at AS expiresAt FROM connections WHERE id = ?',
  )
    .bind(input.connectionId)
    .first<InstallCodeRow>();
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedOwnerIdentity({ accountId: ACCOUNT_ID, phone: PHONE, ownerLocale: OwnerLocale.EnglishUs });
  await seedOwnerIdentity({ accountId: OTHER_ACCOUNT_ID, phone: OTHER_PHONE, ownerLocale: OwnerLocale.PortugueseBrazil });
});
afterEach(reset);

describe('D1 install code directory resolve', () => {
  it('is ready with the connection link built from the opened secret, the agent and the account locale', async () => {
    const { connection, installCode, secret } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    expect(await installCodeDirectory().resolve({ installCode, now: NOW })).toEqual({
      status: InstallCodeStatus.Ready,
      connectionLink: `${testEnv.PUBLIC_ORIGIN}/c/${secret}/mcp`,
      locale: OwnerLocale.EnglishUs,
      agent: 'claude',
      accountId: ACCOUNT_ID,
      connectionId: connection.connectionId,
    });
  });

  it('opens a link whose secret authenticates the connection', async () => {
    const { connection, installCode } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    const resolution = await installCodeDirectory().resolve({ installCode, now: NOW });
    if (resolution.status !== InstallCodeStatus.Ready) throw new Error('the install code was not ready');
    const secret = resolution.connectionLink.split('/')[CONNECTION_LINK_SECRET_SEGMENT];
    expect(secret?.startsWith(SECRET_MARK)).toBe(true);
    expect(connection.secretDigest).toBe(await hashConnectionSecret({ secret: secret! }));
  });

  it('is unknown with no locale for a code with no row', async () => {
    const { installCode } = await createInstallCodeVault().issue();
    expect(await installCodeDirectory().resolve({ installCode, now: NOW })).toEqual({ status: InstallCodeStatus.Unknown, locale: null });
  });

  it('is unknown for a revoked connection', async () => {
    const { installCode } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    await connectionRegistry().revoke({ accountId: ACCOUNT_ID, agent: 'claude', revokedAt: REVOKED_AT });
    expect((await installCodeDirectory().resolve({ installCode, now: NOW })).status).toBe(InstallCodeStatus.Unknown);
  });

  it('is ready one millisecond before the expiry and expired with the account locale at the expiry', async () => {
    const expiresAt = NOW + INSTALL_CODE_TTL_MS;
    const { installCode } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude', expiresAt });
    expect((await installCodeDirectory().resolve({ installCode, now: expiresAt - 1 })).status).toBe(InstallCodeStatus.Ready);
    expect(await installCodeDirectory().resolve({ installCode, now: expiresAt })).toEqual({
      status: InstallCodeStatus.Expired,
      locale: OwnerLocale.EnglishUs,
    });
  });

  it('is used after the first call', async () => {
    const { connection, installCode } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    await installCodeDirectory().recordFirstCall({ connectionId: connection.connectionId, calledAt: FIRST_CALL_AT });
    expect(await installCodeDirectory().resolve({ installCode, now: NOW })).toEqual({
      status: InstallCodeStatus.Used,
      locale: OwnerLocale.EnglishUs,
    });
  });
});

describe('D1 install code directory first call', () => {
  it('keeps the first value, clears the sealed secret and ignores the second call', async () => {
    const { connection } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    await installCodeDirectory().recordFirstCall({ connectionId: connection.connectionId, calledAt: FIRST_CALL_AT });
    await installCodeDirectory().recordFirstCall({ connectionId: connection.connectionId, calledAt: LATER_CALL_AT });
    expect(await readCallColumns({ connectionId: connection.connectionId })).toEqual({
      first_call_at: FIRST_CALL_AT,
      install_code_sealed_secret: null,
    });
  });

  it('leaves another connection ready', async () => {
    const first = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    const second = await registerWithInstallCode({ accountId: OTHER_ACCOUNT_ID, agent: 'codex' });
    await installCodeDirectory().recordFirstCall({ connectionId: first.connection.connectionId, calledAt: FIRST_CALL_AT });
    expect((await installCodeDirectory().resolve({ installCode: second.installCode, now: NOW })).status).toBe(InstallCodeStatus.Ready);
    expect(await readCallColumns({ connectionId: second.connection.connectionId })).toMatchObject({ first_call_at: null });
  });
});

describe('D1 connection registry install code columns', () => {
  it('stores the install code columns on register and reads them with the client name and the first call', async () => {
    const { connection } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    expect(await connectionRegistry().findActiveByAgent({ accountId: ACCOUNT_ID, agent: 'claude' })).toEqual({
      ...connection,
      clientName: null,
      firstCallAt: null,
    });
  });

  it('rotates to a new code: the old code is unknown and the new one is ready even after the old one was used', async () => {
    const { connection, installCode: oldCode } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    await installCodeDirectory().recordFirstCall({ connectionId: connection.connectionId, calledAt: FIRST_CALL_AT });
    const { secret, digest } = await createConnectionSecrets().issue();
    const { installCode: newCode, columns } = await issueInstallCodeColumns({ secret, expiresAt: ROTATED_AT + INSTALL_CODE_TTL_MS });
    const isRotated = await connectionRegistry().rotate({
      accountId: ACCOUNT_ID,
      agent: 'claude',
      fromDigest: connection.secretDigest,
      toDigest: digest,
      installCode: columns,
      rotatedAt: ROTATED_AT,
    });
    expect(isRotated).toBe(true);
    expect((await installCodeDirectory().resolve({ installCode: oldCode, now: ROTATED_AT })).status).toBe(InstallCodeStatus.Unknown);
    expect((await installCodeDirectory().resolve({ installCode: newCode, now: ROTATED_AT })).status).toBe(InstallCodeStatus.Ready);
  });

  it('restores the previous install code columns when the compensation rotates back', async () => {
    const { connection } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    const before = await readInstallCodeColumns({ connectionId: connection.connectionId });
    const previousColumns = {
      installCodeDigest: before!.digest,
      installCodeSealedSecret: before!.sealed,
      installCodeExpiresAt: before!.expiresAt,
    };
    const { secret, digest } = await createConnectionSecrets().issue();
    const { columns } = await issueInstallCodeColumns({ secret, expiresAt: ROTATED_AT + INSTALL_CODE_TTL_MS });
    const registry = connectionRegistry();
    await registry.rotate({
      accountId: ACCOUNT_ID,
      agent: 'claude',
      fromDigest: connection.secretDigest,
      toDigest: digest,
      installCode: columns,
      rotatedAt: ROTATED_AT,
    });
    await registry.rotate({
      accountId: ACCOUNT_ID,
      agent: 'claude',
      fromDigest: digest,
      toDigest: connection.secretDigest,
      installCode: previousColumns,
      rotatedAt: ROTATED_AT,
    });
    expect(await readInstallCodeColumns({ connectionId: connection.connectionId })).toEqual(before);
  });

  it('clears the install code columns on revoke', async () => {
    const { connection } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    await connectionRegistry().revoke({ accountId: ACCOUNT_ID, agent: 'claude', revokedAt: REVOKED_AT });
    expect(await readInstallCodeColumns({ connectionId: connection.connectionId })).toEqual({
      digest: null,
      sealed: null,
      expiresAt: null,
    });
  });

  it('never stores the connection secret or the install code in clear', async () => {
    const { secret, installCode } = await registerWithInstallCode({ accountId: ACCOUNT_ID, agent: 'claude' });
    const rows = await testEnv.CONNECTIONS.prepare('SELECT * FROM connections').all<Record<string, unknown>>();
    const dump = JSON.stringify(rows.results);
    expect(dump).not.toContain(secret);
    expect(dump).not.toContain(installCode);
    expect(dump).not.toContain(INSTALL_CODE_PREFIX);
    expect(dump).not.toContain(SECRET_MARK);
  });
});
