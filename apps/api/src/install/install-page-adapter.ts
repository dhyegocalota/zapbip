import type { ConnectionRecord, StandbyCandidate } from '@zapbip/core';
import type { Bindings } from '../contract/env';
import type { InstallPageRouteDependencies, WakeModeEntry } from '../routes/install-page';

export function joinStandbyCandidates(input: { connections: ConnectionRecord[]; wakeModes: WakeModeEntry[] }): StandbyCandidate[] {
  void input;
  throw new Error('joinStandbyCandidates is not implemented');
}

export function createInstallPageDependencies(input: { environment: Bindings }): InstallPageRouteDependencies {
  void input;
  throw new Error('createInstallPageDependencies is not implemented');
}
