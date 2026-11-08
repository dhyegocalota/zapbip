import type { AgentDefinition, AgentInstall } from '../contract';

export type InstallSectionEntry = { id: string; install: AgentInstall; definition: AgentDefinition };

export function installSectionViolationsOf(_input: { entries: InstallSectionEntry[] }): string[] {
  throw new Error('installSectionViolationsOf is not implemented');
}
