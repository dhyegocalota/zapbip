import type { GenerationPlan } from './plan';

export enum GenerationMode {
  Write = 'write',
  Check = 'check',
}

export function writePlan(input: { plan: GenerationPlan; mode: GenerationMode }): string[] {
  throw new Error('writePlan is not implemented');
}
