import { orderedAgentsOf, type ResolvedAgent } from './agent';
import { renderRegistry } from './render-registry';

export function renderDefinitions(input: { agents: ResolvedAgent[] }): string {
  return renderRegistry({
    spec: {
      agents: orderedAgentsOf({ agents: input.agents }),
      exportedName: 'AGENT_DEFINITIONS',
      moduleFile: 'definition',
      moduleExport: 'definition',
      enumName: 'AgentId',
      valueType: 'AgentDefinition',
      contractType: 'AgentDefinition',
      extraImports: [],
      extraSource: [],
    },
  });
}
