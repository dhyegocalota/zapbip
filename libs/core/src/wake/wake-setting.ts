import { WakeMode, type WakeAttemptOutcome, type WakeProvider, type WakeStatus } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';

export type WakeSettingInput = { mode: WakeMode; url: string | null; token: string | null };

export type WakeTarget = { provider: WakeProvider; url: string; token: string };

export type StoredWakeTarget = { provider: WakeProvider; host: string; sealedTarget: string; keyVersion: number };

export type StoredWake = {
  agent: AgentName;
  mode: WakeMode;
  target: StoredWakeTarget | null;
  status: WakeStatus;
  lastDeliveredAt: number | null;
};

export type WakeJob = {
  agent: AgentName;
  dueAt: number;
  attempt: number;
  leaseUntil: number | null;
  rewake: boolean;
  lastOutcome: WakeAttemptOutcome | null;
};

export type WebhookWake = StoredWake & { target: StoredWakeTarget };

export function isWebhookWake(stored: StoredWake | null): stored is WebhookWake {
  return stored !== null && stored.mode === WakeMode.Webhook && stored.target !== null;
}
