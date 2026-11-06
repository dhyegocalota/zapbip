import type { ConnectorClient } from '@zapbip/types';

export type ConnectArguments = {
  client: ConnectorClient;
  workingDirectory: string;
  pinnedSessionId: string | null;
};

export function parseConnectArguments(input: { argv: string[] }): ConnectArguments {
  void input;
  throw new Error('parseConnectArguments is not implemented');
}
