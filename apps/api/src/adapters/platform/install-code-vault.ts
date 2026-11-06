import type { InstallCodeVault, IssuedInstallCode } from '@zapbip/core';

export function createInstallCodeVault(): InstallCodeVault {
  return {
    async issue(): Promise<IssuedInstallCode> {
      throw new Error('InstallCodeVault.issue is not implemented');
    },
    async seal(): Promise<string> {
      throw new Error('InstallCodeVault.seal is not implemented');
    },
    async open(): Promise<string> {
      throw new Error('InstallCodeVault.open is not implemented');
    },
  };
}
