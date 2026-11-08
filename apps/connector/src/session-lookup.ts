import { CONNECTOR_RUNTIMES, type ConnectorClient } from '@zapbip/agents/connector';
import { homeDirectoryOf } from './runtime-home';

export async function findNewestSessionId(input: { client: ConnectorClient; workingDirectory: string }): Promise<string | null> {
  const { client, workingDirectory } = input;
  return CONNECTOR_RUNTIMES[client].findNewestSessionId({ workingDirectory, homeDirectory: homeDirectoryOf({ client }) });
}
