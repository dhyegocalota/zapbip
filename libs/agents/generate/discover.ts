import { existsSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { compareCodePoints } from '../src/code-points';
import { AgentFacet } from '../src/contract';
import { REPOSITORY_ROOT } from './repository';
import { listedFolders } from './source';

export type DiscoveredAgent = { id: string; folder: string; facets: AgentFacet[] };

function agentFoldersOf(input: { root: string; base: string }): string[] {
  if (!existsSync(resolve(input.base, input.root))) return [];
  if (existsSync(resolve(input.base, posix.join(input.root, AgentFacet.Definition)))) return [input.root];
  return listedFolders({ parent: input.root, root: input.base }).map((name) => posix.join(input.root, name));
}

function facetsOf(input: { folder: string; base: string }): AgentFacet[] {
  return Object.values(AgentFacet).filter((facet) => existsSync(resolve(input.base, posix.join(input.folder, facet))));
}

export function discoverAgents({ roots, base = REPOSITORY_ROOT }: { roots: string[]; base?: string }): DiscoveredAgent[] {
  return roots
    .flatMap((root) => agentFoldersOf({ root, base }))
    .map((folder) => ({ id: posix.basename(folder), folder, facets: facetsOf({ folder, base }) }))
    .sort((left, right) => compareCodePoints({ left: left.id, right: right.id }));
}
