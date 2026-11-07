import { WakeMode } from '@zapbip/types';

export type StandbyCandidate = {
  agent: string;
  createdAt: number;
  wakeMode: WakeMode;
};

const INELIGIBLE_WAKE_MODES: WakeMode[] = [WakeMode.None];

export function pickStandbyAgent(input: { agent: string; candidates: StandbyCandidate[] }): string | null {
  const eligibleCandidates = input.candidates.filter(
    (candidate) => candidate.agent !== input.agent && !INELIGIBLE_WAKE_MODES.includes(candidate.wakeMode),
  );
  const newest = eligibleCandidates.reduce<StandbyCandidate | null>(
    (best, candidate) => (best === null || candidate.createdAt > best.createdAt ? candidate : best),
    null,
  );
  return newest === null ? null : newest.agent;
}
