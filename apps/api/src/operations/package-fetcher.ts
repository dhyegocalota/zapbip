export type PackageAnswer = { status: number; sha256: string };
export type PackageFetcher = (input: { url: string }) => Promise<PackageAnswer>;

export function createPackageFetcher(): PackageFetcher {
  return async ({ url }) => {
    throw new Error(`createPackageFetcher is not implemented for ${url}`);
  };
}
