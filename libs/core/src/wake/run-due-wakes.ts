import { IdPrefix, type OwnerLocale, MessageKind, WakeAttemptOutcome, WakeLogEventName, WakeStatus } from '@zapbip/types';
import { InboxError } from '../inbox/errors';
import { deliverToOwner } from '../inbox/use-cases/deliver-to-owner';
import {
  WAKE_BACKOFF_BASE_MS,
  WAKE_BACKOFF_CAP_MS,
  WAKE_LEASE_MS,
  WAKE_MAX_ATTEMPTS,
  WAKE_RETRY_AFTER_STATUSES,
  WAKE_SEALED_KEY_VERSION,
  WAKE_SIGNAL_BODY,
} from './constants';
import { assertWakeTarget } from './assert-wake-target';
import { wakeAssociatedData } from './wake-associated-data';
import { nextWakeDueAt } from './wake-due-at';
import { isWakeTimeout } from './wake-timeout';
import { wakeFailedCopy } from './wake-copy';
import type { RunDueWakesInput, RunDueWakesResult, WakeAttemptResult } from './wake-ports';
import { observeUnsent } from './observe-unsent';
import { isWebhookWake, type StoredWake, type WakeJob, type WakeTarget, type WebhookWake } from './wake-setting';

type JobRun = RunDueWakesInput & { job: WakeJob };
type Attempt = JobRun & { stored: WebhookWake; attempt: number; startedAt: number; result: WakeAttemptResult };

const BACKOFF_FACTOR = 2;
const UNSENT_RESULT: WakeAttemptResult = { outcome: WakeAttemptOutcome.Refused, statusCode: null, retryAfterMs: null, timedOut: false };

function isLeased(input: { job: WakeJob; now: number }): boolean {
  return input.job.leaseUntil !== null && input.job.leaseUntil > input.now;
}

function isActiveWake(stored: StoredWake | null): boolean {
  return stored !== null && stored.status === WakeStatus.Active;
}

function backoffMs(input: { attempt: number }): number {
  return Math.min(WAKE_BACKOFF_BASE_MS * BACKOFF_FACTOR ** (input.attempt - 1), WAKE_BACKOFF_CAP_MS);
}

function retryDelayMs(input: { attempt: number; result: WakeAttemptResult }): number {
  const { attempt, result } = input;
  const { statusCode, retryAfterMs } = result;
  const isRetryAfterStatus = statusCode !== null && WAKE_RETRY_AFTER_STATUSES.includes(statusCode);
  const honoursRetryAfter = isRetryAfterStatus && retryAfterMs !== null && Number.isFinite(retryAfterMs);
  if (!honoursRetryAfter) return backoffMs({ attempt });
  return Math.max(WAKE_BACKOFF_BASE_MS, Math.min(retryAfterMs, WAKE_BACKOFF_CAP_MS));
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
      timedOut: result.timedOut,
    },
  });
}

function guardTarget(input: { url: string; token: string; publicHost: string }): WakeTarget | null {
  try {
    return assertWakeTarget(input);
  } catch (error) {
    if (!(error instanceof InboxError)) throw error;
    return null;
  }
}

async function openTarget(input: JobRun & { stored: WebhookWake }): Promise<WakeTarget | null> {
  const { dependencies, wake, publicHost, job, stored } = input;
  if (stored.target.keyVersion !== WAKE_SEALED_KEY_VERSION) return null;
  const plain = await wake.secretBox.open({
    sealed: stored.target.sealedTarget,
    associatedData: wakeAssociatedData({ accountId: dependencies.accountId, agent: job.agent }),
  });
  if (plain === null) return null;
  const { url, token } = JSON.parse(plain) as { url: string; token: string };
  return guardTarget({ url, token, publicHost });
}

async function sendWake(input: JobRun & { stored: WebhookWake }): Promise<WakeAttemptResult> {
  const { dependencies, wake, job } = input;
  const target = await openTarget(input);
  if (target === null) return UNSENT_RESULT;
  try {
    return await wake.transport.send({ agent: job.agent, target, body: WAKE_SIGNAL_BODY, nowMs: dependencies.clock.now() });
  } catch (error) {
    return { outcome: WakeAttemptOutcome.Retry, statusCode: null, retryAfterMs: null, timedOut: isWakeTimeout({ error }) };
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
    dueAt: await nextWakeDueAt({ dependencies, wake, agent: job.agent }),
    attempt: 0,
    leaseUntil: null,
    rewake: false,
    lastOutcome: outcome,
  };
  await wake.repository.saveJob({ job: followUp });
}

async function tellOwner(input: JobRun & { ownerLocale: OwnerLocale }): Promise<void> {
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
  const { wake, job, stored, ownerLocale } = input;
  const unsent = { observer: wake.observer, stored, agent: job.agent, attempt: job.attempt };
  if (ownerLocale === null) return observeUnsent({ ...unsent, name: WakeLogEventName.NoticeSkipped });
  try {
    await tellOwner({ ...input, ownerLocale });
  } catch {
    observeUnsent({ ...unsent, name: WakeLogEventName.NoticeFailed });
  }
}

async function giveUp(input: JobRun): Promise<void> {
  const { wake, job } = input;
  const stored = await wake.repository.findWake({ agent: job.agent });
  const isNewFailure = isActiveWake(stored);
  await updateStoredWake({ ...input, patch: { status: WakeStatus.Failing } });
  await wake.repository.deleteJob({ agent: job.agent });
  if (isNewFailure) await tellOwnerOnce({ ...input, stored });
}

async function settleFailure(input: Attempt & { eventName: WakeLogEventName }): Promise<void> {
  const { wake, job, result, stored, eventName } = input;
  observeAttempt({ ...input, name: eventName });
  const current = await wake.repository.findWake({ agent: job.agent });
  const isNewFailure = isActiveWake(current);
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

async function settleAttempt(input: Attempt): Promise<void> {
  const { result } = input;
  try {
    await SETTLERS[result.outcome](input);
  } catch (error) {
    const isDelivered = result.outcome === WakeAttemptOutcome.Delivered;
    if (!isDelivered) throw error;
    await finishJob({ ...input, outcome: WakeAttemptOutcome.Delivered });
  }
}

async function dropJob(input: JobRun & { stored: StoredWake | null }): Promise<void> {
  const { wake, job, stored } = input;
  await wake.repository.deleteJob({ agent: job.agent });
  observeUnsent({ observer: wake.observer, name: WakeLogEventName.Dropped, stored, agent: job.agent, attempt: job.attempt });
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
  await wake.repository.saveLastRequestedAt({ agent, at: startedAt });
  const result = await sendWake({ ...input, stored });
  const current = await wake.repository.findWake({ agent });
  const isSameWake = isWebhookWake(current) && current.target.sealedTarget === stored.target.sealedTarget;
  if (!isSameWake) return;
  await settleAttempt({ ...input, stored, attempt: job.attempt + 1, startedAt, result });
}

async function recordFailure(input: JobRun): Promise<void> {
  const { dependencies, wake, job } = input;
  const current = await wake.repository.findJob({ agent: job.agent });
  if (current === null) return;
  const attempt = current.attempt + 1;
  if (attempt >= WAKE_MAX_ATTEMPTS) return giveUp(input);
  const dueAt = dependencies.clock.now() + backoffMs({ attempt });
  await wake.repository.saveJob({ job: { ...current, attempt, dueAt, leaseUntil: null, lastOutcome: WakeAttemptOutcome.Retry } });
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
