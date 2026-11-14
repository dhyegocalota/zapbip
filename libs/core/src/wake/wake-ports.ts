import type { OwnerLocale, SetWakeStatus, WakeAttemptOutcome, WakeLogEventName, WakeMode, WakeProviderId, WakeRung } from '@zapbip/types';
import type { AgentName, ConnectionIdentity } from '../inbox/connection';
import type { CoreDependencies } from '../inbox/ports';
import type { PollState, ScheduledWake, StoredWake, WakeJob, WakeSettingInput, WakeTarget } from './wake-setting';
import type { PinnedWakeProviderRule } from './wake-provider';

export type WakeAttemptRequest = { agent: AgentName; target: WakeTarget; body: string; nowMs: number };

export type WakeAttemptResult = {
  outcome: WakeAttemptOutcome;
  statusCode: number | null;
  retryAfterMs: number | null;
  timedOut: boolean;
};

export interface WakeTransport {
  send(input: WakeAttemptRequest): Promise<WakeAttemptResult>;
}

export interface WakeSecretBox {
  seal(input: { plain: string; associatedData: string }): Promise<string>;
  open(input: { sealed: string; associatedData: string }): Promise<string | null>;
}

export interface WakeRepository {
  findWake(input: { agent: AgentName }): Promise<StoredWake | null>;
  saveWake(input: { wake: StoredWake }): Promise<void>;
  clearWake(input: { agent: AgentName }): Promise<void>;
  findJob(input: { agent: AgentName }): Promise<WakeJob | null>;
  saveJob(input: { job: WakeJob }): Promise<void>;
  deleteJob(input: { agent: AgentName }): Promise<void>;
  listDueJobs(input: { now: number }): Promise<WakeJob[]>;
  findNextDueAt(): Promise<number | null>;
  findPollState(input: { agent: AgentName }): Promise<PollState | null>;
  recordPoll(input: { agent: AgentName; polledAt: number; ownerLocale: OwnerLocale }): Promise<void>;
  listScheduledWakes(): Promise<ScheduledWake[]>;
  markStaleNotified(input: { agent: AgentName; noticedAt: number }): Promise<void>;
  recordStaleNoticeFailure(input: { agent: AgentName; failedAt: number }): Promise<void>;
  findLocalRestore(input: { agent: AgentName }): Promise<StoredWake | null>;
  saveLocalRestore(input: { agent: AgentName; previous: StoredWake }): Promise<void>;
  deleteLocalRestore(input: { agent: AgentName }): Promise<void>;
  findLastRequestedAt(input: { agent: AgentName }): Promise<number | null>;
  saveLastRequestedAt(input: { agent: AgentName; at: number }): Promise<void>;
}

export type WakeLogEvent = {
  name: WakeLogEventName;
  provider: WakeProviderId | null;
  agent: AgentName;
  attempt: number;
  statusCode: number | null;
  latencyMs: number | null;
  outcome: WakeAttemptOutcome | null;
  timedOut: boolean;
  errorCode?: string;
};

export interface WakeObserver {
  observe(input: { event: WakeLogEvent }): void;
}

export type WakeDependencies = {
  transport: WakeTransport;
  secretBox: WakeSecretBox;
  repository: WakeRepository;
  observer: WakeObserver;
  pinnedProviders: PinnedWakeProviderRule[];
};

export type WakeContext = {
  dependencies: CoreDependencies;
  wake: WakeDependencies;
};

export type SetWakeInput = WakeContext & {
  connection: ConnectionIdentity;
  setting: WakeSettingInput;
  publicHost: string;
};

export type SetWakeResult = {
  status: SetWakeStatus;
  wakeMode: WakeMode;
  effectiveRung: WakeRung;
  provider: WakeProviderId | null;
};

export type ScheduleWakeInput = WakeContext & { agent: AgentName };

export type RunDueWakesInput = WakeContext & { ownerLocale: OwnerLocale | null; publicHost: string };
export type RunDueWakesResult = { nextDueAt: number | null };

export type ScriptedWakeResponse = {
  statusCode: number | null;
  errorName: string | null;
  retryAfterMs: number | null;
};

export type RecordedWakeRequest = {
  agent: AgentName;
  url: string;
  headers: Record<string, string>;
  body: string;
  atMs: number;
};
