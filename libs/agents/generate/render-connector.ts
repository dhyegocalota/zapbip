import { connectorAgentsOf, type ResolvedAgent } from './agent';
import { renderRegistry } from './render-registry';

export function renderConnectorRegistry(input: { agents: ResolvedAgent[] }): string {
  return renderRegistry({
    spec: {
      agents: connectorAgentsOf({ agents: input.agents }),
      exportedName: 'CONNECTOR_RUNTIMES',
      moduleFile: 'connector',
      moduleExport: 'runtime',
      enumName: 'ConnectorClient',
      valueType: 'AgentConnectorRuntime',
      contractType: 'AgentConnectorRuntime',
      extraImports: [],
      extraSource: [],
    },
  });
}
