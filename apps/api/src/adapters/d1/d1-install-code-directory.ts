import { buildConnectionLink, type InstallCodeDirectory, type InstallCodeResolution, type InstallCodeVault } from '@zapbip/core';
import { AccountState, InstallCodeStatus, type OwnerLocale } from '@zapbip/types';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { hashInstallCode } from '../platform/hash';

const RESOLVE_STATEMENT = `SELECT connections.id AS connectionId, connections.account_id AS accountId, connections.agent AS agent,
  connections.install_code_sealed_secret AS sealedSecret, connections.install_code_expires_at AS expiresAt,
  connections.first_call_at AS firstCallAt, owner_identities.locale AS locale
  FROM connections
  JOIN accounts ON accounts.id = connections.account_id
  JOIN owner_identities ON owner_identities.account_id = connections.account_id
  WHERE connections.install_code_digest = ? AND connections.revoked_at IS NULL AND accounts.state = ?`;
const CLEAR_SEALED_SECRET_STATEMENT = 'UPDATE connections SET install_code_sealed_secret = NULL WHERE id = ?';
const RECORD_FIRST_CALL_STATEMENT = `UPDATE connections SET first_call_at = ?, install_code_sealed_secret = NULL
  WHERE id = ? AND first_call_at IS NULL`;

type InstallCodeRow = {
  connectionId: string;
  accountId: string;
  agent: string;
  sealedSecret: string | null;
  expiresAt: number | null;
  firstCallAt: number | null;
  locale: OwnerLocale;
};

export class D1InstallCodeDirectory implements InstallCodeDirectory {
  private readonly database: D1Database;
  private readonly vault: InstallCodeVault;
  private readonly publicOrigin: string;

  constructor(input: { database: D1Database; vault: InstallCodeVault; publicOrigin: string }) {
    this.database = input.database;
    this.vault = input.vault;
    this.publicOrigin = input.publicOrigin;
  }

  async resolve(input: { installCode: string; now: number }): Promise<InstallCodeResolution> {
    const { installCode, now } = input;
    const digest = await hashInstallCode({ installCode });
    const row = await this.database.prepare(RESOLVE_STATEMENT).bind(digest, AccountState.Active).first<InstallCodeRow>();
    if (row === null) return { status: InstallCodeStatus.Unknown, locale: null };
    const { locale, expiresAt, sealedSecret, firstCallAt } = row;
    const isExpired = expiresAt === null || expiresAt <= now;
    if (isExpired) {
      await this.database.prepare(CLEAR_SEALED_SECRET_STATEMENT).bind(row.connectionId).run();
      return { status: InstallCodeStatus.Expired, locale };
    }
    const isUsed = firstCallAt !== null || sealedSecret === null;
    if (isUsed) return { status: InstallCodeStatus.Used, locale };
    const secret = await this.openSecret({ installCode, sealed: sealedSecret, connectionId: row.connectionId });
    if (secret === null) return { status: InstallCodeStatus.Unknown, locale: null };
    const connectionLink = buildConnectionLink({ publicOrigin: this.publicOrigin, secret });
    return {
      status: InstallCodeStatus.Ready,
      connectionLink,
      locale,
      agent: row.agent,
      accountId: row.accountId,
      connectionId: row.connectionId,
    };
  }

  private async openSecret(input: { installCode: string; sealed: string; connectionId: string }): Promise<string | null> {
    try {
      return await this.vault.open({ installCode: input.installCode, sealed: input.sealed });
    } catch {
      logEvent({ event: LogEvent.InstallCodeUnreadable, connectionId: input.connectionId });
      return null;
    }
  }

  async recordFirstCall(input: { connectionId: string; calledAt: number }): Promise<void> {
    await this.database.prepare(RECORD_FIRST_CALL_STATEMENT).bind(input.calledAt, input.connectionId).run();
  }
}
