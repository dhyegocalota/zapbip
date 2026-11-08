import { existsSync, readdirSync } from 'node:fs';
import { posix } from 'node:path';
import { compareCodePoints } from '../src/code-points';
import { AgentFacet } from '../src/contract';
import { repositoryPath } from './repository';

export type DiscoveredAgent = { id: string; folder: string; facets: AgentFacet[] };

function agentFoldersOf(input: { root: string }): string[] {
  if (!existsSync(repositoryPath(input.root))) return [];
  if (existsSync(repositoryPath(posix.join(input.root, AgentFacet.Definition)))) return [input.root];
  return readdirSync(repositoryPath(input.root), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => posix.join(input.root, entry.name));
}

function facetsOf(input: { folder: string }): AgentFacet[] {
  return Object.values(AgentFacet).filter((facet) => existsSync(repositoryPath(posix.join(input.folder, facet))));
}

export function discoverAgents(input: { roots: string[] }): DiscoveredAgent[] {
  return input.roots
    .flatMap((root) => agentFoldersOf({ root }))
    .map((folder) => ({ id: posix.basename(folder), folder, facets: facetsOf({ folder }) }))
    .sort((left, right) => compareCodePoints({ left: left.id, right: right.id }));
}
