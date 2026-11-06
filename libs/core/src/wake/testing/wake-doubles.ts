import { SECOND_MS, WakeAttemptOutcome, WakeMode, WakeProvider, WakeStatus } from '@zapbip/types';
import type { AgentName } from '../../inbox/connection';
import { PINNED_WAKE_PROVIDER_RULES } from '../wake-provider';
import { WAKE_CONTENT_TYPE, WAKE_TIMESTAMP_HEADER } from '../constants';
import type {
  RecordedWakeRequest,
  ScriptedWakeResponse,
  WakeAttemptResult,
  WakeLogEvent,
  WakeObserver,
  WakeRepository,
  WakeSecretBox,
  WakeTransport,
} from '../wake-ports';
import type { StoredWake, WakeJob } from '../wake-setting';

const SEAL_SEPARATOR = '.';
const BASE64 = 'base64';
const SUCCESS_STATUS_FLOOR = 200;
const SUCCESS_STATUS_CEILING = 299;
const SERVER_ERROR_FLOOR = 500;
const SERVER_ERROR_CEILING = 599;
const NOT_IMPLEMENTED_STATUS = 501;
const RETRYABLE_STATUSES: readonly number[] = [408, 425, 429];

export type ScriptedWakeTransport = WakeTransport & {
  enqueue(input: { agent: AgentName; responses: ScriptedWakeResponse[] }): void;
  readonly requests: RecordedWakeRequest[];
  requestsFor(input: { agent: AgentName }): RecordedWakeRequest[];
};
export type RecordingWakeObserver = WakeObserver & { readonly events: WakeLogEvent[] };

function isSuccess(input: { statusCode: number }): boolean {
  return input.statusCode >= SUCCESS_STATUS_FLOOR && input.statusCode <= SUCCESS_STATUS_CEILING;
}

function isRetryable(input: { statusCode: number }): boolean {
  const { statusCode } = input;
  const isServerError = statusCode >= SERVER_ERROR_FLOOR && statusCode <= SERVER_ERROR_CEILING && statusCode !== NOT_IMPLEMENTED_STATUS;
  return isServerError || RETRYABLE_STATUSES.includes(statusCode);
}

function outcomeOf(input: { statusCode: number }): WakeAttemptOutcome {
  if (isSuccess(input)) return WakeAttemptOutcome.Delivered;
  if (isRetryable(input)) return WakeAttemptOutcome.Retry;
  return WakeAttemptOutcome.Refused;
}

function headersOf(input: { provider: WakeProvider; token: string; nowMs: number }): Record<string, string> {
  const { provider, token, nowMs } = input;
  if (provider === WakeProvider.GenericWebhook) {
    return { 'content-type': WAKE_CONTENT_TYPE, [WAKE_TIMESTAMP_HEADER]: String(Math.floor(nowMs / SECOND_MS)) };
  }
  return PINNED_WAKE_PROVIDER_RULES[provider].buildHeaders({ token });
}

export function createScriptedWakeTransport(): ScriptedWakeTransport {
  const queues = new Map<AgentName, ScriptedWakeResponse[]>();
  const requests: RecordedWakeRequest[] = [];

  function takeResponse(input: { agent: AgentName }): ScriptedWakeResponse {
    const queue = queues.get(input.agent);
    const response = queue === undefined ? undefined : queue.shift();
    if (response === undefined) throw new Error(`no scripted wake response for ${input.agent}`);
    return response;
  }

  return {
    requests,
    enqueue: ({ agent, responses }) => {
      const queue = queues.get(agent);
      queues.set(agent, queue === undefined ? [...responses] : [...queue, ...responses]);
    },
    requestsFor: ({ agent }) => requests.filter((request) => request.agent === agent),
    send: async ({ agent, target, body, nowMs }): Promise<WakeAttemptResult> => {
      requests.push({
        agent,
        url: target.url,
        headers: headersOf({ provider: target.provider, token: target.token, nowMs }),
        body,
        atMs: nowMs,
      });
      const response = takeResponse({ agent });
      if (response.errorName !== null) throw Object.assign(new Error('scripted wake failure'), { name: response.errorName });
      if (response.statusCode === null) throw new Error('a scripted response needs a statusCode or an errorName');
      return {
        outcome: outcomeOf({ statusCode: response.statusCode }),
        statusCode: response.statusCode,
        retryAfterMs: response.retryAfterMs,
      };
    },
  };
}

export function createInMemoryWakeSecretBox(): WakeSecretBox {
  const encode = (input: { text: string }): string => Buffer.from(input.text).toString(BASE64);
  const decode = (input: { text: string }): string => Buffer.from(input.text, BASE64).toString();
  return {
    seal: async ({ plain, associatedData }) => [encode({ text: associatedData }), encode({ text: plain })].join(SEAL_SEPARATOR),
    open: async ({ sealed, associatedData }) => {
      const [sealedAssociatedData, sealedPlain, ...rest] = sealed.split(SEAL_SEPARATOR);
      const isWellFormed = sealedAssociatedData !== undefined && sealedPlain !== undefined && rest.length === 0;
      if (!isWellFormed) return null;
      if (decode({ text: sealedAssociatedData }) !== associatedData) return null;
      return decode({ text: sealedPlain });
    },
  };
}

export function createInMemoryWakeRepository(): WakeRepository {
  const wakes = new Map<AgentName, StoredWake>();
  const jobs = new Map<AgentName, WakeJob>();
  const restores = new Map<AgentName, StoredWake>();
  const effectiveDueAt = (job: WakeJob): number => (job.leaseUntil === null ? job.dueAt : Math.max(job.dueAt, job.leaseUntil));

  return {
    findWake: async ({ agent }) => {
      const wake = wakes.get(agent);
      return wake === undefined ? null : { ...wake };
    },
    saveWake: async ({ wake }) => {
      wakes.set(wake.agent, { ...wake });
    },
    clearWake: async ({ agent }) => {
      const wake = wakes.get(agent);
      jobs.delete(agent);
      if (wake === undefined) return;
      wakes.set(agent, { ...wake, mode: WakeMode.None, target: null, status: WakeStatus.Active });
    },
    findJob: async ({ agent }) => {
      const job = jobs.get(agent);
      return job === undefined ? null : { ...job };
    },
    saveJob: async ({ job }) => {
      jobs.set(job.agent, { ...job });
    },
    deleteJob: async ({ agent }) => {
      jobs.delete(agent);
    },
    listDueJobs: async ({ now }) =>
      [...jobs.values()]
        .filter((job) => job.dueAt <= now)
        .sort((first, second) => first.dueAt - second.dueAt)
        .map((job) => ({ ...job })),
    findNextDueAt: async () => {
      const dueTimes = [...jobs.values()].map(effectiveDueAt);
      return dueTimes.length === 0 ? null : Math.min(...dueTimes);
    },
    findLocalRestore: async ({ agent }) => {
      const previous = restores.get(agent);
      return previous === undefined ? null : { ...previous };
    },
    saveLocalRestore: async ({ agent, previous }) => {
      restores.set(agent, { ...previous });
    },
    deleteLocalRestore: async ({ agent }) => {
      restores.delete(agent);
    },
  };
}

export function createRecordingWakeObserver(): RecordingWakeObserver {
  const events: WakeLogEvent[] = [];
  return {
    events,
    observe: ({ event }) => {
      events.push(event);
    },
  };
}
