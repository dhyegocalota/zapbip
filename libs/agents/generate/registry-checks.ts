import type { DocsLanguage } from '@zapbip/types';
import type { LeakFile } from '../src/checks/leaks';
import type { PluginCheckSources } from '../src/checks/plugins';
import type { LoadedAgent } from './load';

export type CheckedAgent = LoadedAgent & { guides: Record<DocsLanguage, string> };

export function registryCheckViolationsOf(input: { agents: CheckedAgent[]; files: LeakFile[]; sources: PluginCheckSources }): string[] {
  throw new Error(`registryCheckViolationsOf is not implemented for ${input.agents.length} agents`);
}
