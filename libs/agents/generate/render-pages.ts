import type { ResolvedAgent } from './agent';
import type { GeneratedFile } from './plan';

export type PlannedPages = { writes: GeneratedFile[]; violations: string[] };

export function planPages(input: { agents: ResolvedAgent[]; readSource: (path: string) => string }): PlannedPages {
  throw new Error('planPages is not implemented');
}
