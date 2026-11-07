import { WakeMode, type OwnerLocale, type WakeAttemptOutcome, type WakeProvider, type WakeStatus } from '@zapbip/types';
import type { AgentName } from '../inbox/connection';
import { invalidInput } from '../inbox/inbox-error-factories';
import { AGENT_NAME_PATTERN } from '../inbox/constants';
import { SCHEDULED_MAX_INTERVAL_MINUTES, SCHEDULED_MIN_INTERVAL_MINUTES } from './constants';

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
  lastStaleNoticeAt: number | null;
  staleNoticeFailures: number;
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

enum WakeSettingField {
  Url = 'url',
  Token = 'token',
  IntervalMinutes = 'interval_minutes',
  StandbyAgent = 'standby_agent',
}

type WakeSettingCheck = { setting: WakeSettingInput; caller: AgentName; standby: StoredWake | null };

function assertAbsent(input: { setting: WakeSettingInput; fields: Partial<Record<WakeSettingField, unknown>> }): void {
  const foreign = Object.entries(input.fields).find(([, value]) => value !== null);
  if (foreign === undefined) return;
  throw invalidInput({ message: `${foreign[0]} is not allowed for ${input.setting.mode}` });
}

function assertScheduled(input: WakeSettingCheck): void {
  const { setting } = input;
  assertAbsent({
    setting,
    fields: {
      [WakeSettingField.Url]: setting.url,
      [WakeSettingField.Token]: setting.token,
      [WakeSettingField.StandbyAgent]: setting.standbyAgent,
    },
  });
  const { intervalMinutes } = setting;
  const isValidInterval =
    intervalMinutes !== null &&
    Number.isInteger(intervalMinutes) &&
    intervalMinutes >= SCHEDULED_MIN_INTERVAL_MINUTES &&
    intervalMinutes <= SCHEDULED_MAX_INTERVAL_MINUTES;
  if (isValidInterval) return;
  throw invalidInput({
    message: `${WakeSettingField.IntervalMinutes} must be a whole number from ${SCHEDULED_MIN_INTERVAL_MINUTES} to ${SCHEDULED_MAX_INTERVAL_MINUTES}`,
  });
}

function assertStandby(input: WakeSettingCheck): void {
  const { setting, caller, standby } = input;
  assertAbsent({
    setting,
    fields: {
      [WakeSettingField.Url]: setting.url,
      [WakeSettingField.Token]: setting.token,
      [WakeSettingField.IntervalMinutes]: setting.intervalMinutes,
    },
  });
  if (setting.standbyAgent === null) throw invalidInput({ message: `${WakeSettingField.StandbyAgent} is required for ${setting.mode}` });
  if (!AGENT_NAME_PATTERN.test(setting.standbyAgent))
    throw invalidInput({ message: `${WakeSettingField.StandbyAgent} must match ${AGENT_NAME_PATTERN.source}` });
  if (setting.standbyAgent === caller) throw invalidInput({ message: `${WakeSettingField.StandbyAgent} cannot be the agent itself` });
  if (standby === null) throw invalidInput({ message: `${WakeSettingField.StandbyAgent} is not connected to this account` });
  if (standby.mode === WakeMode.Standby)
    throw invalidInput({ message: `${WakeSettingField.StandbyAgent} cannot be in standby mode: one hop only` });
}

function assertWebhook(input: WakeSettingCheck): void {
  const { setting } = input;
  assertAbsent({
    setting,
    fields: { [WakeSettingField.IntervalMinutes]: setting.intervalMinutes, [WakeSettingField.StandbyAgent]: setting.standbyAgent },
  });
}

function assertTargetless(input: WakeSettingCheck): void {
  const { setting } = input;
  assertAbsent({
    setting,
    fields: {
      [WakeSettingField.Url]: setting.url,
      [WakeSettingField.Token]: setting.token,
      [WakeSettingField.IntervalMinutes]: setting.intervalMinutes,
      [WakeSettingField.StandbyAgent]: setting.standbyAgent,
    },
  });
}

const WAKE_SETTING_CHECKS: Record<WakeMode, (input: WakeSettingCheck) => void> = {
  [WakeMode.None]: assertTargetless,
  [WakeMode.Local]: assertTargetless,
  [WakeMode.Webhook]: assertWebhook,
  [WakeMode.Scheduled]: assertScheduled,
  [WakeMode.Standby]: assertStandby,
};

export function assertWakeSetting(input: WakeSettingCheck): void {
  WAKE_SETTING_CHECKS[input.setting.mode](input);
}

export type WebhookWake = StoredWake & { target: StoredWakeTarget };

export function isWebhookWake(stored: StoredWake | null): stored is WebhookWake {
  return stored !== null && stored.mode === WakeMode.Webhook && stored.target !== null;
}
