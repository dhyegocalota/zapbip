import type { OwnerLocale } from '@zapbip/types';

export type AgentName = string;

export type ConnectionIdentity = {
  accountId: string;
  agent: AgentName;
  ownerLocale: OwnerLocale;
};

export function connectionKeyOf(input: { connection: ConnectionIdentity }): string {
  throw new Error('connectionKeyOf is not implemented');
}
