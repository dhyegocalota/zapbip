import { homedir } from 'node:os';
import { join } from 'node:path';
import { CONNECTOR_RUNTIMES, type ConnectorClient } from '@zapbip/agents/connector';

export function homeDirectoryOf(input: { client: ConnectorClient }): string {
  const { homeVariable, homeFolder } = CONNECTOR_RUNTIMES[input.client];
  const overriddenDirectory = process.env[homeVariable];
  if (overriddenDirectory) return overriddenDirectory;
  return join(homedir(), homeFolder);
}
