import type { RunDueWakesInput, RunDueWakesResult } from './wake-ports';

export function runDueWakes(input: RunDueWakesInput): Promise<RunDueWakesResult> {
  void input;
  throw new Error('runDueWakes is not implemented');
}
