import type { ConnectorLogEvent } from '@zapbip/types';

export function logConnectorEvent(input: { event: ConnectorLogEvent; fields: Record<string, string | number | boolean | null> }): void {
  void input;
  throw new Error('logConnectorEvent is not implemented');
}
