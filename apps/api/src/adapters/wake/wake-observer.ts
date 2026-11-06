import type { WakeLogEvent, WakeObserver } from '@zapbip/core';

const DATASET_NAME = 'WAKE_METRICS';
const STATUS_CLASS_DIVISOR = 100;
const STATUS_CLASS_SUFFIX = 'xx';
const NO_RESPONSE_CLASS = 'network';

function statusClassOf(input: { statusCode: number | null }): string {
  if (input.statusCode === null) return NO_RESPONSE_CLASS;
  return `${Math.floor(input.statusCode / STATUS_CLASS_DIVISOR)}${STATUS_CLASS_SUFFIX}`;
}

export function createCloudflareWakeObserver(input: { dataset: AnalyticsEngineDataset }): WakeObserver {
  const { dataset } = input;
  if (dataset === undefined) throw new Error(`${DATASET_NAME} binding is missing`);
  return {
    observe: ({ event }) => {
      const { name, provider, agent, attempt, statusCode, latencyMs, outcome } = event;
      const line: WakeLogEvent = { name, provider, agent, attempt, statusCode, latencyMs, outcome };
      console.log(JSON.stringify(line));
      if (outcome === null || latencyMs === null) return;
      dataset.writeDataPoint({ blobs: [provider, outcome, statusClassOf({ statusCode })], doubles: [attempt, latencyMs] });
    },
  };
}
