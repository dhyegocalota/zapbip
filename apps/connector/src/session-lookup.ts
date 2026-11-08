import { homedir } from 'node:os';
import { join } from 'node:path';
import { CONNECTOR_RUNTIMES, type ConnectorClient } from '@zapbip/agents/connector';

export async function findNewestSessionId(input: {
  client: ConnectorClient;
  workingDirectory: string;
  claudeConfigDirectory?: string;
  codexHome?: string;
}): Promise<string | null> {
  const { client, workingDirectory, claudeConfigDirectory = join(homedir(), '.claude'), codexHome = join(homedir(), '.codex') } = input;
  return CONNECTOR_RUNTIMES[client].findNewestSessionId({ workingDirectory, claudeConfigDirectory, codexHome });
}
