import type { WakeObserver } from '@zapbip/core';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';

export enum WakeObserverErrorCode {
  MetricsMissing = 'wake_metrics_missing',
}

const STATUS_CLASS_DIVISOR = 100;
const STATUS_CLASS_SUFFIX = 'xx';
const NO_RESPONSE_CLASS = 'network';
const TIMEOUT_CLASS = 'timeout';

function statusClassOf(input: { statusCode: number | null; timedOut: boolean }): string {
  const { statusCode, timedOut } = input;
  if (statusCode !== null) return `${Math.floor(statusCode / STATUS_CLASS_DIVISOR)}${STATUS_CLASS_SUFFIX}`;
  if (timedOut) return TIMEOUT_CLASS;
  return NO_RESPONSE_CLASS;
}

export function createCloudflareWakeObserver(input: { dataset: AnalyticsEngineDataset | undefined; accountId: string }): WakeObserver {
  const { dataset, accountId } = input;
  if (dataset === undefined) logEvent({ accountId, event: LogEvent.ToolError, errorCode: WakeObserverErrorCode.MetricsMissing });
  return {
    observe: ({ event }) => {
      const { name, provider, agent, attempt, statusCode, latencyMs, outcome, timedOut } = event;
      logEvent({ accountId, event: name, agent, provider, attempt, statusCode, latencyMs, outcome });
      if (dataset === undefined || outcome === null || latencyMs === null) return;
      dataset.writeDataPoint({ blobs: [provider, outcome, statusClassOf({ statusCode, timedOut })], doubles: [attempt, latencyMs] });
    },
  };
}
