import type { AgentConnectorRuntime } from '../contract';
import { violationIf } from './registry';

export type ConnectorCheckEntry = { id: string; runtime: AgentConnectorRuntime };

export function connectorViolationsOf(input: { entries: ConnectorCheckEntry[] }): string[] {
  return input.entries.flatMap(({ id, runtime }) => [
    ...violationIf({
      condition: runtime.strictMcpArgument === null && runtime.strictMcpNullReason === null,
      message: `${id}: strictMcpArgument is null and strictMcpNullReason does not say why`,
    }),
    ...violationIf({
      condition: runtime.strictMcpArgument !== null && runtime.strictMcpNullReason !== null,
      message: `${id}: strictMcpArgument and strictMcpNullReason are both set`,
    }),
  ]);
}
