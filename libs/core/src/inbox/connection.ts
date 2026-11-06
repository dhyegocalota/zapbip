import type { OwnerLocale } from '@zapbip/types';

export type AgentName = string;

export type ConnectionIdentity = {
  accountId: string;
  agent: AgentName;
  ownerLocale: OwnerLocale;
};
