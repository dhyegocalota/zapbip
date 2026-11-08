import { createHash } from 'node:crypto';

const LOCATION_HEADER = 'location';

export type PackageAnswer = { status: number; sha256: string; location: string | null };
export type PackageFetcher = (input: { url: string }) => Promise<PackageAnswer>;

export function createPackageFetcher(): PackageFetcher {
  return async ({ url }) => {
    const response = await fetch(url, { redirect: 'manual' });
    const sha256 = createHash('sha256')
      .update(Buffer.from(await response.arrayBuffer()))
      .digest('hex');
    return { status: response.status, sha256, location: response.headers.get(LOCATION_HEADER) };
  };
}
