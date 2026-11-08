import type { DocsLanguage } from '@zapbip/types';
import type { ResolvedAgent } from './agent';

export function renderMatrix(input: { agents: ResolvedAgent[]; language: DocsLanguage }): string {
  throw new Error('renderMatrix is not implemented');
}
