import { WakeRung } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { AgentDefinition } from '../src/contract';
import { OrderSurface, agentOrderOf } from '../src/order';
import { definition as fixtureDefinition } from '../testing/fixture-agent/definition';
import { definition as fixtureConnectorDefinition } from '../testing/fixture-connector-agent/definition';
import { definitionsOf, realAgents } from './test-agents';

const LEGACY_ORDER: Record<OrderSurface, string[]> = {
  [OrderSurface.InstallPage]: [
    'claude-code',
    'codex',
    'cursor',
    'gemini-cli',
    'grok-bot',
    'claude-ai',
    'chatgpt',
    'grok-web',
    'hermes',
    'openclaw',
    'any-mcp-client',
  ],
  [OrderSurface.Matrix]: [
    'claude-code',
    'codex',
    'cursor',
    'gemini-cli',
    'hermes',
    'openclaw',
    'grok-bot',
    'claude-ai',
    'chatgpt',
    'grok-web',
    'any-mcp-client',
  ],
  [OrderSurface.Navigation]: [
    'claude-code',
    'codex',
    'claude-ai',
    'chatgpt',
    'cursor',
    'grok-bot',
    'grok-web',
    'hermes',
    'openclaw',
    'gemini-cli',
    'any-mcp-client',
  ],
};

function withRung(input: { definition: AgentDefinition; rung: WakeRung }): AgentDefinition {
  return { ...input.definition, listen: { ...input.definition.listen, rung: input.rung } };
}

describe('agentOrderOf', () => {
  test.each(Object.values(OrderSurface))('lists the eleven definitions in the order %s has today', async (surface) => {
    const definitions = definitionsOf({ agents: await realAgents() });
    expect(agentOrderOf({ definitions, surface })).toEqual(LEGACY_ORDER[surface]);
  });

  test.each(Object.values(OrderSurface))('drops an agent that has no definition on %s', async (surface) => {
    const { cursor, ...definitions } = definitionsOf({ agents: await realAgents() });
    expect(cursor).toBeDefined();
    expect(agentOrderOf({ definitions, surface })).toEqual(LEGACY_ORDER[surface].filter((id) => id !== 'cursor'));
  });

  test.each(Object.values(OrderSurface))('puts a new agent after the known ones on %s, by rung then name', async (surface) => {
    const definitions = {
      ...definitionsOf({ agents: await realAgents() }),
      'fixture-connector-agent': fixtureConnectorDefinition,
      'fixture-agent': withRung({ definition: fixtureDefinition, rung: WakeRung.Webhook }),
    };
    expect(agentOrderOf({ definitions, surface }).slice(LEGACY_ORDER[surface].length)).toEqual([
      'fixture-connector-agent',
      'fixture-agent',
    ]);
  });

  test('sorts a new agent by the English matrix name in lower case when the rung ties', () => {
    const definitions = { zeta: fixtureConnectorDefinition, alpha: fixtureDefinition };
    expect(agentOrderOf({ definitions, surface: OrderSurface.Matrix })).toEqual(['alpha', 'zeta']);
  });
});
