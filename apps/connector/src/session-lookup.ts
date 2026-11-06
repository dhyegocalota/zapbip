import type { ConnectorClient } from '@zapbip/types';

export function claudeProjectFolderName(input: { workingDirectory: string }): string {
  void input;
  throw new Error('claudeProjectFolderName is not implemented');
}

export async function findNewestSessionId(input: {
  client: ConnectorClient;
  workingDirectory: string;
  claudeConfigDirectory?: string;
  codexHome?: string;
}): Promise<string | null> {
  void input;
  throw new Error('findNewestSessionId is not implemented');
}
