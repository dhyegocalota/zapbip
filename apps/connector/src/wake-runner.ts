import type { Message } from '@zapbip/core';
import type { ConnectorClient, ConnectorSessionSource, ConnectorWakeOutcome } from '@zapbip/types';

export async function runWake(input: {
  client: ConnectorClient;
  sessionSource: ConnectorSessionSource;
  sessionId: string | null;
  message: Message;
  workingDirectory: string;
}): Promise<{ outcome: ConnectorWakeOutcome; exitCode: number | null }> {
  void input;
  throw new Error('runWake is not implemented');
}
