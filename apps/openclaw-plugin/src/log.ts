import { ConnectorLogStream, type ConnectorLogEvent } from '@zapbip/types';

export type ConnectorLogFields = Record<string, string | number | boolean | null>;
export type ConnectorLogger = (input: { event: ConnectorLogEvent; fields: ConnectorLogFields }) => void;

export function logConnectorEvent({ event, fields }: { event: ConnectorLogEvent; fields: ConnectorLogFields }): void {
  const line = { ...fields, at: new Date().toISOString(), event };
  process[ConnectorLogStream.Stderr].write(`${JSON.stringify(line)}\n`);
}
