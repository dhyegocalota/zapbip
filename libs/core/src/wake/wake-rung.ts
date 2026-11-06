import { WakeMode, WakeRung } from '@zapbip/types';

const RUNG_BY_MODE: Record<WakeMode, WakeRung> = {
  [WakeMode.None]: WakeRung.Inbox,
  [WakeMode.Webhook]: WakeRung.Webhook,
};

export function wakeRungFor(input: { mode: WakeMode }): WakeRung {
  return RUNG_BY_MODE[input.mode];
}
