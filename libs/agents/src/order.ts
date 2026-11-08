import type { AgentDefinition } from './contract';

export enum OrderSurface {
  InstallPage = 'installPage',
  Matrix = 'matrix',
  Navigation = 'navigation',
}

export function agentOrderOf(input: { definitions: Record<string, AgentDefinition>; surface: OrderSurface }): string[] {
  throw new Error('agentOrderOf is not implemented');
}
