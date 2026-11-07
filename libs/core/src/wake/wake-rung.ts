import { WakeMode, WakeRung } from '@zapbip/types';
import { isPollerStale } from './poller';
import type { PollState, StoredWake } from './wake-setting';

type RungInput = { wake: StoredWake; pollState: PollState | null; standby: StoredWake | null; now: number };

function scheduledRungFor(input: RungInput): WakeRung {
  const { wake, pollState, now } = input;
  if (pollState === null) throw new Error(`scheduled wake of ${wake.agent} has no poll state`);
  return isPollerStale({ wake: { ...wake, ...pollState }, now }) ? WakeRung.Inbox : WakeRung.Scheduled;
}

function standbyRungFor(input: RungInput): WakeRung {
  const { standby } = input;
  const isStandbyServing = standby !== null && standby.mode !== WakeMode.Standby;
  return isStandbyServing ? WakeRung.Standby : WakeRung.Inbox;
}

const RUNG_RULES: Record<WakeMode, (input: RungInput) => WakeRung> = {
  [WakeMode.None]: () => WakeRung.Inbox,
  [WakeMode.Local]: () => WakeRung.Local,
  [WakeMode.Webhook]: () => WakeRung.Webhook,
  [WakeMode.Scheduled]: scheduledRungFor,
  [WakeMode.Standby]: standbyRungFor,
};

export function wakeRungFor(input: RungInput): WakeRung {
  return RUNG_RULES[input.wake.mode](input);
}
