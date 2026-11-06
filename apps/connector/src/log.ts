import { ConnectorLogStream, type ConnectorLogEvent } from '@zapbip/types';

export type ConnectorLogFields = Record<string, string | number | boolean | null>;
export type ConnectorLogger = (input: { event: ConnectorLogEvent; fields: ConnectorLogFields }) => void;

function createConnectorLogger(input: { stream: ConnectorLogStream }): ConnectorLogger {
  return ({ event, fields }) => {
    const line = { ...fields, at: new Date().toISOString(), event };
    process[input.stream].write(`${JSON.stringify(line)}\n`);
  };
}

export const logConnectorEvent = createConnectorLogger({ stream: ConnectorLogStream.Stdout });
export const logConnectorEventToStderr = createConnectorLogger({ stream: ConnectorLogStream.Stderr });
