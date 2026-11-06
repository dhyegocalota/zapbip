import type { OwnerLocale, WakeAttemptOutcome, WakeMode, WakeProvider, WakeStatus } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';

export type WakeSettingInput = {
  mode: WakeMode;
  url: string | null;
  token: string | null;
  intervalMinutes: number | null;
  standbyAgent: AgentName | null;
};

export type WakeTarget = { provider: WakeProvider; url: string; token: string };

export type StoredWakeTarget = { provider: WakeProvider; host: string; sealedTarget: string; keyVersion: number };

export type StoredWake = {
  agent: AgentName;
  mode: WakeMode;
  target: StoredWakeTarget | null;
  status: WakeStatus;
  lastDeliveredAt: number | null;
  intervalMinutes: number | null;
  standbyAgent: AgentName | null;
  ownerLocale: OwnerLocale | null;
};

export type PollState = {
  lastPolledAt: number;
  hasPolled: boolean;
  pollerStaleNotified: boolean;
};

export type ScheduledWake = StoredWake & PollState;

export type WakeJob = {
  agent: AgentName;
  dueAt: number;
  attempt: number;
  leaseUntil: number | null;
  rewake: boolean;
  lastOutcome: WakeAttemptOutcome | null;
};

export function assertWakeSetting(input: { setting: WakeSettingInput; caller: AgentName; standby: StoredWake | null }): void {
  void input;
  throw new Error('assertWakeSetting is not implemented');
}
