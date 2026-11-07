export type PackageAnswer = { status: number; body: unknown };
export type PackageFetcher = (input: { url: string }) => Promise<PackageAnswer>;

export function createPackageFetcher(): PackageFetcher {
  throw new Error('createPackageFetcher is not implemented');
}
