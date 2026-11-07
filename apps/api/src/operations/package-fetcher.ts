import { parseJsonOrNull } from './json-text';

export type PackageAnswer = { status: number; body: unknown };
export type PackageFetcher = (input: { url: string }) => Promise<PackageAnswer>;

export function createPackageFetcher(): PackageFetcher {
  return async ({ url }) => {
    const response = await fetch(url);
    return { status: response.status, body: parseJsonOrNull({ text: await response.text() }) };
  };
}
