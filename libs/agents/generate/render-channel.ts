import { channelAgentsOf, type ResolvedAgent } from './agent';
import { renderRegistry } from './render-registry';

export function renderChannelRegistry(input: { agents: ResolvedAgent[] }): string {
  return renderRegistry({
    spec: {
      agents: channelAgentsOf({ agents: input.agents }),
      exportedName: 'CHANNEL_PROTOCOLS',
      moduleFile: 'channel',
      moduleExport: 'channelProtocol',
      enumName: 'ChannelAgent',
      valueType: 'AgentChannelProtocol',
      contractType: 'AgentChannelProtocol',
      extraImports: [],
      extraSource: [],
    },
  });
}
