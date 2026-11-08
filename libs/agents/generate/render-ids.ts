import type { ResolvedAgent } from './agent';
import { connectorAgentsOf, installAgentsOf, orderedAgentsOf, pluginAgentsOf } from './agent';
import { GENERATED_POINTER } from './header';

function enumSourceOf(input: { enumName: string; agents: ResolvedAgent[] }): string {
  if (input.agents.length === 0) return `export enum ${input.enumName} {}`;
  const members = input.agents.map((agent) => `  ${agent.definition.enumMember} = '${agent.id}',`);
  return [`export enum ${input.enumName} {`, ...members, '}'].join('\n');
}

export function renderIds(input: { agents: ResolvedAgent[] }): string {
  return [
    GENERATED_POINTER,
    enumSourceOf({ enumName: 'AgentId', agents: orderedAgentsOf({ agents: input.agents }) }),
    enumSourceOf({ enumName: 'InstallClient', agents: installAgentsOf({ agents: input.agents }) }),
    enumSourceOf({ enumName: 'ConnectorClient', agents: connectorAgentsOf({ agents: input.agents }) }),
    enumSourceOf({ enumName: 'PluginAgent', agents: pluginAgentsOf({ agents: input.agents }) }),
  ].join('\n\n');
}
