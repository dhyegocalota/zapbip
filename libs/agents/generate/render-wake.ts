import { wakeAgentsOf, type ResolvedAgent } from './agent';
import { renderRegistry } from './render-registry';

export function renderWakeRegistry(input: { agents: ResolvedAgent[] }): string {
  return renderRegistry({
    spec: {
      agents: wakeAgentsOf({ agents: input.agents }),
      exportedName: 'WAKE_TARGETS',
      moduleFile: 'wake',
      moduleExport: 'wakeTarget',
      enumName: 'WakeAgent',
      valueType: 'AgentWakeTarget',
      contractType: 'AgentWakeTarget',
      extraImports: [],
      extraSource: [],
    },
  });
}
