import type { AgentDefinition, AgentInstall, AgentPlugin } from '../src/contract';
import type { DiscoveredAgent } from './discover';

export type ResolvedAgent = DiscoveredAgent & {
  definition: AgentDefinition;
  install: AgentInstall | null;
  plugin: AgentPlugin | null;
};
