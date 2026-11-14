import { AgentFacet, type AgentDefinition, type AgentInstall, type AgentPlugin } from '../src/contract';
import { agentOrderOf } from '../src/order';
import type { DiscoveredAgent } from './discover';

export type ResolvedAgent = DiscoveredAgent & {
  definition: AgentDefinition;
  install: AgentInstall | null;
  plugin: AgentPlugin | null;
};

export type InstallAgent = ResolvedAgent & { install: AgentInstall };
export type PluginAgentEntry = ResolvedAgent & { plugin: AgentPlugin };

export function orderedAgentsOf(input: { agents: ResolvedAgent[] }): ResolvedAgent[] {
  const definitions = Object.fromEntries(input.agents.map((agent) => [agent.id, agent.definition]));
  return agentOrderOf({ definitions }).map((id) => input.agents.find((agent) => agent.id === id) as ResolvedAgent);
}

export function connectorAgentsOf(input: { agents: ResolvedAgent[] }): ResolvedAgent[] {
  return orderedAgentsOf({ agents: input.agents }).filter((agent) => agent.facets.includes(AgentFacet.Connector));
}

export function wakeAgentsOf(input: { agents: ResolvedAgent[] }): ResolvedAgent[] {
  return orderedAgentsOf({ agents: input.agents }).filter((agent) => agent.facets.includes(AgentFacet.Wake));
}

export function channelAgentsOf(input: { agents: ResolvedAgent[] }): ResolvedAgent[] {
  return orderedAgentsOf({ agents: input.agents }).filter((agent) => agent.facets.includes(AgentFacet.Channel));
}

export function pluginAgentsOf(input: { agents: ResolvedAgent[] }): PluginAgentEntry[] {
  return orderedAgentsOf({ agents: input.agents }).filter((agent): agent is PluginAgentEntry => agent.plugin !== null);
}

export function installAgentsOf(input: { agents: ResolvedAgent[] }): InstallAgent[] {
  return orderedAgentsOf({ agents: input.agents }).filter((agent): agent is InstallAgent => agent.install !== null);
}
