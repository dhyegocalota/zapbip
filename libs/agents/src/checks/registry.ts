import type { AgentDefinition } from '../contract';

export type RegistryEntry = { id: string; definition: AgentDefinition | null };

export function registryViolationsOf(input: { entries: RegistryEntry[] }): string[] {
  throw new Error('registryViolationsOf is not implemented');
}
