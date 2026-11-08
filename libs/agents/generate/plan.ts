import type { DiscoveredAgent } from './discover';

export type GeneratedFile = { path: string; content: string };
export type GenerationPlan = { writes: GeneratedFile[]; deletions: string[]; violations: string[] };

export async function planGeneratedFiles(input: {
  agents: DiscoveredAgent[];
  readSource: (path: string) => string;
  listSource: (directory: string) => string[];
}): Promise<GenerationPlan> {
  throw new Error('planGeneratedFiles is not implemented');
}
