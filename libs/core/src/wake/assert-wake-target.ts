import type { WakeTarget } from './wake-setting';

export type AssertWakeTargetInput = { url: string; token: string; publicHost: string };

export function assertWakeTarget(input: AssertWakeTargetInput): WakeTarget {
  void input;
  throw new Error('assertWakeTarget is not implemented');
}
