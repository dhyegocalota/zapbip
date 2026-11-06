import type { InstallCodeDirectory, InstallCodeResolution, InstallCodeVault } from '@zapbip/core';

export class D1InstallCodeDirectory implements InstallCodeDirectory {
  constructor(_input: { database: D1Database; vault: InstallCodeVault; publicOrigin: string }) {}

  async resolve(_input: { installCode: string; now: number }): Promise<InstallCodeResolution> {
    throw new Error('D1InstallCodeDirectory.resolve is not implemented');
  }

  async recordFirstCall(_input: { connectionId: string; calledAt: number }): Promise<void> {
    throw new Error('D1InstallCodeDirectory.recordFirstCall is not implemented');
  }
}
