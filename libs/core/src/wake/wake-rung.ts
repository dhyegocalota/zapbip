import type { WakeMode, WakeRung } from '@zapbip/types';

export function wakeRungFor(input: { mode: WakeMode }): WakeRung {
  void input;
  throw new Error('wakeRungFor is not implemented');
}
