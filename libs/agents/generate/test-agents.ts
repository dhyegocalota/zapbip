import { readdirSync } from 'node:fs';
import type { AgentDefinition } from '../src/contract';
import { AgentFacet } from '../src/contract';
import type { ResolvedAgent } from './agent';
import { SUPPORTED_FOLDER, repositoryPath } from './repository';

const DEFINITION_MODULE = 'definition';

export const REAL_AGENT_IDS: string[] = readdirSync(repositoryPath(SUPPORTED_FOLDER), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

export function resolvedAgentOf(input: { id: string; folder: string; definition: AgentDefinition; facets: AgentFacet[] }): ResolvedAgent {
  return { ...input, install: null, plugin: null };
}

export async function realAgents(): Promise<ResolvedAgent[]> {
  return Promise.all(
    REAL_AGENT_IDS.map(async (id) => {
      const { definition } = (await import(`../supported/${id}/${DEFINITION_MODULE}`)) as { definition: AgentDefinition };
      return resolvedAgentOf({ id, folder: `${SUPPORTED_FOLDER}/${id}`, definition, facets: [AgentFacet.Definition] });
    }),
  );
}

export function definitionsOf(input: { agents: ResolvedAgent[] }): Record<string, AgentDefinition> {
  return Object.fromEntries(input.agents.map((agent) => [agent.id, agent.definition]));
}
