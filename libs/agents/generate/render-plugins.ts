import { pluginAgentsOf, type ResolvedAgent } from './agent';
import { renderRegistry } from './render-registry';

export function renderPluginRegistry(input: { agents: ResolvedAgent[] }): string {
  return renderRegistry({
    spec: {
      agents: pluginAgentsOf({ agents: input.agents }),
      exportedName: 'AGENT_PLUGINS',
      moduleFile: 'plugin',
      moduleExport: 'plugin',
      enumName: 'PluginAgent',
      valueType: 'AgentPlugin',
      contractType: 'AgentPlugin',
      extraImports: [],
      extraSource: [],
    },
  });
}
