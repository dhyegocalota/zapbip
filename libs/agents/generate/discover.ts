import type { AgentFacet } from '../src/contract';

export type DiscoveredAgent = { id: string; folder: string; facets: AgentFacet[] };

export function discoverAgents(input: { roots: string[] }): DiscoveredAgent[] {
  throw new Error('discoverAgents is not implemented');
}
