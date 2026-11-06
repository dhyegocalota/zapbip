import { INSTALL_CODE_TTL_MS } from '@zapbip/types';
import type { InstallCodeColumns } from '../account-types';
import type { AccountDependencies } from '../ports';

export type SealedInstallCode = { installCode: string; columns: InstallCodeColumns };

export async function sealInstallCode(input: { dependencies: AccountDependencies; secret: string }): Promise<SealedInstallCode> {
  const { dependencies, secret } = input;
  const { installCode, digest } = await dependencies.installCodeVault.issue();
  const sealedSecret = await dependencies.installCodeVault.seal({ installCode, secret });
  const columns = {
    installCodeDigest: digest,
    installCodeSealedSecret: sealedSecret,
    installCodeExpiresAt: dependencies.clock.now() + INSTALL_CODE_TTL_MS,
  };
  return { installCode, columns };
}
