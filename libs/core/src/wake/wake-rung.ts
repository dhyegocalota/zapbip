import { WakeMode, WakeRung } from '@zapbip/types';
import type { PollState, StoredWake } from './wake-setting';

export function wakeRungFor(input: { wake: StoredWake; pollState: PollState | null; standby: StoredWake | null; now: number }): WakeRung {
  if (input.wake.mode === WakeMode.None) return WakeRung.Inbox;
  if (input.wake.mode === WakeMode.Webhook) return WakeRung.Webhook;
  throw new Error('wakeRungFor is not implemented');
}
