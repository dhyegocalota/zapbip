import type { ResolvedAgent } from './agent';

export type RenderedNavigation = { content: string; violations: string[] };

export function renderNavigation(input: { source: string; agents: ResolvedAgent[] }): RenderedNavigation {
  throw new Error('renderNavigation is not implemented');
}

export function orphanPagePathsOf(input: { existingPaths: string[]; agentIds: string[] }): string[] {
  throw new Error('orphanPagePathsOf is not implemented');
}
