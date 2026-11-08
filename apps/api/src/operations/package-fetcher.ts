import { createHash } from 'node:crypto';

export type PackageAnswer = { status: number; sha256: string; location: string | null };
export type PackageFetcher = (input: { url: string }) => Promise<PackageAnswer>;

export function createPackageFetcher(): PackageFetcher {
  return async ({ url }) => {
    const response = await fetch(url);
    const sha256 = createHash('sha256')
      .update(Buffer.from(await response.arrayBuffer()))
      .digest('hex');
    return { status: response.status, sha256, location: null };
  };
}
