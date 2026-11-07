import { resolveNs } from 'node:dns/promises';

export type NameserverResolver = (input: { zone: string }) => Promise<string[]>;

export function createNameserverResolver(): NameserverResolver {
  return ({ zone }) => resolveNs(zone);
}
