import type { ConnectorLogEvent } from '@zapbip/types';

export function logConnectorEvent(input: { event: ConnectorLogEvent; fields: Record<string, string | number | boolean | null> }): void {
  const line = { ...input.fields, at: new Date().toISOString(), event: input.event };
  process.stdout.write(`${JSON.stringify(line)}\n`);
}
