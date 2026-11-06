import type { NewConnection } from '@zapbip/core';
import { D1ConnectionRegistry } from '../../src/adapters/d1/d1-connection-registry';
import { D1InstallCodeDirectory } from '../../src/adapters/d1/d1-install-code-directory';
import { createConnectionSecrets } from '../../src/adapters/platform/connection-secrets';
import { createInstallCodeVault } from '../../src/adapters/platform/install-code-vault';
import { SEED_CREATED_AT } from './seed';
import { testEnv } from './workers-env';

export const INSTALL_CODE_TTL_MS = 30 * 60 * 1000;
const ACTIVE_LIMIT = 8;

export type RegisteredInstallCode = { connection: NewConnection; installCode: string; secret: string };

export function installCodeDirectory(): D1InstallCodeDirectory {
  return new D1InstallCodeDirectory({
    database: testEnv.CONNECTIONS,
    vault: createInstallCodeVault(),
    publicOrigin: testEnv.PUBLIC_ORIGIN,
  });
}

export function connectionRegistry(): D1ConnectionRegistry {
  return new D1ConnectionRegistry({ database: testEnv.CONNECTIONS });
}

export async function issueInstallCodeColumns(input: { secret: string; expiresAt: number }) {
  const vault = createInstallCodeVault();
  const { installCode, digest } = await vault.issue();
  const sealed = await vault.seal({ installCode, secret: input.secret });
  const columns = { installCodeDigest: digest, installCodeSealedSecret: sealed, installCodeExpiresAt: input.expiresAt };
  return { installCode, columns };
}

export async function registerWithInstallCode(input: {
  accountId: string;
  agent: string;
  expiresAt?: number;
}): Promise<RegisteredInstallCode> {
  const { expiresAt = SEED_CREATED_AT + INSTALL_CODE_TTL_MS } = input;
  const { secret, digest } = await createConnectionSecrets().issue();
  const { installCode, columns } = await issueInstallCodeColumns({ secret, expiresAt });
  const connection: NewConnection = {
    connectionId: `con_${crypto.randomUUID()}`,
    accountId: input.accountId,
    agent: input.agent,
    secretDigest: digest,
    createdAt: SEED_CREATED_AT,
    ...columns,
  };
  await connectionRegistry().register({ connection, activeLimit: ACTIVE_LIMIT });
  return { connection, installCode, secret };
}
