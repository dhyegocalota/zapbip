import type { WakeMode } from '@zapbip/types';

export type StandbyCandidate = {
  agent: string;
  createdAt: number;
  wakeMode: WakeMode;
};

export function pickStandbyAgent(input: { agent: string; candidates: StandbyCandidate[] }): string | null {
  void input;
  throw new Error('pickStandbyAgent is not implemented');
}
