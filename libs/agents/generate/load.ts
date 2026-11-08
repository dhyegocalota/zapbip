import { AgentFacet, type AgentConnectorRuntime, type AgentDefinition, type AgentInstall, type AgentPlugin } from '../src/contract';
import type { RegistryEntry } from '../src/checks/registry';
import type { DiscoveredAgent } from './discover';
import { repositoryPath } from './repository';

export type LoadedAgent = DiscoveredAgent & {
  definition: AgentDefinition | null;
  install: AgentInstall | null;
  plugin: AgentPlugin | null;
  runtime: AgentConnectorRuntime | null;
};

type AgentModule = { definition?: AgentDefinition; install?: AgentInstall; plugin?: AgentPlugin; runtime?: AgentConnectorRuntime };

async function moduleOf(input: { agent: DiscoveredAgent; facet: AgentFacet }): Promise<AgentModule> {
  return import(repositoryPath(`${input.agent.folder}/${input.facet}`));
}

async function exportedOf<Name extends keyof AgentModule>(input: {
  agent: DiscoveredAgent;
  facet: AgentFacet;
  name: Name;
}): Promise<Required<AgentModule>[Name] | null> {
  if (!input.agent.facets.includes(input.facet)) return null;
  const exported = (await moduleOf(input))[input.name];
  if (exported === undefined) return null;
  return exported as Required<AgentModule>[Name];
}

export async function loadAgent(input: { agent: DiscoveredAgent }): Promise<LoadedAgent> {
  const { agent } = input;
  const [definition, install, plugin, runtime] = await Promise.all([
    exportedOf({ agent, facet: AgentFacet.Definition, name: 'definition' }),
    exportedOf({ agent, facet: AgentFacet.Install, name: 'install' }),
    exportedOf({ agent, facet: AgentFacet.Plugin, name: 'plugin' }),
    exportedOf({ agent, facet: AgentFacet.Connector, name: 'runtime' }),
  ]);
  return { ...agent, definition, install, plugin, runtime };
}

export function registryEntriesOf(input: { agents: LoadedAgent[] }): RegistryEntry[] {
  return input.agents.map((agent) => ({ id: agent.id, definition: agent.definition }));
}
