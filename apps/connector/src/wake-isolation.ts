import { ConnectorClient } from '@zapbip/types';

export type WakeIsolation = { isolationArguments: string[]; cleanup: () => Promise<void> };
export type WakeIsolationInput = { connectionLink: string; workingDirectory: string; codexHome?: string };

export const WAKE_ISOLATION_PREPARERS: Record<ConnectorClient, (input: WakeIsolationInput) => Promise<WakeIsolation>> = {
  [ConnectorClient.ClaudeCode]: () => {
    throw new Error('prepareClaudeIsolation is not implemented');
  },
  [ConnectorClient.Codex]: () => {
    throw new Error('prepareCodexIsolation is not implemented');
  },
};
