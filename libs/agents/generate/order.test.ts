import { WakeRung } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { AgentDefinition } from '../src/contract';
import { OrderSurface, agentOrderOf } from '../src/order';
import { definition as fixtureDefinition } from '../testing/fixture-agent/definition';
import { definition as fixtureConnectorDefinition } from '../testing/fixture-connector-agent/definition';
import { definitionsOf, realAgents } from './test-agents';

const ORDER: string[] = [
  'claude-code',
  'codex',
  'cursor',
  'gemini-cli',
  'hermes',
  'openclaw',
  'claude-ai',
  'grok-bot',
  'chatgpt',
  'grok-web',
  'any-mcp-client',
];

function withRung(input: { definition: AgentDefinition; rung: WakeRung }): AgentDefinition {
  return { ...input.definition, listen: { ...input.definition.listen, rung: input.rung } };
}

describe('agentOrderOf', () => {
  test.each(Object.values(OrderSurface))(
    'lists the eleven definitions by wake rung, then by lower-case English name on %s',
    async (surface) => {
      const definitions = definitionsOf({ agents: await realAgents() });
      expect(agentOrderOf({ definitions, surface })).toEqual(ORDER);
    },
  );

  test.each(Object.values(OrderSurface))('drops an agent that has no definition on %s', async (surface) => {
    const { cursor, ...definitions } = definitionsOf({ agents: await realAgents() });
    expect(cursor).toBeDefined();
    expect(agentOrderOf({ definitions, surface })).toEqual(ORDER.filter((id) => id !== 'cursor'));
  });

  test.each(Object.values(OrderSurface))('places a new agent among the known ones by its rung, then its name on %s', async (surface) => {
    const definitions = {
      ...definitionsOf({ agents: await realAgents() }),
      'fixture-connector-agent': fixtureConnectorDefinition,
      'fixture-agent': withRung({ definition: fixtureDefinition, rung: WakeRung.Webhook }),
    };
    expect(agentOrderOf({ definitions, surface })).toEqual([
      'claude-code',
      'codex',
      'cursor',
      'fixture-connector-agent',
      'gemini-cli',
      'hermes',
      'openclaw',
      'claude-ai',
      'fixture-agent',
      'grok-bot',
      'chatgpt',
      'grok-web',
      'any-mcp-client',
    ]);
  });

  test('sorts a new agent by the English matrix name in lower case when the rung ties', () => {
    const definitions = { zeta: fixtureConnectorDefinition, alpha: fixtureDefinition };
    expect(agentOrderOf({ definitions, surface: OrderSurface.Matrix })).toEqual(['alpha', 'zeta']);
  });
});
