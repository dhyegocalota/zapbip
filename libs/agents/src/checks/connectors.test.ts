import { describe, expect, test } from 'vitest';
import { runtime as fixtureRuntime } from '../../testing/fixture-connector-agent/connector';
import { StrictMcpNullReason, type AgentConnectorRuntime } from '../contract';
import { CONNECTOR_RUNTIMES } from '../generated/connector';
import { connectorViolationsOf } from './connectors';

const ID = 'synthetic-connector';

function violationsFor(input: Partial<AgentConnectorRuntime>): string[] {
  return connectorViolationsOf({ entries: [{ id: ID, runtime: { ...fixtureRuntime, ...input } }] });
}

describe('connectorViolationsOf', () => {
  test('accepts every registered runtime', () => {
    const entries = Object.entries(CONNECTOR_RUNTIMES).map(([id, runtime]) => ({ id, runtime }));
    expect(connectorViolationsOf({ entries })).toEqual([]);
  });

  test('accepts a runtime that pins one MCP server with a flag', () => {
    expect(violationsFor({ strictMcpArgument: '--strict', strictMcpNullReason: null })).toEqual([]);
  });

  test('accepts a runtime without the flag that says why', () => {
    expect(violationsFor({ strictMcpArgument: null, strictMcpNullReason: StrictMcpNullReason.DisablesOtherServers })).toEqual([]);
  });

  test('refuses a null flag with no reason', () => {
    expect(violationsFor({ strictMcpArgument: null, strictMcpNullReason: null })).toEqual([
      `${ID}: strictMcpArgument is null and strictMcpNullReason does not say why`,
    ]);
  });

  test('refuses a flag together with a reason', () => {
    expect(violationsFor({ strictMcpArgument: '--strict', strictMcpNullReason: StrictMcpNullReason.DisablesOtherServers })).toEqual([
      `${ID}: strictMcpArgument and strictMcpNullReason are both set`,
    ]);
  });
});
