import { WAKE_REQUEST_TIMEOUT_MS, type WakeLogEvent } from '@zapbip/core';
import { WakeAttemptOutcome, WakeLogEventName, WakeProvider } from '@zapbip/types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCloudflareWakeObserver } from '../../src/adapters/wake/wake-observer';

const TOKEN = 'token-with-sixteen-chars';
const URL_PATH = '/automations/webhook/abc12345';
const LATENCY_MS = 42;
const LOG_KEYS = ['accountId', 'agent', 'attempt', 'event', 'latencyMs', 'outcome', 'provider', 'statusCode'];
const ACCOUNT_ID = 'acc_1';

function eventOf(input: Partial<WakeLogEvent>): WakeLogEvent {
  return {
    name: WakeLogEventName.Delivered,
    provider: WakeProvider.GrokRoutine,
    agent: 'alpha',
    attempt: 1,
    statusCode: 200,
    latencyMs: LATENCY_MS,
    outcome: WakeAttemptOutcome.Delivered,
    ...input,
  };
}

function observe(input: { event: WakeLogEvent }) {
  const writeDataPoint = vi.fn();
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  createCloudflareWakeObserver({ dataset: { writeDataPoint }, accountId: ACCOUNT_ID }).observe({ event: input.event });
  return { writeDataPoint, logSpy };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createCloudflareWakeObserver', () => {
  it('writes one JSON line with the event keys only', () => {
    const { logSpy } = observe({ event: eventOf({}) });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(Object.keys(line).sort()).toEqual(LOG_KEYS);
  });

  it('names the account and the event in the line', () => {
    const { logSpy } = observe({ event: eventOf({}) });
    const line = JSON.parse(logSpy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(line).toMatchObject({ accountId: ACCOUNT_ID, event: WakeLogEventName.Delivered });
  });

  it('writes neither the token nor the url path', () => {
    const { logSpy } = observe({ event: eventOf({}) });
    const line = logSpy.mock.calls[0]![0] as string;
    expect(line).not.toContain(TOKEN);
    expect(line).not.toContain(URL_PATH);
  });

  it('writes one data point with provider, outcome and status class', () => {
    const { writeDataPoint } = observe({ event: eventOf({}) });
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: [WakeProvider.GrokRoutine, WakeAttemptOutcome.Delivered, '2xx'],
      doubles: [1, LATENCY_MS],
    });
  });

  it('writes no data point for an event that is not an attempt', () => {
    const { writeDataPoint, logSpy } = observe({
      event: eventOf({ name: WakeLogEventName.Scheduled, provider: null, attempt: 0, statusCode: null, latencyMs: null, outcome: null }),
    });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('throws naming the dataset when it is absent', () => {
    expect(() => createCloudflareWakeObserver({ dataset: undefined as unknown as AnalyticsEngineDataset, accountId: ACCOUNT_ID })).toThrow(
      'WAKE_METRICS',
    );
  });

  it.each([
    { statusCode: 200, outcome: WakeAttemptOutcome.Delivered, statusClass: '2xx' },
    { statusCode: 404, outcome: WakeAttemptOutcome.Refused, statusClass: '4xx' },
    { statusCode: 503, outcome: WakeAttemptOutcome.Retry, statusClass: '5xx' },
    { statusCode: null, outcome: WakeAttemptOutcome.Retry, statusClass: 'network' },
    { statusCode: null, outcome: WakeAttemptOutcome.Retry, statusClass: 'timeout', latencyMs: WAKE_REQUEST_TIMEOUT_MS },
  ])('classifies status $statusCode as $statusClass', ({ statusCode, outcome, statusClass, latencyMs }) => {
    const { writeDataPoint } = observe({
      event: eventOf({ statusCode, outcome, latencyMs: latencyMs === undefined ? LATENCY_MS : latencyMs }),
    });
    expect(writeDataPoint.mock.calls[0]![0].blobs[2]).toBe(statusClass);
  });
});
