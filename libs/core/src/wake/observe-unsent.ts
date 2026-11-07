import type { WakeLogEventName } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import type { WakeObserver } from './wake-ports';
import type { StoredWake } from './wake-setting';

export function providerOf(input: { stored: StoredWake | null }) {
  const { stored } = input;
  return stored === null || stored.target === null ? null : stored.target.provider;
}

export function observeUnsent(input: {
  observer: WakeObserver;
  name: WakeLogEventName;
  stored: StoredWake | null;
  agent: AgentName;
  attempt: number;
}): void {
  const { observer, name, stored, agent, attempt } = input;
  observer.observe({
    event: { name, provider: providerOf({ stored }), agent, attempt, statusCode: null, latencyMs: null, outcome: null, timedOut: false },
  });
}
