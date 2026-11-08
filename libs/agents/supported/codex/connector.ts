import type { AgentConnectorRuntime } from '../../src/contract';

function notImplemented(): never {
  throw new Error('codex connector runtime is not implemented');
}

export const runtime: AgentConnectorRuntime = notImplemented();
