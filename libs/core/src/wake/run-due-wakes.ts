import { IdPrefix, MessageKind, WakeAttemptOutcome, WakeLogEventName, WakeMode, WakeStatus } from '@zapbip/types';
import { deliverToOwner } from '../inbox/use-cases/deliver-to-owner';
import {
  WAKE_BACKOFF_BASE_MS,
  WAKE_BACKOFF_CAP_MS,
  WAKE_FOLLOW_UP_MS,
  WAKE_LEASE_MS,
  WAKE_MAX_ATTEMPTS,
  WAKE_RETRY_AFTER_STATUSES,
  WAKE_SEALED_KEY_VERSION,
  WAKE_SIGNAL_BODY,
} from './constants';
import { wakeAssociatedData } from './wake-associated-data';
import { wakeFailedCopy } from './wake-copy';
import type { RunDueWakesInput, RunDueWakesResult, WakeAttemptResult } from './wake-ports';
import type { StoredWake, StoredWakeTarget, WakeJob, WakeTarget } from './wake-setting';

type JobRun = RunDueWakesInput & { job: WakeJob };
type WebhookWake = StoredWake & { target: StoredWakeTarget };
type Attempt = JobRun & { stored: WebhookWake; attempt: number; startedAt: number; result: WakeAttemptResult };

const BACKOFF_FACTOR = 2;
const UNSENT_RESULT: WakeAttemptResult = { outcome: WakeAttemptOutcome.Refused, statusCode: null, retryAfterMs: null };
const FAILED_SEND_RESULT: WakeAttemptResult = { outcome: WakeAttemptOutcome.Retry, statusCode: null, retryAfterMs: null };

function isLeased(input: { job: WakeJob; now: number }): boolean {
  return input.job.leaseUntil !== null && input.job.leaseUntil > input.now;
}

function isWebhookWake(stored: StoredWake | null): stored is WebhookWake {
  return stored !== null && stored.mode === WakeMode.Webhook && stored.target !== null;
}

function backoffMs(input: { attempt: number }): number {
  return Math.min(WAKE_BACKOFF_BASE_MS * BACKOFF_FACTOR ** (input.attempt - 1), WAKE_BACKOFF_CAP_MS);
}

function retryDelayMs(input: { attempt: number; result: WakeAttemptResult }): number {
  const { attempt, result } = input;
  const { statusCode, retryAfterMs } = result;
  const honoursRetryAfter = statusCode !== null && WAKE_RETRY_AFTER_STATUSES.includes(statusCode) && retryAfterMs !== null;
  if (!honoursRetryAfter) return backoffMs({ attempt });
  return Math.min(retryAfterMs, WAKE_BACKOFF_CAP_MS);
}

function observeAttempt(input: Attempt & { name: WakeLogEventName }): void {
  const { dependencies, wake, job, stored, attempt, startedAt, result, name } = input;
  wake.observer.observe({
    event: {
      name,
      provider: stored.target.provider,
      agent: job.agent,
      attempt,
      statusCode: result.statusCode,
      latencyMs: dependencies.clock.now() - startedAt,
      outcome: result.outcome,
    },
  });
}

async function openTarget(input: JobRun & { stored: WebhookWake }): Promise<WakeTarget | null> {
  const { dependencies, wake, ownerLocale, job, stored } = input;
  if (stored.target.keyVersion !== WAKE_SEALED_KEY_VERSION) return null;
  const plain = await wake.secretBox.open({
    sealed: stored.target.sealedTarget,
    associatedData: wakeAssociatedData({ accountId: dependencies.accountId, agent: job.agent, ownerLocale }),
  });
  if (plain === null) return null;
  const { url, token } = JSON.parse(plain) as { url: string; token: string };
  return { provider: stored.target.provider, url, token };
}

async function sendWake(input: JobRun & { stored: WebhookWake }): Promise<WakeAttemptResult> {
  const { dependencies, wake, job } = input;
  const target = await openTarget(input);
  if (target === null) return UNSENT_RESULT;
  try {
    return await wake.transport.send({ agent: job.agent, target, body: WAKE_SIGNAL_BODY, nowMs: dependencies.clock.now() });
  } catch {
    return FAILED_SEND_RESULT;
  }
}

async function updateStoredWake(input: JobRun & { patch: Partial<StoredWake> }): Promise<void> {
  const { wake, job, patch } = input;
  const current = await wake.repository.findWake({ agent: job.agent });
  if (current === null) return;
  await wake.repository.saveWake({ wake: { ...current, ...patch } });
}

async function finishJob(input: JobRun & { outcome: WakeAttemptOutcome }): Promise<void> {
  const { dependencies, wake, job, outcome } = input;
  const current = await wake.repository.findJob({ agent: job.agent });
  if (current === null || !current.rewake) return wake.repository.deleteJob({ agent: job.agent });
  const followUp: WakeJob = {
    agent: job.agent,
    dueAt: dependencies.clock.now() + WAKE_FOLLOW_UP_MS,
    attempt: 0,
    leaseUntil: null,
    rewake: false,
    lastOutcome: outcome,
  };
  await wake.repository.saveJob({ job: followUp });
}

async function tellOwner(input: JobRun): Promise<void> {
  const { dependencies, ownerLocale, job } = input;
  const text = wakeFailedCopy({ locale: ownerLocale, agent: job.agent });
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text },
    replyToMessageId: null,
  });
}

async function tellOwnerOnce(input: JobRun & { stored: StoredWake | null }): Promise<void> {
  const { wake, job, stored } = input;
  try {
    await tellOwner(input);
  } catch {
    wake.observer.observe({
      event: {
        name: WakeLogEventName.NoticeFailed,
        provider: stored === null || stored.target === null ? null : stored.target.provider,
        agent: job.agent,
        attempt: job.attempt,
        statusCode: null,
        latencyMs: null,
        outcome: null,
      },
    });
  }
}

async function giveUp(input: JobRun): Promise<void> {
  const { wake, job } = input;
  const stored = await wake.repository.findWake({ agent: job.agent });
  const isNewFailure = stored !== null && stored.status === WakeStatus.Active;
  await updateStoredWake({ ...input, patch: { status: WakeStatus.Failing } });
  await wake.repository.deleteJob({ agent: job.agent });
  if (isNewFailure) await tellOwnerOnce({ ...input, stored });
}

async function settleFailure(input: Attempt & { eventName: WakeLogEventName }): Promise<void> {
  const { wake, job, result, stored, eventName } = input;
  observeAttempt({ ...input, name: eventName });
  const current = await wake.repository.findWake({ agent: job.agent });
  const isNewFailure = current !== null && current.status === WakeStatus.Active;
  await updateStoredWake({ ...input, patch: { status: WakeStatus.Failing } });
  await finishJob({ ...input, outcome: result.outcome });
  if (isNewFailure) await tellOwnerOnce({ ...input, stored });
}

async function settleDelivered(input: Attempt): Promise<void> {
  const { dependencies } = input;
  observeAttempt({ ...input, name: WakeLogEventName.Delivered });
  await updateStoredWake({ ...input, patch: { status: WakeStatus.Active, lastDeliveredAt: dependencies.clock.now() } });
  await finishJob({ ...input, outcome: WakeAttemptOutcome.Delivered });
}

async function settleRetry(input: Attempt): Promise<void> {
  const { dependencies, wake, job, attempt, result } = input;
  if (attempt >= WAKE_MAX_ATTEMPTS) return settleFailure({ ...input, eventName: WakeLogEventName.GaveUp });
  observeAttempt({ ...input, name: WakeLogEventName.Retry });
  const current = await wake.repository.findJob({ agent: job.agent });
  if (current === null) return;
  const dueAt = dependencies.clock.now() + retryDelayMs({ attempt, result });
  await wake.repository.saveJob({
    job: { ...current, attempt, dueAt, leaseUntil: null, rewake: false, lastOutcome: WakeAttemptOutcome.Retry },
  });
}

function settleRefused(input: Attempt): Promise<void> {
  return settleFailure({ ...input, eventName: WakeLogEventName.Refused });
}

const SETTLERS: Record<WakeAttemptOutcome, (input: Attempt) => Promise<void>> = {
  [WakeAttemptOutcome.Delivered]: settleDelivered,
  [WakeAttemptOutcome.Retry]: settleRetry,
  [WakeAttemptOutcome.Refused]: settleRefused,
};

async function dropJob(input: JobRun & { stored: StoredWake | null }): Promise<void> {
  const { wake, job, stored } = input;
  await wake.repository.deleteJob({ agent: job.agent });
  wake.observer.observe({
    event: {
      name: WakeLogEventName.Dropped,
      provider: stored === null || stored.target === null ? null : stored.target.provider,
      agent: job.agent,
      attempt: job.attempt,
      statusCode: null,
      latencyMs: null,
      outcome: null,
    },
  });
}

async function attemptJob(input: JobRun): Promise<void> {
  const { dependencies, wake, job } = input;
  const { agent } = job;
  const stored = await wake.repository.findWake({ agent });
  const unreadCount = await dependencies.repository.countUnread({ agent });
  const hasLiveWaiter = dependencies.waiters.hasLiveWaiter({ agent, questionId: null });
  if (!isWebhookWake(stored)) return dropJob({ ...input, stored });
  const isUnneeded = unreadCount === 0 || hasLiveWaiter;
  if (isUnneeded) return dropJob({ ...input, stored });
  const startedAt = dependencies.clock.now();
  await wake.repository.saveJob({ job: { ...job, leaseUntil: startedAt + WAKE_LEASE_MS } });
  const result = await sendWake({ ...input, stored });
  await SETTLERS[result.outcome]({ ...input, stored, attempt: job.attempt + 1, startedAt, result });
}

async function recordFailure(input: JobRun): Promise<void> {
  const { dependencies, wake, job } = input;
  const attempt = job.attempt + 1;
  if (attempt >= WAKE_MAX_ATTEMPTS) return giveUp(input);
  const dueAt = dependencies.clock.now() + backoffMs({ attempt });
  await wake.repository.saveJob({
    job: { ...job, attempt, dueAt, leaseUntil: null, rewake: false, lastOutcome: WakeAttemptOutcome.Retry },
  });
}

async function runJob(input: JobRun): Promise<void> {
  try {
    await attemptJob(input);
  } catch {
    await recordFailure(input);
  }
}

export async function runDueWakes(input: RunDueWakesInput): Promise<RunDueWakesResult> {
  const { dependencies, wake } = input;
  const now = dependencies.clock.now();
  const dueJobs = await wake.repository.listDueJobs({ now });
  const readyJobs = dueJobs.filter((job) => !isLeased({ job, now }));
  await readyJobs.reduce<Promise<void>>(async (previous, job) => {
    await previous;
    await runJob({ ...input, job });
  }, Promise.resolve());
  return { nextDueAt: await wake.repository.findNextDueAt() };
}
