import type { ConnectionRecord, StandbyCandidate } from '@zapbip/core';
import { D1ConnectionRegistry } from '../adapters/d1/d1-connection-registry';
import { D1InstallCodeDirectory } from '../adapters/d1/d1-install-code-directory';
import { createInstallCodeVault } from '../adapters/platform/install-code-vault';
import type { WakeModeEntry } from '../contract/account-inbox-rpc';
import type { Bindings } from '../contract/env';
import { accountInboxOf } from '../routes/account-inbox-stub';
import type { InstallPageRouteDependencies } from '../routes/install-page';

export function createInstallCodeDirectory(input: { environment: Bindings }): D1InstallCodeDirectory {
  return new D1InstallCodeDirectory({
    database: input.environment.CONNECTIONS,
    vault: createInstallCodeVault(),
    publicOrigin: input.environment.PUBLIC_ORIGIN,
  });
}

export function joinStandbyCandidates(input: { connections: ConnectionRecord[]; wakeModes: WakeModeEntry[] }): StandbyCandidate[] {
  return input.connections.flatMap((connection) => {
    const entry = input.wakeModes.find((candidate) => candidate.agent === connection.agent);
    if (entry === undefined) return [];
    return [{ agent: connection.agent, createdAt: connection.createdAt, wakeMode: entry.wakeMode }];
  });
}

export function createInstallPageDependencies(input: { environment: Bindings }): InstallPageRouteDependencies {
  const { environment } = input;
  return {
    installCodeDirectory: createInstallCodeDirectory({ environment }),
    connectionRegistry: new D1ConnectionRegistry({ database: environment.CONNECTIONS }),
    readWakeModes: ({ accountId }) => accountInboxOf({ bindings: environment, accountId }).listWakeModes(),
    limiter: environment.INSTALL_PAGE_LIMITER,
  };
}
