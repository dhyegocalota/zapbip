import type { AgentConnectorRuntime } from '../../src/contract';

function notImplemented(): never {
  throw new Error('claude-code connector runtime is not implemented');
}

export const runtime: AgentConnectorRuntime = notImplemented();

export function claudeProjectFolderName(_input: { workingDirectory: string }): string {
  return notImplemented();
}
